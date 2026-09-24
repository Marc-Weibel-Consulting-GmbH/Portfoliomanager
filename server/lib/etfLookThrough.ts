import { ENV } from "../_core/env";
import { rsiWilder } from "./rsi";
import { calculateMomentumScore } from "../analytics/qualityMomentumEngine";
import { detectBubble } from "../analytics/lpplsEngine";
import { regimeMitTotband } from "./signals/regimeMitTotband";
import { berechneTiming } from "./dreiScoreSignal";
import { getDreiScores } from "./dreiScoresService";
import { toEodhdSymbol } from "./eodhdSymbol";

const MIN_SCORE_COVERAGE = 0.9;
const LOOK_THROUGH_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CHDVD_ISIN = "CH0237935637";
const CHDVD_HOLDING_COUNT = 20;
const CHDVD_INTERNAL_TICKER_OVERRIDES: Record<string, string> = {
  // EODHD carries the Roche participation certificate in CHDVD as ROP.SW,
  // while the project (and its historical score row) uses RO.SW.
  "ROP.SW": "RO.SW",
};

export interface LookThroughHoldingInput {
  ticker: string;
  weightPct: number;
  quality: number | null;
  valuation: number | null;
  timing: number | null;
}

export interface LookThroughMetric {
  score: number | null;
  coveragePct: number;
}

export interface EtfLookThroughScores {
  method: "constituent_weighted";
  fundTicker: string;
  dataAsOf: string;
  holdingCount: number;
  weightsTotalPct: number;
  quality: LookThroughMetric;
  valuation: LookThroughMetric;
  timing: LookThroughMetric;
  source: "eodhd_etf_holdings";
}

interface EodhdHolding {
  Code?: unknown;
  Exchange?: unknown;
  "Assets_%"?: unknown;
  Sector?: unknown;
}

interface EodhdFundamentals {
  General?: { Type?: unknown; UpdatedAt?: unknown };
  ETF_Data?: { ISIN?: unknown; Holdings_Count?: unknown; Holdings?: Record<string, EodhdHolding> };
}

interface EodhdPrice {
  date?: unknown;
  close?: unknown;
  adjusted_close?: unknown;
}

let cachedChdvd: { value: EtfLookThroughScores | null; expiresAt: number } | null = null;
let pendingChdvd: Promise<EtfLookThroughScores | null> | null = null;

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function weightedMetric(
  holdings: LookThroughHoldingInput[],
  pick: (holding: LookThroughHoldingInput) => number | null,
): LookThroughMetric {
  const totalWeight = holdings.reduce((sum, holding) => sum + holding.weightPct, 0);
  if (!(totalWeight > 0)) return { score: null, coveragePct: 0 };

  const covered = holdings.filter((holding) => pick(holding) !== null && holding.weightPct > 0);
  const coveredWeight = covered.reduce((sum, holding) => sum + holding.weightPct, 0);
  const coveragePct = (coveredWeight / totalWeight) * 100;
  if (coveragePct < MIN_SCORE_COVERAGE * 100) return { score: null, coveragePct: round(coveragePct) };

  const weighted = covered.reduce((sum, holding) => sum + holding.weightPct * (pick(holding) ?? 0), 0) / coveredWeight;
  return { score: round(weighted), coveragePct: round(coveragePct) };
}

/**
 * Pure, testable aggregation. Scores are only published independently where
 * at least 90% of the current ETF weight has a verifiable component score.
 */
export function aggregateConstituentScores(
  fundTicker: string,
  dataAsOf: string,
  holdingCount: number,
  holdings: LookThroughHoldingInput[],
): EtfLookThroughScores | null {
  const weightsTotalPct = holdings.reduce((sum, holding) => sum + holding.weightPct, 0);
  if (!dataAsOf || holdingCount <= 0 || weightsTotalPct < 98 || weightsTotalPct > 101) return null;

  return {
    method: "constituent_weighted",
    fundTicker,
    dataAsOf,
    holdingCount,
    weightsTotalPct: round(weightsTotalPct, 2),
    quality: weightedMetric(holdings, (holding) => holding.quality),
    valuation: weightedMetric(holdings, (holding) => holding.valuation),
    timing: weightedMetric(holdings, (holding) => holding.timing),
    source: "eodhd_etf_holdings",
  };
}

function resolveInternalTicker(holding: EodhdHolding): string | null {
  const code = String(holding.Code ?? "").trim().toUpperCase();
  const exchange = String(holding.Exchange ?? "").trim().toUpperCase();
  if (!code || !exchange || !/^[A-Z0-9]+$/.test(code) || exchange !== "SW") return null;
  const eodhdTicker = `${code}.${exchange}`;
  return CHDVD_INTERNAL_TICKER_OVERRIDES[eodhdTicker] ?? eodhdTicker;
}

async function fetchEodhdJson<T>(url: string, timeoutMs = 8_000): Promise<T | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

async function calculateLiveTiming(ticker: string): Promise<number | null> {
  if (!ENV.eodhdApiKey) return null;
  const from = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  const url = `https://eodhd.com/api/eod/${toEodhdSymbol(ticker)}?api_token=${ENV.eodhdApiKey}&fmt=json&from=${from}&to=${to}`;
  const raw = await fetchEodhdJson<EodhdPrice[]>(url);
  if (!Array.isArray(raw)) return null;

  const series = raw
    .map((row) => ({
      date: String(row.date ?? ""),
      close: finiteNumber(row.adjusted_close) ?? finiteNumber(row.close),
    }))
    .filter((row): row is { date: string; close: number } => Boolean(row.date) && row.close !== null && row.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const prices = series.map((row) => row.close);
  if (prices.length < 60) return null;

  const last = series.at(-1)!;
  const yearStart = `${new Date().getUTCFullYear()}-01-01`;
  const firstYtd = series.find((row) => row.date >= yearStart) ?? series[0];
  const high = Math.max(...prices);
  const low = Math.min(...prices);
  const momentum = calculateMomentumScore({ prices }).score;
  const bubble = detectBubble({ prices });
  const timing = berechneTiming({
    momentum,
    rsi14: prices.length >= 15 ? rsiWilder(prices, 14) : null,
    positionIn52W: high > low ? (last.close - low) / (high - low) : null,
    ytdPerformance: firstYtd.close > 0 ? ((last.close - firstYtd.close) / firstYtd.close) * 100 : null,
    blasenScore: bubble.bubbleScore ?? null,
  });
  return timing.score;
}

async function getConstituentScore(ticker: string, sector: string | null): Promise<Pick<LookThroughHoldingInput, "quality" | "valuation" | "timing">> {
  try {
    const scores = await getDreiScores(ticker, { sektor: sector });
    // Der stündliche Score-Lauf hat für vorhandene Titel bereits ein konsistentes
    // Timing. Nur für einen noch nicht im Universum enthaltenen Bestandsteil
    // wird eine begrenzte EODHD-Kursreihe gelesen.
    const timing = scores.timing.score ?? await calculateLiveTiming(ticker);
    return {
      quality: scores.qualitaet.gesamt,
      valuation: scores.bewertung.score,
      timing,
    };
  } catch {
    return { quality: null, valuation: null, timing: null };
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await task(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function calculateChdvdLookThrough(): Promise<EtfLookThroughScores | null> {
  if (!ENV.eodhdApiKey) return null;

/**
 * Calculates a private, aggregate-only CHDVD look-through. It never persists or
 * returns constituent identities/weights, avoiding a holdings redistribution.
 */
  const url = `https://eodhd.com/api/v1.1/fundamentals/CHDVD.SW?api_token=${ENV.eodhdApiKey}&fmt=json`;
  const payload = await fetchEodhdJson<EodhdFundamentals>(url);
  const holdings = payload?.ETF_Data?.Holdings ? Object.values(payload.ETF_Data.Holdings) : [];
  const reportedCount = finiteNumber(payload?.ETF_Data?.Holdings_Count);
  const dataAsOf = typeof payload?.General?.UpdatedAt === "string" ? payload.General.UpdatedAt : null;
  const isin = String(payload?.ETF_Data?.ISIN ?? "").trim().toUpperCase();
  const isEtf = String(payload?.General?.Type ?? "").toUpperCase() === "ETF";
  if (!isEtf || isin !== CHDVD_ISIN || reportedCount !== CHDVD_HOLDING_COUNT || holdings.length !== CHDVD_HOLDING_COUNT || !dataAsOf) {
    return null;
  }

  const resolved = holdings.map((holding) => ({
    ticker: resolveInternalTicker(holding),
    weightPct: finiteNumber(holding["Assets_%"]),
    sector: typeof holding.Sector === "string" ? holding.Sector : null,
  }));
  if (resolved.some((holding) => !holding.ticker || holding.weightPct === null || holding.weightPct! <= 0)) {
    return null;
  }

  const enriched = await mapWithConcurrency(resolved, 4, async (holding) => {
    const scores = await getConstituentScore(holding.ticker!, holding.sector);
    return { ticker: holding.ticker!, weightPct: holding.weightPct!, ...scores };
  });
  return aggregateConstituentScores("CHDVD.SW", dataAsOf, holdings.length, enriched);
}

export async function getChdvdLookThroughScores(): Promise<EtfLookThroughScores | null> {
  if (cachedChdvd && cachedChdvd.expiresAt > Date.now()) return cachedChdvd.value;
  if (pendingChdvd) return pendingChdvd;

  pendingChdvd = calculateChdvdLookThrough()
    .catch(() => null)
    .then((value) => {
      cachedChdvd = { value, expiresAt: Date.now() + LOOK_THROUGH_CACHE_TTL_MS };
      return value;
    })
    .finally(() => { pendingChdvd = null; });
  return pendingChdvd;
}

export async function getEtfLookThroughScores(tickers: string[]): Promise<Map<string, EtfLookThroughScores>> {
  const result = new Map<string, EtfLookThroughScores>();
  if (tickers.some((ticker) => ticker.toUpperCase() === "CHDVD.SW")) {
    const chdvd = await getChdvdLookThroughScores();
    if (chdvd) result.set("CHDVD.SW", chdvd);
  }
  return result;
}
