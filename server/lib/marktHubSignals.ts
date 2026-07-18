/**
 * marktHubSignals.ts
 * ==================
 * Zentrales Signal-Aggregations-Modul für die Portfolio-Logik.
 *
 * Liest aus drei Quellen im Markt Hub:
 *  1. macroIndicators (FRED): Zinskurve, Inflation, Fed Funds Rate, HY-Spread, FX
 *  2. marketRegimeHistory: Aktuelles Marktregime (Risk-On / Neutral / Defensive / Risk-Off)
 *  3. marketReports: Neuester Momentum-Marktbericht (Freitext, für LLM-Kontext)
 *
 * Produziert:
 *  - `MarktHubSignals`: strukturiertes Objekt mit allen Signalen + Erklärungen
 *  - `getSectorTilts()`: Sektor-Score-Adjustments (+/-) basierend auf Makro-Signalen
 *  - `getFactorTilts()`: MSCI-Faktor-Score-Adjustments (Value/Momentum/Quality/MinVol)
 *  - `getDynamicRiskFreeRate()`: FRED DGS10 als risikofreier Zinssatz statt hardcoded 2%
 *  - `buildMarktHubContext()`: Kompakter Textblock für LLM-Prompts
 *
 * Alle Funktionen sind fehlertolerant: bei fehlenden DB-Daten werden Neutral-Werte
 * zurückgegeben, damit buildProposal/optimize nie blockiert werden.
 */

import { getDb } from "../db";
import { macroIndicators, marketRegimeHistory, marketReports } from "../../drizzle/schema";
import { desc, eq } from "drizzle-orm";

// ── Typen ──────────────────────────────────────────────────────────────────────

export interface MacroSignals {
  /** 10Y-2Y Spread in Prozentpunkten (negativ = invertierte Zinskurve) */
  yieldCurveSpread: number | null;
  /** US Kerninflation CPI (%) */
  coreCpi: number | null;
  /** US Federal Funds Rate (%) */
  fedFundsRate: number | null;
  /** US 10-Jahres-Staatsanleihenrendite (%) — für risikofreien Zins */
  dgs10: number | null;
  /** High-Yield Credit Spread OAS (Basispunkte) */
  hySpread: number | null;
  /** CHF/USD Wechselkurs */
  chfUsd: number | null;
}

export interface RegimeSignal {
  /** Risk-On | Neutral | Defensive | Risk-Off */
  regime: string;
  /** -1..+1 (positiv = bullish) */
  overallScore: number;
  /** Empfohlene Aktienquote (20/40/60/80%) */
  equityAllocation: number;
  /** Multiplikator für Risikogewichtung (0.3/0.7/1.0/1.2) */
  regimeMultiplier: number;
}

export interface FactorSignals {
  /** MSCI Value ETF YTD-Rendite (%) */
  valueYtd: number | null;
  /** MSCI Momentum ETF YTD-Rendite (%) */
  momentumYtd: number | null;
  /** MSCI Quality ETF YTD-Rendite (%) */
  qualityYtd: number | null;
  /** MSCI Min Volatility ETF YTD-Rendite (%) */
  minVolYtd: number | null;
  /** Führender Faktor (höchste YTD-Rendite) */
  leadingFactor: "value" | "momentum" | "quality" | "minvol" | null;
}

export interface MarktHubSignals {
  macro: MacroSignals;
  regime: RegimeSignal;
  factors: FactorSignals;
  /** Neuester Marktbericht (Titel + erste 1500 Zeichen des Inhalts) */
  latestReportSummary: string | null;
  latestReportDate: string | null;
  /** Ob Daten aus der DB geladen wurden (false = alle Fallback-Werte) */
  hasData: boolean;
  /** Zeitstempel des Abrufs */
  fetchedAt: string;
}

// ── Sektor-Mapping ─────────────────────────────────────────────────────────────

/**
 * Ordnet Portfolio-Sektornamen den Makro-Tilt-Kategorien zu.
 * Mehrere Sektornamen können auf denselben Tilt-Key zeigen.
 */
const SECTOR_TO_TILT: Record<string, string> = {
  // Defensiv
  "Gesundheit": "defensive",
  "Healthcare": "defensive",
  "Versorger": "defensive",
  "Utilities": "defensive",
  "Basiskonsumgüter": "defensive",
  "Consumer Staples": "defensive",
  // Zyklisch / Wachstum
  "Technologie": "growth",
  "Technology": "growth",
  "Informationstechnologie": "growth",
  "Kommunikation": "growth",
  "Communication Services": "growth",
  "Zyklische Konsumgüter": "cyclical",
  "Consumer Discretionary": "cyclical",
  // Finanzwerte
  "Finanzen": "financials",
  "Financials": "financials",
  "Banken": "financials",
  // Industrie
  "Industrie": "industrials",
  "Industrials": "industrials",
  // Rohstoffe / Energie
  "Energie": "energy",
  "Energy": "energy",
  "Rohstoffe": "materials",
  "Materials": "materials",
  "Basic Materials": "materials",
  // Immobilien
  "Immobilien": "realestate",
  "Real Estate": "realestate",
};

// ── Hauptfunktion ──────────────────────────────────────────────────────────────

// K10 (Learning-Koordination): 5-Minuten-Cache — die Doku versprach ihn,
// implementiert war er nicht. Ohne Cache löste jeder buildProposal-/optimize-
// Aufruf u. a. vier EODHD-Faktor-ETF-Fetches aus. Neutral-Fallbacks (hasData
// false) werden nicht gecacht, damit sich eine erholte DB sofort auswirkt.
let mhCache: { data: MarktHubSignals; at: number } | null = null;
const MH_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Lädt alle Markt-Hub-Signale aus der DB (5-Min-Cache).
 * Fehlertolerant: bei DB-Fehler oder fehlenden Daten werden Neutral-Werte zurückgegeben.
 */
export async function getMarktHubSignals(): Promise<MarktHubSignals> {
  if (mhCache && Date.now() - mhCache.at < MH_CACHE_TTL_MS) return mhCache.data;
  const data = await loadMarktHubSignals();
  if (data.hasData) mhCache = { data, at: Date.now() };
  return data;
}

async function loadMarktHubSignals(): Promise<MarktHubSignals> {
  const neutral: MarktHubSignals = {
    macro: {
      yieldCurveSpread: null,
      coreCpi: null,
      fedFundsRate: null,
      dgs10: null,
      hySpread: null,
      chfUsd: null,
    },
    regime: {
      regime: "Neutral",
      overallScore: 0,
      equityAllocation: 60,
      regimeMultiplier: 1.0,
    },
    factors: {
      valueYtd: null,
      momentumYtd: null,
      qualityYtd: null,
      minVolYtd: null,
      leadingFactor: null,
    },
    latestReportSummary: null,
    latestReportDate: null,
    hasData: false,
    fetchedAt: new Date().toISOString(),
  };

  try {
    const db = await getDb();
    if (!db) return neutral;

    // ── 1. Makro-Indikatoren aus DB ──────────────────────────────────────────
    const macroRows = await db
      .select({
        seriesKey: macroIndicators.seriesKey,
        latestValue: macroIndicators.latestValue,
        latestDate: macroIndicators.latestDate,
      })
      .from(macroIndicators)
      .where(
        // Nur die Serien, die wir für Portfolio-Entscheidungen brauchen
        eq(macroIndicators.source, "FRED")
      );

    const macroMap = new Map<string, number | null>();
    for (const row of macroRows) {
      const val = row.latestValue != null ? parseFloat(String(row.latestValue)) : null;
      macroMap.set(row.seriesKey, val);
    }

    const macro: MacroSignals = {
      yieldCurveSpread: macroMap.get("FRED_T10Y2Y") ?? null,
      coreCpi: macroMap.get("FRED_CPILFESL") ?? null,
      fedFundsRate: macroMap.get("FRED_FEDFUNDS") ?? null,
      dgs10: macroMap.get("FRED_DGS10") ?? null,
      hySpread: macroMap.get("FRED_BAMLH0A0HYM2") ?? null,
      chfUsd: macroMap.get("FRED_DEXSZUS") ?? null,
    };

    // ── 2. Marktregime aus DB ────────────────────────────────────────────────
    const regimeRows = await db
      .select({
        regime: marketRegimeHistory.regime,
        overallScore: marketRegimeHistory.overallScore,
        equityAllocation: marketRegimeHistory.equityAllocation,
        regimeMultiplier: marketRegimeHistory.regimeMultiplier,
      })
      .from(marketRegimeHistory)
      .orderBy(desc(marketRegimeHistory.date))
      .limit(1);

    const regime: RegimeSignal = regimeRows.length > 0
      ? {
          regime: regimeRows[0].regime,
          overallScore: parseFloat(String(regimeRows[0].overallScore)),
          equityAllocation: regimeRows[0].equityAllocation,
          regimeMultiplier: parseFloat(String(regimeRows[0].regimeMultiplier)),
        }
      : neutral.regime;

    // ── 3. MSCI-Faktor-ETF Performance (live von EODHD) ─────────────────────
    // Wir lesen die Faktor-Daten direkt von EODHD (wie getFactorETFs im Router),
    // aber nur die YTD-Renditen für die Score-Adjustments.
    const factors = await fetchFactorYtdReturns();

    // ── 4. Neuester Marktbericht ─────────────────────────────────────────────
    const reportRows = await db
      .select({
        title: marketReports.title,
        content: marketReports.content,
        reportDate: marketReports.reportDate,
      })
      .from(marketReports)
      .orderBy(desc(marketReports.createdAt))
      .limit(1);

    let latestReportSummary: string | null = null;
    let latestReportDate: string | null = null;
    if (reportRows.length > 0) {
      const r = reportRows[0];
      latestReportDate = r.reportDate;
      // Ersten 1500 Zeichen des Inhalts als Zusammenfassung
      const content = r.content ?? "";
      const truncated = content.length > 1500 ? content.substring(0, 1500) + "…" : content;
      latestReportSummary = `**${r.title}** (${r.reportDate})\n\n${truncated}`;
    }

    const hasData = macroRows.length > 0 || regimeRows.length > 0 || reportRows.length > 0;

    return {
      macro,
      regime,
      factors,
      latestReportSummary,
      latestReportDate,
      hasData,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn("[marktHubSignals] Fehler beim Laden der Signale (non-fatal):", (err as Error).message);
    return neutral;
  }
}

// ── MSCI-Faktor-ETF YTD-Renditen ──────────────────────────────────────────────

async function fetchFactorYtdReturns(): Promise<FactorSignals> {
  const neutral: FactorSignals = {
    valueYtd: null, momentumYtd: null, qualityYtd: null, minVolYtd: null, leadingFactor: null,
  };

  try {
    const EODHD_API_KEY = process.env.EODHD_API_KEY;
    if (!EODHD_API_KEY) return neutral;

    const FACTORS = [
      { key: "value",    ticker: "IWVL.LSE" },
      { key: "momentum", ticker: "IWMO.LSE" },
      { key: "quality",  ticker: "IWQU.LSE" },
      { key: "minvol",   ticker: "MVOL.LSE" },
    ];

    const today = new Date();
    const ytdStart = new Date(today.getFullYear(), 0, 1).toISOString().split("T")[0];
    const todayStr = today.toISOString().split("T")[0];

    const results = await Promise.allSettled(
      FACTORS.map(async (f) => {
        const url = `https://eodhd.com/api/eod/${f.ticker}?api_token=${EODHD_API_KEY}&from=${ytdStart}&to=${todayStr}&fmt=json&period=d`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Array<{ date: string; adjusted_close: number; close: number }> = await res.json();
        if (!Array.isArray(data) || data.length < 2) throw new Error("No data");
        const first = data[0].adjusted_close ?? data[0].close;
        const last = data[data.length - 1].adjusted_close ?? data[data.length - 1].close;
        const ytd = ((last - first) / first) * 100;
        return { key: f.key, ytd: parseFloat(ytd.toFixed(2)) };
      })
    );

    const ytdMap: Record<string, number | null> = {};
    for (let i = 0; i < FACTORS.length; i++) {
      const r = results[i];
      ytdMap[FACTORS[i].key] = r.status === "fulfilled" ? r.value.ytd : null;
    }

    // Führenden Faktor bestimmen (höchste YTD-Rendite)
    const validFactors = Object.entries(ytdMap)
      .filter(([, v]) => v !== null)
      .sort(([, a], [, b]) => (b as number) - (a as number));
    const leadingFactor = validFactors.length > 0
      ? validFactors[0][0] as "value" | "momentum" | "quality" | "minvol"
      : null;

    return {
      valueYtd: ytdMap["value"] ?? null,
      momentumYtd: ytdMap["momentum"] ?? null,
      qualityYtd: ytdMap["quality"] ?? null,
      minVolYtd: ytdMap["minvol"] ?? null,
      leadingFactor,
    };
  } catch (err) {
    console.warn("[marktHubSignals] MSCI-Faktor-Fetch fehlgeschlagen (non-fatal):", (err as Error).message);
    return neutral;
  }
}

// ── Sektor-Tilts ───────────────────────────────────────────────────────────────

/**
 * Berechnet Sektor-Score-Adjustments basierend auf Makro-Signalen.
 *
 * Logik:
 * - Invertierte Zinskurve (T10Y2Y < 0): +8 Defensiv, -5 Zyklisch, -3 Finanzwerte
 * - Hohe Inflation (Core CPI > 4%): +6 Energie, +4 Rohstoffe, -4 Wachstum
 * - Hoher HY-Spread (> 500 bps): +10 Defensiv, -8 Zyklisch, -5 Finanzwerte
 * - Risk-Off Regime: +8 Defensiv, -6 Wachstum, -4 Zyklisch
 * - Risk-On Regime: +5 Wachstum, +3 Zyklisch, -3 Defensiv
 *
 * Returns: Map von Sektor-Name → Score-Adjustment (-15..+15)
 */
// K-04 (Audit-Fix): Kanonische deutsche Sektornamen pro Tilt-Kategorie.
// getSectorTilts gibt NUR diese Namen zurück — keine englischen Duplikate.
const CANONICAL_SECTOR_NAME: Record<string, string> = {
  defensive: 'Gesundheit / Versorger',
  growth: 'Technologie',
  cyclical: 'Zyklische Konsumgüter',
  financials: 'Finanzen',
  energy: 'Energie',
  materials: 'Rohstoffe',
  realestate: 'Immobilien',
  industrials: 'Industrie',
};

export function getSectorTilts(signals: MarktHubSignals): Record<string, number> {
  // Intern nach Tilt-Kategorie aggregieren
  const tiltsByKey: Record<string, number> = {};

  // Hilfsfunktion: Tilt auf Kategorie anwenden (intern)
  const applyTilt = (tiltKey: string, adjustment: number) => {
    tiltsByKey[tiltKey] = (tiltsByKey[tiltKey] ?? 0) + adjustment;
  };

  const { macro, regime } = signals;

  // 1. Zinskurven-Signal
  if (macro.yieldCurveSpread !== null) {
    if (macro.yieldCurveSpread < -0.5) {
      // Stark invertiert → Rezessionsrisiko
      applyTilt("defensive", 8);
      applyTilt("cyclical", -5);
      applyTilt("financials", -5);
      applyTilt("growth", -3);
    } else if (macro.yieldCurveSpread < 0) {
      // Leicht invertiert → erhöhte Vorsicht
      applyTilt("defensive", 4);
      applyTilt("cyclical", -3);
      applyTilt("financials", -3);
    } else if (macro.yieldCurveSpread > 1.0) {
      // Steil positiv → Wachstum begünstigt
      applyTilt("financials", 4);
      applyTilt("cyclical", 3);
    }
  }

  // 2. Inflations-Signal
  if (macro.coreCpi !== null) {
    if (macro.coreCpi > 4.0) {
      // Hohe Inflation → Sachwerte bevorzugen
      applyTilt("energy", 6);
      applyTilt("materials", 4);
      applyTilt("growth", -4);
      applyTilt("realestate", -3);
    } else if (macro.coreCpi > 3.0) {
      // Erhöhte Inflation → moderate Anpassung
      applyTilt("energy", 3);
      applyTilt("materials", 2);
      applyTilt("growth", -2);
    } else if (macro.coreCpi < 2.0) {
      // Niedrige Inflation → Wachstum begünstigt
      applyTilt("growth", 3);
      applyTilt("defensive", -2);
    }
  }

  // 3. Credit-Spread-Signal
  if (macro.hySpread !== null) {
    if (macro.hySpread > 500) {
      // Kreditstress → stark defensiv
      applyTilt("defensive", 10);
      applyTilt("cyclical", -8);
      applyTilt("financials", -5);
      applyTilt("growth", -5);
    } else if (macro.hySpread > 350) {
      // Erhöhter Spread → moderat defensiv
      applyTilt("defensive", 5);
      applyTilt("cyclical", -4);
      applyTilt("financials", -3);
    } else if (macro.hySpread < 200) {
      // Enge Spreads → Risikobereitschaft hoch
      applyTilt("cyclical", 3);
      applyTilt("financials", 3);
    }
  }

  // 4. Marktregime-Signal
  if (regime.regime === "Risk-Off") {
    applyTilt("defensive", 8);
    applyTilt("growth", -6);
    applyTilt("cyclical", -4);
    applyTilt("energy", -3);
  } else if (regime.regime === "Defensive") {
    applyTilt("defensive", 4);
    applyTilt("growth", -3);
    applyTilt("cyclical", -2);
  } else if (regime.regime === "Risk-On") {
    applyTilt("growth", 5);
    applyTilt("cyclical", 3);
    applyTilt("financials", 2);
    applyTilt("defensive", -3);
  }

    // Tilt-Keys auf kanonische deutsche Namen mappen (K-04: keine Duplikate)
  const result: Record<string, number> = {};
  for (const [key, val] of Object.entries(tiltsByKey)) {
    const canonicalName = CANONICAL_SECTOR_NAME[key] ?? key;
    const clamped = Math.max(-15, Math.min(15, val));
    if (clamped !== 0) result[canonicalName] = clamped;
  }
  return result;
}
/**
 * Gibt den Score-Adjustment für einen einzelnen Sektor zurück.
 * Normalisiert den Sektornamen gegen SECTOR_TO_TILT.
 */
export function getSectorTiltForStock(sector: string | null | undefined, tilts: Record<string, number>): number {
  if (!sector) return 0;
  // Zuerst direkter Treffer (kanonischer Name)
  if (tilts[sector] !== undefined) return tilts[sector];
  // Dann über SECTOR_TO_TILT-Key nachschlagen
  const tiltKey = SECTOR_TO_TILT[sector];
  if (!tiltKey) return 0;
  const canonicalName = CANONICAL_SECTOR_NAME[tiltKey];
  return canonicalName ? (tilts[canonicalName] ?? 0) : 0;
}

// ── MSCI-Faktor-Tilts ──────────────────────────────────────────────────────────

/**
 * Berechnet Score-Adjustments basierend auf MSCI-Faktor-Performance.
 *
 * Logik:
 * - Führender Faktor erhält +5 Punkte Bonus für passende Titel
 * - Schlechtester Faktor erhält -3 Punkte Malus
 * - Faktor-Tilt wird auf Titel-Charakteristika gemappt:
 *   - Value: hohe Dividendenrendite (>3%), niedriges PEG, niedrige Bewertung
 *   - Momentum: hohes YTD (>+10%), BUY-Signal
 *   - Quality: hoher signalScore (>70), niedrige Volatilität
 *   - MinVol: konservatives Risikoprofil
 */
export interface FactorTiltInput {
  dividendYield: number;
  ytdPerf: number | null;
  signalScore: number;
  riskProfile: string;
  goal: string;
}

export function getFactorTilt(input: FactorTiltInput, factors: FactorSignals): number {
  let adjustment = 0;

  if (!factors.leadingFactor) return 0;

  const { dividendYield, ytdPerf, signalScore, riskProfile, goal } = input;

  // Bonus für den führenden Faktor
  if (factors.leadingFactor === "value") {
    // Value-Faktor führt: Dividendentitel und niedrig bewertete Aktien bevorzugen
    if (dividendYield >= 3) adjustment += 5;
    else if (dividendYield >= 2) adjustment += 3;
    else if (dividendYield < 1 && goal !== "dividends") adjustment -= 2;
  } else if (factors.leadingFactor === "momentum") {
    // Momentum-Faktor führt: Titel mit starkem YTD bevorzugen
    if (ytdPerf !== null && ytdPerf > 15) adjustment += 5;
    else if (ytdPerf !== null && ytdPerf > 5) adjustment += 3;
    else if (ytdPerf !== null && ytdPerf < -10) adjustment -= 3;
  } else if (factors.leadingFactor === "quality") {
    // Quality-Faktor führt: Titel mit hohem signalScore bevorzugen
    if (signalScore >= 75) adjustment += 5;
    else if (signalScore >= 60) adjustment += 3;
    else if (signalScore < 40) adjustment -= 3;
  } else if (factors.leadingFactor === "minvol") {
    // MinVol-Faktor führt: Defensivtitel bevorzugen (konservatives Profil)
    if (riskProfile === "konservativ") adjustment += 5;
    else if (riskProfile === "ausgewogen") adjustment += 2;
    else adjustment -= 2; // Aggressiv-Profil passt nicht zu MinVol
  }

  // Malus für den schlechtesten Faktor (wenn klar negativ)
  const factorYtds = [
    { key: "value", ytd: factors.valueYtd },
    { key: "momentum", ytd: factors.momentumYtd },
    { key: "quality", ytd: factors.qualityYtd },
    { key: "minvol", ytd: factors.minVolYtd },
  ].filter(f => f.ytd !== null).sort((a, b) => (a.ytd as number) - (b.ytd as number));

  if (factorYtds.length > 0 && factorYtds[0].ytd !== null && factorYtds[0].ytd < -5) {
    const worstFactor = factorYtds[0].key;
    // Malus für Titel, die zum schlechtesten Faktor passen
    if (worstFactor === "value" && dividendYield >= 3 && goal !== "dividends") adjustment -= 2;
    if (worstFactor === "momentum" && ytdPerf !== null && ytdPerf > 15) adjustment -= 2;
    if (worstFactor === "quality" && signalScore >= 75) adjustment -= 1;
  }

  return Math.max(-8, Math.min(8, adjustment));
}

// ── Dynamischer risikofreier Zinssatz ─────────────────────────────────────────

/**
 * Gibt den aktuellen US 10-Jahres-Zinssatz aus FRED zurück.
 * Fallback: 2.0% (bisheriger Hardcode-Wert).
 *
 * Wird für DCF-Berechnungen und Portfolio-Optimierung verwendet.
 */
export function getDynamicRiskFreeRate(macro: MacroSignals): number {
  if (macro.dgs10 !== null && macro.dgs10 > 0) {
    // DGS10 ist in Prozent (z.B. 4.25 = 4.25%)
    // Für den Optimierer als Dezimalzahl (0.0425)
    return macro.dgs10 / 100;
  }
  return 0.02; // Fallback: 2%
}

// ── LLM-Kontext-Builder ────────────────────────────────────────────────────────

/**
 * Erstellt einen kompakten Textblock für LLM-Prompts (Challenger + Synthesizer).
 * Enthält: Marktregime, wichtigste Makro-Signale, MSCI-Faktor-Performance,
 * und die Zusammenfassung des neuesten Marktberichts.
 *
 * Maximale Länge: ~2000 Zeichen (LLM-freundlich, kein Overflow).
 */
export function buildMarktHubContext(signals: MarktHubSignals): string {
  if (!signals.hasData) return "";

  const lines: string[] = [];

  // 1. Marktregime
  lines.push(`**Aktuelles Marktregime:** ${signals.regime.regime} (Score: ${signals.regime.overallScore.toFixed(2)}, Aktienquote-Empfehlung: ${signals.regime.equityAllocation}%)`);

  // 2. Makro-Signale
  const macroLines: string[] = [];
  const { macro } = signals;

  if (macro.yieldCurveSpread !== null) {
    const interpretation = macro.yieldCurveSpread < -0.5
      ? "⚠️ Stark invertiert (Rezessionsrisiko)"
      : macro.yieldCurveSpread < 0
        ? "⚠️ Invertiert (erhöhte Vorsicht)"
        : macro.yieldCurveSpread > 1
          ? "✅ Steil positiv (Wachstum begünstigt)"
          : "Neutral";
    macroLines.push(`  - Zinskurve (10Y-2Y): ${macro.yieldCurveSpread.toFixed(2)}pp — ${interpretation}`);
  }
  if (macro.coreCpi !== null) {
    const interpretation = macro.coreCpi > 4 ? "⚠️ Hoch (Fed-Druck)" : macro.coreCpi > 3 ? "Erhöht" : macro.coreCpi < 2 ? "✅ Niedrig" : "Normal";
    macroLines.push(`  - Kerninflation (Core CPI): ${macro.coreCpi.toFixed(1)}% — ${interpretation}`);
  }
  if (macro.fedFundsRate !== null) {
    macroLines.push(`  - Fed Funds Rate: ${macro.fedFundsRate.toFixed(2)}%`);
  }
  if (macro.dgs10 !== null) {
    macroLines.push(`  - 10Y-Rendite (risikofreier Zins): ${macro.dgs10.toFixed(2)}%`);
  }
  if (macro.hySpread !== null) {
    const interpretation = macro.hySpread > 500 ? "⚠️ Kreditstress" : macro.hySpread > 350 ? "⚠️ Erhöht" : macro.hySpread < 200 ? "✅ Eng (Risk-On)" : "Normal";
    macroLines.push(`  - HY Credit Spread: ${macro.hySpread.toFixed(0)} bps — ${interpretation}`);
  }
  if (macroLines.length > 0) {
    lines.push("\n**Makro-Indikatoren (FRED):**");
    lines.push(...macroLines);
  }

  // 3. MSCI-Faktor-Performance
  const { factors } = signals;
  const factorParts: string[] = [];
  if (factors.valueYtd !== null) factorParts.push(`Value ${factors.valueYtd >= 0 ? "+" : ""}${factors.valueYtd.toFixed(1)}%`);
  if (factors.momentumYtd !== null) factorParts.push(`Momentum ${factors.momentumYtd >= 0 ? "+" : ""}${factors.momentumYtd.toFixed(1)}%`);
  if (factors.qualityYtd !== null) factorParts.push(`Quality ${factors.qualityYtd >= 0 ? "+" : ""}${factors.qualityYtd.toFixed(1)}%`);
  if (factors.minVolYtd !== null) factorParts.push(`MinVol ${factors.minVolYtd >= 0 ? "+" : ""}${factors.minVolYtd.toFixed(1)}%`);
  if (factorParts.length > 0) {
    const leadingLabel = factors.leadingFactor
      ? ` (Führender Faktor: **${factors.leadingFactor.charAt(0).toUpperCase() + factors.leadingFactor.slice(1)}**)`
      : "";
    lines.push(`\n**MSCI-Faktor-ETFs YTD:** ${factorParts.join(" | ")}${leadingLabel}`);
  }

  // 4. Neuester Marktbericht (nur Titel + erste 800 Zeichen)
  if (signals.latestReportSummary) {
    const truncated = signals.latestReportSummary.length > 900
      ? signals.latestReportSummary.substring(0, 900) + "…"
      : signals.latestReportSummary;
    lines.push(`\n**Neuester Momentum-Marktbericht:**\n${truncated}`);
  }

  return lines.join("\n");
}

/**
 * Beschreibt die aktiven Sektor-Tilts in lesbarer Form (für LLM-Kontext).
 */
export function describeSectorTilts(tilts: Record<string, number>): string {
  const significant = Object.entries(tilts)
    .filter(([, v]) => Math.abs(v) >= 3)
    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a));

  if (significant.length === 0) return "Keine signifikanten Sektor-Tilts aktiv.";

  const favored = significant.filter(([, v]) => v > 0).map(([s, v]) => `${s} (+${v})`);
  const penalized = significant.filter(([, v]) => v < 0).map(([s, v]) => `${s} (${v})`);

  const parts: string[] = [];
  if (favored.length > 0) parts.push(`Bevorzugt: ${favored.join(", ")}`);
  if (penalized.length > 0) parts.push(`Benachteiligt: ${penalized.join(", ")}`);
  return parts.join(" | ");
}
