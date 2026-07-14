/**
 * Gedächtnis-Schleife — DB-Anbindung (Track A2 / P2, AI_ALPHA_ROADMAP.md).
 *
 * Liest das ausgewertete Alpha aus `signal_history`, lernt daraus regime-abhängige
 * Engine-Gewichte (reine Logik in ../lib/signalMemory) und persistiert sie in
 * `regime_signal_config`. Die admin-editierbaren Qualität/Trading-Gewichte (P1) bleiben
 * dabei erhalten; nur die gelernten Engine-Gewichte werden aktualisiert.
 *
 * Aufruf: per Admin-Trigger (adminRouter). Ein zeitgesteuerter Lauf + Neukalibrierung bei
 * Regimewechsel folgt in einem eigenen PR, sobald das gegen die Live-DB verifiziert ist.
 */

import { getDb } from "../db";
import { signalHistory, regimeSignalConfig } from "../../drizzle/schema";
import { isNotNull, eq } from "drizzle-orm";
import { learnRegimeWeights, type EvaluatedSignalRow } from "../lib/signalMemory";
import { DEFAULT_REGIME_BLEND, resolveWeights, type RegimeBlendConfig } from "../lib/signalBlend";

export interface RecomputeResult {
  updatedRegimes: number;
  evaluatedRows: number;
  reason?: string;
}

/**
 * Engine-Gewichte je Regime aus dem gemessenen Alpha neu lernen und persistieren.
 */
export async function recomputeRegimeEngineWeights(): Promise<RecomputeResult> {
  const db = await getDb();
  if (!db) return { updatedRegimes: 0, evaluatedRows: 0, reason: "no-db" };

  // Nur ausgewertete Zeilen (Alpha gemessen) — das ist der Out-of-Sample-Track-Record.
  const rows = await db
    .select({
      engine: signalHistory.selectedEngine,
      regime: signalHistory.regime,
      alphaPct: signalHistory.alphaPct,
    })
    .from(signalHistory)
    .where(isNotNull(signalHistory.alphaPct));

  const evaluated: EvaluatedSignalRow[] = [];
  const sampleByRegime: Record<string, number> = {};
  for (const r of rows) {
    if (!r.engine || !r.regime || r.alphaPct == null) continue;
    const alpha = parseFloat(String(r.alphaPct));
    if (!Number.isFinite(alpha)) continue;
    evaluated.push({ engine: r.engine, regime: r.regime, alphaPct: alpha });
    sampleByRegime[r.regime] = (sampleByRegime[r.regime] || 0) + 1;
  }

  if (evaluated.length === 0) {
    return { updatedRegimes: 0, evaluatedRows: 0, reason: "keine ausgewerteten Signale (Alpha noch NULL)" };
  }

  const learned = learnRegimeWeights(evaluated);

  let updated = 0;
  try {
    for (const [regime, engineWeights] of Object.entries(learned)) {
      const existing = await db
        .select()
        .from(regimeSignalConfig)
        .where(eq(regimeSignalConfig.regime, regime))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(regimeSignalConfig)
          .set({
            engineWeights: JSON.stringify(engineWeights),
            sampleSize: sampleByRegime[regime] || 0,
            lastLearnedAt: new Date(),
          })
          .where(eq(regimeSignalConfig.regime, regime));
      } else {
        // Neue Zeile: Default-Blend (P1) beibehalten, gelernte Engine-Gewichte setzen.
        const blend = resolveWeights(regime, DEFAULT_REGIME_BLEND);
        await db.insert(regimeSignalConfig).values({
          regime,
          qualityWeight: blend.quality.toFixed(4),
          tradingWeight: blend.trading.toFixed(4),
          engineWeights: JSON.stringify(engineWeights),
          sampleSize: sampleByRegime[regime] || 0,
          lastLearnedAt: new Date(),
        });
      }
      updated += 1;
    }
  } catch (e) {
    // Tabelle regime_signal_config fehlt/veraltet → klare Meldung statt Roh-SQL im Admin-UI.
    console.error("[regimeSignalMemory] recompute persistence failed:", (e as Error).message);
    return {
      updatedRegimes: 0,
      evaluatedRows: evaluated.length,
      reason: "Tabelle regime_signal_config nicht verfügbar — Schema/Migration prüfen (pnpm db:push).",
    };
  }

  invalidateBlendConfigCache(); // SIG-7: neu gelernte Priors sofort wirksam
  return { updatedRegimes: updated, evaluatedRows: evaluated.length };
}

// Kurzer Cache, damit der Signal-Pfad (pro Titel aufgerufen) die DB nicht wiederholt trifft.
let blendConfigCache: { at: number; config: RegimeBlendConfig } | null = null;
let enginePriorsCache: { at: number; priors: Record<string, Record<string, number>> } | null = null;
const BLEND_CONFIG_TTL_MS = 5 * 60 * 1000;

/** Cache invalidieren (nach setRegimeBlend/recompute), damit Änderungen sofort greifen. */
export function invalidateBlendConfigCache(): void {
  blendConfigCache = null;
  enginePriorsCache = null;
}

/**
 * SIG-7 (Audit 2026-07): Gelernte Engine-Priors je Regime für den Signal-Pfad —
 * schliesst die Gedächtnis-Schleife. Liest die von recomputeRegimeEngineWeights
 * persistierten engineWeights (regime → engine → Gewicht); Regimes ohne gelernte
 * Gewichte fehlen im Ergebnis und fallen im modelSelector auf die Default-Priors
 * zurück. Cache 5 Min; ohne DB/Tabelle: leeres Objekt (reine Defaults).
 */
export async function getLearnedEnginePriors(nowMs = Date.now()): Promise<Record<string, Record<string, number>>> {
  if (enginePriorsCache && nowMs - enginePriorsCache.at < BLEND_CONFIG_TTL_MS) {
    return enginePriorsCache.priors;
  }
  const priors: Record<string, Record<string, number>> = {};
  const db = await getDb();
  if (db) {
    try {
      const rows = await db.select().from(regimeSignalConfig);
      for (const r of rows) {
        if (r.engineWeights == null) continue;
        const raw = typeof r.engineWeights === "string" ? JSON.parse(r.engineWeights) : r.engineWeights;
        if (!raw || typeof raw !== "object") continue;
        const weights: Record<string, number> = {};
        for (const [engine, w] of Object.entries(raw as Record<string, unknown>)) {
          const v = typeof w === "number" ? w : parseFloat(String(w));
          if (Number.isFinite(v) && v > 0) weights[engine] = v;
        }
        if (Object.keys(weights).length > 0) priors[r.regime] = weights;
      }
    } catch (e) {
      // Tabelle fehlt/veraltet → Defaults verwenden, Signal-Pfad läuft weiter.
      console.error("[regimeSignalMemory] engine priors read failed:", (e as Error).message);
    }
  }
  enginePriorsCache = { at: nowMs, priors };
  return priors;
}

/**
 * Admin-/gelernte Qualität-Trading-Gewichte je Regime als RegimeBlendConfig für den Signal-Pfad.
 * Persistierte Werte überschreiben die Defaults; unkonfigurierte Regimes behalten den Default.
 * Cache 5 Min; fällt bei fehlender DB auf DEFAULT_REGIME_BLEND zurück.
 */
export async function getRegimeBlendConfig(nowMs = Date.now()): Promise<RegimeBlendConfig> {
  if (blendConfigCache && nowMs - blendConfigCache.at < BLEND_CONFIG_TTL_MS) {
    return blendConfigCache.config;
  }
  const db = await getDb();
  const config: RegimeBlendConfig = { ...DEFAULT_REGIME_BLEND };
  if (db) {
    try {
      const rows = await db.select().from(regimeSignalConfig);
      for (const r of rows) {
        if (r.qualityWeight != null && r.tradingWeight != null) {
          config[r.regime] = {
            quality: parseFloat(String(r.qualityWeight)),
            trading: parseFloat(String(r.tradingWeight)),
          };
        }
      }
    } catch (e) {
      // Tabelle fehlt/veraltet → Defaults verwenden, Signal-Pfad läuft weiter.
      console.error("[regimeSignalMemory] blend config read failed:", (e as Error).message);
    }
  }
  blendConfigCache = { at: nowMs, config };
  return config;
}

export interface RegimeConfigView {
  regime: string;
  qualityWeight: number;
  tradingWeight: number;
  engineWeights: Record<string, number> | null;
  sampleSize: number;
  lastLearnedAt: string | null;
  /** true, wenn die Blend-Gewichte aus dem Default stammen (noch nicht admin-gesetzt). */
  isDefault: boolean;
}

/**
 * Aktuelle Konfiguration je Regime — persistierte Zeilen, ergänzt um die bekannten
 * Regimes aus dem Default-Blend, damit die Admin-UI immer alle Regimes zeigt.
 */
export async function getRegimeConfig(): Promise<RegimeConfigView[]> {
  const db = await getDb();
  let persisted: Array<typeof regimeSignalConfig.$inferSelect> = [];
  if (db) {
    try {
      persisted = await db.select().from(regimeSignalConfig);
    } catch (e) {
      // Tabelle fehlt/veraltet → nur Defaults anzeigen statt Roh-SQL-Fehler.
      console.error("[regimeSignalMemory] config read failed:", (e as Error).message);
    }
  }
  const byRegime = new Map(persisted.map((r) => [r.regime, r]));

  const regimes = new Set<string>([
    ...Object.keys(DEFAULT_REGIME_BLEND).filter((k) => k !== "default"),
    ...byRegime.keys(),
  ]);

  return [...regimes].map((regime) => {
    const row = byRegime.get(regime);
    const def = resolveWeights(regime, DEFAULT_REGIME_BLEND);
    return {
      regime,
      qualityWeight: row?.qualityWeight != null ? parseFloat(String(row.qualityWeight)) : def.quality,
      tradingWeight: row?.tradingWeight != null ? parseFloat(String(row.tradingWeight)) : def.trading,
      engineWeights: (row?.engineWeights as Record<string, number> | null) ?? null,
      sampleSize: row?.sampleSize ?? 0,
      lastLearnedAt: row?.lastLearnedAt ? new Date(row.lastLearnedAt).toISOString() : null,
      isDefault: row?.qualityWeight == null,
    };
  });
}

/**
 * Admin: Qualität/Trading-Gewicht eines Regimes setzen (P1). Werte werden auf Summe 1
 * normiert gespeichert, damit die Blend-Logik stabil bleibt.
 */
export async function setRegimeBlend(regime: string, quality: number, trading: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Keine Datenbankverbindung");
  const total = quality + trading;
  const q = total > 0 ? quality / total : 0.5;
  const t = total > 0 ? trading / total : 0.5;

  try {
    const existing = await db
      .select()
      .from(regimeSignalConfig)
      .where(eq(regimeSignalConfig.regime, regime))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(regimeSignalConfig)
        .set({ qualityWeight: q.toFixed(4), tradingWeight: t.toFixed(4) })
        .where(eq(regimeSignalConfig.regime, regime));
    } else {
      await db.insert(regimeSignalConfig).values({
        regime,
        qualityWeight: q.toFixed(4),
        tradingWeight: t.toFixed(4),
      });
    }
  } catch (e) {
    console.error("[regimeSignalMemory] setRegimeBlend failed:", (e as Error).message);
    throw new Error("Konfiguration konnte nicht gespeichert werden — Tabelle regime_signal_config fehlt/veraltet (Migration nötig: pnpm db:push).");
  }
  invalidateBlendConfigCache();
}
