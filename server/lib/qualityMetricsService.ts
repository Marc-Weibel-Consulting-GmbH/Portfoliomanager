/**
 * qualityMetricsService.ts
 * Berechnet erweiterte Qualitätskennzahlen aus EODHD-Fundamentaldaten:
 * - ROIC (Return on Invested Capital)
 * - EPS-CV (Historische Gewinnvolatilität, Variationskoeffizient)
 * - Adjusted PEG (korrigiert für Volatilität und Qualität)
 * - EPS Surprise-Rate (Beat-Konsistenz)
 * - Forward PEG
 * - PEG-Quadrant (4 Felder: PE-Niveau × Wachstum)
 */

import { ENV } from "../_core/env";
import { toEodhdSymbol } from "./eodhdSymbol";

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface QualityMetrics {
  // Bewertung
  trailingPeg: number | null;
  forwardPeg: number | null;
  adjustedPeg: number | null;
  pegQuadrant: PegQuadrant;
  pegQuadrantLabel: string;

  // Qualität
  roic: number | null;              // % Return on Invested Capital
  returnOnEquity: number | null;    // % ROE
  grossMargin: number | null;       // % Bruttomarge
  operatingMargin: number | null;   // % Betriebsmarge
  qualityScore: number;             // 0–100

  // Wachstum
  epsGrowthTTM: number | null;      // % EPS-Wachstum (YoY)
  revenueGrowthTTM: number | null;  // % Umsatzwachstum (YoY)
  epsGrowth5y: number | null;       // % p.a. EPS-CAGR 5 Jahre

  // Risiko / Stabilität
  epsVolatility: number | null;     // CV der jährlichen EPS-Wachstumsraten (0–1+)
  epsStabilityScore: number;        // 0–100 (100 = sehr stabile Gewinne)
  surpriseRate: number | null;      // % Quartale mit positivem EPS-Surprise (letzte 8Q)
  netDebtToEbitda: number | null;   // Verschuldungsgrad

  // Rohdaten für Transparenz
  trailingPE: number | null;
  forwardPE: number | null;
  eps: number | null;
  epsEstimateNextYear: number | null;
  investedCapital: number | null;
  nopat: number | null;

  // Metadaten
  dataSource: string;
  lastUpdated: string;
}

export type PegQuadrant =
  | "value_growth"      // Niedriges PE + Hohes Wachstum → Attraktiv
  | "value_slow"        // Niedriges PE + Niedriges Wachstum → Value-Falle?
  | "growth_premium"    // Hohes PE + Hohes Wachstum → Wachstumsprämie
  | "expensive_slow"    // Hohes PE + Niedriges Wachstum → Teuer
  | "unknown";

// ─── Cache ────────────────────────────────────────────────────────────────────

const cache = new Map<string, { data: QualityMetrics; expiresAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 Stunden

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function resolveEodhdTicker(ticker: string): string {
  // Erst Suffix hinzufügen falls nötig
  let resolved = ticker;
  if (!ticker.includes('.')) {
    resolved = `${ticker}.US`;
  }
  // Dann zentrale EODHD-Mapping anwenden
  return toEodhdSymbol(resolved);
}

function calcStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function calcCAGR(startValue: number, endValue: number, years: number): number | null {
  if (startValue <= 0 || endValue <= 0 || years <= 0) return null;
  return (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
}

function calcPegQuadrant(pe: number | null, epsGrowth: number | null): PegQuadrant {
  if (pe === null || epsGrowth === null) return "unknown";
  const highPE = pe > 25;
  const highGrowth = epsGrowth > 10; // > 10% p.a.
  if (!highPE && highGrowth) return "value_growth";
  if (!highPE && !highGrowth) return "value_slow";
  if (highPE && highGrowth) return "growth_premium";
  return "expensive_slow";
}

function pegQuadrantLabel(q: PegQuadrant): string {
  switch (q) {
    case "value_growth":    return "Value + Wachstum";
    case "value_slow":      return "Value / Niedriges Wachstum";
    case "growth_premium":  return "Wachstumsprämie";
    case "expensive_slow":  return "Teuer / Niedriges Wachstum";
    default:                return "Unbekannt";
  }
}

// ─── Hauptfunktion ────────────────────────────────────────────────────────────

export async function getQualityMetrics(ticker: string): Promise<QualityMetrics> {
  const cacheKey = ticker.toUpperCase();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const eodhdTicker = resolveEodhdTicker(ticker);
  const apiKey = ENV.eodhdApiKey;

  if (!apiKey) {
    return buildFallback(ticker, "EODHD API Key fehlt");
  }

  try {
    const url = `https://eodhd.com/api/fundamentals/${eodhdTicker}?api_token=${apiKey}&fmt=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });

    if (!res.ok) {
      console.warn(`[QualityMetrics] EODHD ${eodhdTicker} returned ${res.status}`);
      return buildFallback(ticker, `EODHD HTTP ${res.status}`);
    }

    const d = await res.json();
    const metrics = extractMetrics(d, ticker);

    cache.set(cacheKey, { data: metrics, expiresAt: Date.now() + CACHE_TTL_MS });
    return metrics;

  } catch (err: any) {
    console.error(`[QualityMetrics] Error for ${ticker}:`, err.message);
    return buildFallback(ticker, err.message);
  }
}

// ─── Extraktion ───────────────────────────────────────────────────────────────

function extractMetrics(d: any, ticker: string): QualityMetrics {
  const highlights = d.Highlights || {};
  const financials = d.Financials || {};
  const earnings = d.Earnings || {};

  // ── Bewertungskennzahlen ──────────────────────────────────────────────────
  const trailingPE = parseFloatOrNull(highlights.PERatio);
  const trailingPeg = parseFloatOrNull(highlights.PEGRatio);
  const eps = parseFloatOrNull(highlights.EarningsShare);
  const epsEstimateNextYear = parseFloatOrNull(highlights.EPSEstimateNextYear);
  const currentPrice = parseFloatOrNull(highlights.MarketCapitalization) &&
    parseFloatOrNull(highlights.EarningsShare)
    ? null : null; // Preis kommt von Yahoo, nicht EODHD

  // Forward PE aus EODHD Valuation
  const valuation = d.Valuation || {};
  const forwardPE = parseFloatOrNull(valuation.ForwardPE) ||
    (eps && epsEstimateNextYear && trailingPE
      ? trailingPE * (eps / epsEstimateNextYear)
      : null);

  // ── EPS-Wachstum (TTM) — korrekt aus Quartals-EPS berechnen ─────────────
  // TTM EPS = Summe der letzten 4 Quartale
  // EPS-Wachstum = (TTM EPS - TTM EPS Vorjahr) / |TTM EPS Vorjahr|
  let epsGrowthTTM: number | null = null;
  const qHistoryForTTM = earnings.History || {};
  const qAllKeys = Object.keys(qHistoryForTTM).sort();
  if (qAllKeys.length >= 8) {
    const last4 = qAllKeys.slice(-4);
    const prev4 = qAllKeys.slice(-8, -4);
    const ttmEps = last4.reduce((sum, k) => {
      const v = parseFloatOrNull(qHistoryForTTM[k]?.epsActual);
      return v !== null ? sum + v : sum;
    }, 0);
    const prevTtmEps = prev4.reduce((sum, k) => {
      const v = parseFloatOrNull(qHistoryForTTM[k]?.epsActual);
      return v !== null ? sum + v : sum;
    }, 0);
    if (Math.abs(prevTtmEps) > 0.001) {
      epsGrowthTTM = ((ttmEps - prevTtmEps) / Math.abs(prevTtmEps)) * 100;
    }
  }
  // Fallback: QuarterlyEarningsGrowthYOY wenn nicht genug Quartale
  if (epsGrowthTTM === null) {
    const qGrowth = parseFloatOrNull(highlights.QuarterlyEarningsGrowthYOY);
    if (qGrowth !== null) epsGrowthTTM = qGrowth * 100;
  }

  const revenueGrowthTTM = parseFloatOrNull(highlights.QuarterlyRevenueGrowthYOY) !== null
    ? (highlights.QuarterlyRevenueGrowthYOY as number) * 100
    : null;

  // ── EPS-CAGR 5 Jahre ─────────────────────────────────────────────────────
  const annualEPS = earnings.Annual || {};
  const annualKeys = Object.keys(annualEPS).sort();
  let epsGrowth5y: number | null = null;
  if (annualKeys.length >= 6) {
    const eps5yAgo = parseFloatOrNull(annualEPS[annualKeys.at(-6)]?.epsActual);
    const epsLatest = parseFloatOrNull(annualEPS[annualKeys.at(-1)]?.epsActual);
    epsGrowth5y = calcCAGR(eps5yAgo ?? 0, epsLatest ?? 0, 5);
  }

  // ── Historische Gewinnvolatilität (EPS-CV) ────────────────────────────────
  // Verwende jährliche EPS-Wachstumsraten der letzten 10 Jahre
  let epsVolatility: number | null = null;
  let epsStabilityScore = 50;

  const epsValues: number[] = annualKeys
    .slice(-11) // 11 Jahre für 10 Wachstumsraten
    .map(k => parseFloatOrNull(annualEPS[k]?.epsActual))
    .filter((v): v is number => v !== null && v !== 0); // include negatives, exclude zero-division

  if (epsValues.length >= 5) {
    const growthRates: number[] = [];
    for (let i = 1; i < epsValues.length; i++) {
      const prev = epsValues[i - 1];
      if (Math.abs(prev) > 0.001) {
        // Use absolute value of prev to handle negative EPS correctly
        growthRates.push((epsValues[i] - prev) / Math.abs(prev));
      }
    }
    if (growthRates.length >= 4) {
      const mean = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
      const std = calcStdDev(growthRates);
      // CV = std / |mean|, aber nur wenn mean > 0 (Wachstumsunternehmen)
      epsVolatility = Math.abs(mean) > 0.01 ? std / Math.abs(mean) : std;

      // Stabilitäts-Score: 0 = sehr volatil (CV > 1.5), 100 = sehr stabil (CV < 0.1)
      epsStabilityScore = Math.max(0, Math.min(100,
        Math.round(100 - (epsVolatility / 1.5) * 100)
      ));
    }
  }

  // ── EPS Surprise-Rate (letzte 8 Quartale) ────────────────────────────────
  const qHistory = earnings.History || {};
  const qKeys = Object.keys(qHistory).sort().slice(-8);
  let surpriseRate: number | null = null;
  if (qKeys.length >= 4) {
    const beats = qKeys.filter(k => {
      const q = qHistory[k];
      const actual = parseFloatOrNull(q.epsActual);
      const estimate = parseFloatOrNull(q.epsEstimated);
      return actual !== null && estimate !== null && actual > estimate;
    }).length;
    surpriseRate = (beats / qKeys.length) * 100;
  }

  // ── ROIC ──────────────────────────────────────────────────────────────────
  let roic: number | null = null;
  let investedCapital: number | null = null;
  let nopat: number | null = null;

  const bsYearly = financials.Balance_Sheet?.yearly || {};
  const isYearly = financials.Income_Statement?.yearly || {};
  const bsKeys = Object.keys(bsYearly).sort();
  const isKeys = Object.keys(isYearly).sort();

  if (bsKeys.length > 0 && isKeys.length > 0) {
    const latestBS = bsYearly[bsKeys.at(-1)!];
    const latestIS = isYearly[isKeys.at(-1)!];

    const operatingIncome = parseFloatOrNull(latestIS.operatingIncome);
    const taxProvision = parseFloatOrNull(latestIS.incomeTaxExpense) ||
                         parseFloatOrNull(latestIS.taxProvision);
    const totalRevenue = parseFloatOrNull(latestIS.totalRevenue);
    const longTermDebt = parseFloatOrNull(latestBS.longTermDebt) ?? 0;
    const shortTermDebt = parseFloatOrNull(latestBS.shortTermDebt) ??
                          parseFloatOrNull(latestBS.shortLongTermDebt) ?? 0;
    const cash = parseFloatOrNull(latestBS.cash) ??
                 parseFloatOrNull(latestBS.cashAndEquivalents) ?? 0;
    const equity = parseFloatOrNull(latestBS.totalStockholderEquity) ??
                   parseFloatOrNull(latestBS.totalStockholdersEquity) ??
                   parseFloatOrNull(latestBS.netInvestedCapital);

    if (operatingIncome !== null && totalRevenue !== null && totalRevenue > 0) {
      // Effektiver Steuersatz
      const effectiveTaxRate = taxProvision && operatingIncome > 0
        ? Math.min(0.40, Math.max(0, taxProvision / operatingIncome))
        : 0.21; // Fallback: 21%

      nopat = operatingIncome * (1 - effectiveTaxRate);

      // Invested Capital = Eigenkapital + Nettoverschuldung
      const netDebt = longTermDebt + shortTermDebt - cash;
      if (equity !== null) {
        investedCapital = equity + netDebt;
      } else if (latestBS.netInvestedCapital) {
        investedCapital = parseFloatOrNull(latestBS.netInvestedCapital);
      }

      if (investedCapital !== null && investedCapital > 0) {
        roic = (nopat / investedCapital) * 100;
      }
    }
  }

  // ── Net Debt / EBITDA ─────────────────────────────────────────────────────
  let netDebtToEbitda: number | null = null;
  const ebitda = parseFloatOrNull(highlights.EBITDA);
  if (ebitda && ebitda > 0 && bsKeys.length > 0) {
    const latestBS = bsYearly[bsKeys.at(-1)!];
    const netDebt = parseFloatOrNull(latestBS.netDebt);
    if (netDebt !== null) {
      netDebtToEbitda = netDebt / ebitda;
    }
  }

  // ── Margen ────────────────────────────────────────────────────────────────
  const grossMargin = parseFloatOrNull(highlights.GrossProfitTTM) &&
    parseFloatOrNull(highlights.RevenueTTM)
    ? (highlights.GrossProfitTTM / highlights.RevenueTTM) * 100
    : null;
  const operatingMargin = parseFloatOrNull(highlights.OperatingMarginTTM) !== null
    ? (highlights.OperatingMarginTTM as number) * 100
    : null;
  const returnOnEquity = parseFloatOrNull(highlights.ReturnOnEquityTTM) !== null
    ? (highlights.ReturnOnEquityTTM as number) * 100
    : null;

  // ── Quality Score (0–100) ─────────────────────────────────────────────────
  let qualityScore = 50;
  let qualityFactors = 0;

  if (roic !== null) {
    qualityScore += roic > 20 ? 15 : roic > 12 ? 8 : roic > 6 ? 2 : -8;
    qualityFactors++;
  }
  if (returnOnEquity !== null) {
    qualityScore += returnOnEquity > 25 ? 12 : returnOnEquity > 15 ? 6 : returnOnEquity > 8 ? 2 : -5;
    qualityFactors++;
  }
  if (grossMargin !== null) {
    qualityScore += grossMargin > 60 ? 10 : grossMargin > 40 ? 5 : grossMargin > 20 ? 1 : -3;
    qualityFactors++;
  }
  if (operatingMargin !== null) {
    qualityScore += operatingMargin > 25 ? 8 : operatingMargin > 15 ? 4 : operatingMargin > 5 ? 1 : -5;
    qualityFactors++;
  }
  if (surpriseRate !== null) {
    qualityScore += surpriseRate > 80 ? 5 : surpriseRate > 60 ? 2 : surpriseRate < 40 ? -3 : 0;
    qualityFactors++;
  }
  qualityScore = Math.max(0, Math.min(100, qualityScore));

  // ── Adjusted PEG ─────────────────────────────────────────────────────────
  // Adjusted PEG = Trailing PEG × (1 + EPS-CV) / QualityMultiplier
  // QualityMultiplier: 0.7 (schlechte Qualität) bis 1.3 (exzellente Qualität)
  let adjustedPeg: number | null = null;
  if (trailingPeg !== null) {
    const volatilityPenalty = epsVolatility !== null ? Math.min(1.0, epsVolatility * 0.5) : 0.2;
    const qualityMultiplier = 0.7 + (qualityScore / 100) * 0.6; // 0.7–1.3
    adjustedPeg = trailingPeg * (1 + volatilityPenalty) / qualityMultiplier;
  }

  // ── Forward PEG ──────────────────────────────────────────────────────────
  // Konzeptionell korrekt: Forward PE / zukunftsgerichtetes Wachstum (5Y CAGR)
  // Nicht: Forward PE / historisches TTM-Wachstum (Vergangenheit ≠ Zukunft)
  let forwardPeg: number | null = null;
  if (forwardPE !== null && forwardPE > 0.1 && epsGrowth5y !== null && epsGrowth5y > 0) {
    forwardPeg = forwardPE / epsGrowth5y;
  } else if (forwardPE !== null && forwardPE > 0.1 && epsGrowthTTM !== null && epsGrowthTTM > 0) {
    // Fallback: TTM als Wachstumsschätzung, nur wenn kein 5Y CAGR verfügbar
    forwardPeg = forwardPE / epsGrowthTTM;
  }

  // ── PEG-Quadrant ─────────────────────────────────────────────────────────
  const growthForQuadrant = epsGrowthTTM ?? epsGrowth5y;
  const pegQuadrant = calcPegQuadrant(trailingPE, growthForQuadrant);

  return {
    trailingPeg,
    forwardPeg,
    adjustedPeg,
    pegQuadrant,
    pegQuadrantLabel: pegQuadrantLabel(pegQuadrant),
    roic,
    returnOnEquity,
    grossMargin,
    operatingMargin,
    qualityScore,
    epsGrowthTTM,
    revenueGrowthTTM,
    epsGrowth5y,
    epsVolatility,
    epsStabilityScore,
    surpriseRate,
    netDebtToEbitda,
    trailingPE,
    forwardPE,
    eps,
    epsEstimateNextYear,
    investedCapital,
    nopat,
    dataSource: "EODHD",
    lastUpdated: new Date().toISOString(),
  };
}

// ─── Fallback ─────────────────────────────────────────────────────────────────

function buildFallback(ticker: string, reason: string): QualityMetrics {
  console.warn(`[QualityMetrics] Fallback for ${ticker}: ${reason}`);
  return {
    trailingPeg: null, forwardPeg: null, adjustedPeg: null,
    pegQuadrant: "unknown", pegQuadrantLabel: "Unbekannt",
    roic: null, returnOnEquity: null, grossMargin: null, operatingMargin: null,
    qualityScore: 50,
    epsGrowthTTM: null, revenueGrowthTTM: null, epsGrowth5y: null,
    epsVolatility: null, epsStabilityScore: 50,
    surpriseRate: null, netDebtToEbitda: null,
    trailingPE: null, forwardPE: null, eps: null, epsEstimateNextYear: null,
    investedCapital: null, nopat: null,
    dataSource: `Fallback (${reason})`,
    lastUpdated: new Date().toISOString(),
  };
}

// ─── Hilfsfunktion ────────────────────────────────────────────────────────────

function parseFloatOrNull(val: any): number | null {
  if (val === null || val === undefined || val === "" || val === "N/A") return null;
  const n = parseFloat(String(val));
  return isNaN(n) ? null : n;
}

// ─── Cache leeren ─────────────────────────────────────────────────────────────

export function clearQualityMetricsCache(ticker?: string): void {
  if (ticker) {
    cache.delete(ticker.toUpperCase());
  } else {
    cache.clear();
  }
}
