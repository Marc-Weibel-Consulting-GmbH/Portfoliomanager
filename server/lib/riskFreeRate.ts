/**
 * Eine risikofreie Wahrheit (Learning-Koordination K1).
 *
 * Alle Sharpe-/Sortino-/Optimierungs-Pfade sollen denselben risikofreien Zins
 * verwenden: FRED DGS10 (US-10-Jahres-Rendite) aus der macroIndicators-Tabelle,
 * die der Markt-Hub täglich pflegt. Vorher rechnete der Auto-Portfolio-Vorschlag
 * mit ~4 % (DGS10), der Qualitäts-Snapshot und calcRiskMetrics aber mit fixen
 * 2 % — dasselbe Portfolio bekam je nach Pfad unterschiedliche Sharpe-Werte.
 *
 * Fallback ist DEFAULT_RISK_FREE_RATE (2 %), wenn keine DB/kein plausibler
 * DGS10-Wert vorliegt. 15-Minuten-Cache, da sich der Satz untertägig kaum bewegt.
 */
import { DEFAULT_RISK_FREE_RATE } from "../analytics/riskStats";

let cached: { rate: number; at: number } | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000;

export async function getRiskFreeRate(): Promise<number> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.rate;
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return DEFAULT_RISK_FREE_RATE;
    const { macroIndicators } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select({ latestValue: macroIndicators.latestValue })
      .from(macroIndicators)
      .where(eq(macroIndicators.seriesKey, "FRED_DGS10"))
      .limit(1);
    const pct = rows.length && rows[0].latestValue != null
      ? parseFloat(String(rows[0].latestValue))
      : NaN;
    // Plausibilität 0–10 %: ausserhalb ist es ein Datenfehler, kein Zins.
    const rate = Number.isFinite(pct) && pct > 0 && pct < 10 ? pct / 100 : DEFAULT_RISK_FREE_RATE;
    cached = { rate, at: Date.now() };
    return rate;
  } catch {
    return DEFAULT_RISK_FREE_RATE;
  }
}

/** Nur für Tests. */
export function invalidateRiskFreeRateCache(): void {
  cached = null;
}
