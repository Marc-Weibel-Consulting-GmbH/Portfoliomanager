/**
 * Backfill script: Computes historical Markt-Regime scores for the past 90 days
 * and inserts them into market_regime_history.
 *
 * Strategy: Fetch 2 years of price data for all required tickers once,
 * then for each trading day in the last 90 days, slice the data up to that
 * date and compute the regime score using the same engine logic.
 *
 * Run: npx tsx server/scripts/backfillRegimeHistory.ts
 */

import { drizzle } from "drizzle-orm/mysql2";
import { marketRegimeHistory } from "../../drizzle/schema";

const EODHD_API_KEY = process.env.EODHD_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!EODHD_API_KEY) throw new Error("EODHD_API_KEY not set");
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");

const db = drizzle(DATABASE_URL);

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchEodhdFull(ticker: string): Promise<{ date: string; close: number }[]> {
  const to = new Date().toISOString().split("T")[0];
  const from = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const url = `https://eodhd.com/api/eod/${ticker}?api_token=${EODHD_API_KEY}&from=${from}&to=${to}&fmt=json&period=d`;
  const res = await fetch(url);
  if (!res.ok) { console.warn(`[backfill] ${ticker} → HTTP ${res.status}`); return []; }
  const data = await res.json() as Array<{ date: string; close: number; adjusted_close?: number }>;
  if (!Array.isArray(data)) return [];
  return data.map(d => ({ date: d.date, close: d.adjusted_close ?? d.close }));
}

/** Slice series to only include rows up to (and including) targetDate */
function sliceTo(series: { date: string; close: number }[], targetDate: string) {
  return series.filter(r => r.date <= targetDate);
}

function classify(score: number): "bullish" | "neutral" | "bearish" {
  if (score > 0.15) return "bullish";
  if (score < -0.15) return "bearish";
  return "neutral";
}

// ─── Engine implementations (date-sliced versions) ────────────────────────────

function calcTrend(prices: { date: string; close: number }[]): number {
  const closes = prices.map(p => p.close);
  if (closes.length < 200) return 0;
  const current = closes[closes.length - 1];
  const dma200 = closes.slice(-200).reduce((a, b) => a + b, 0) / 200;
  const dma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / 50;
  const aboveDma200 = current > dma200 ? 0.4 : -0.4;
  const goldenCross = dma50 > dma200 ? 0.3 : -0.3;
  const price12mAgo = closes.length >= 252 ? closes[closes.length - 252] : closes[0];
  const momentum12m = (current - price12mAgo) / price12mAgo;
  const momentumSignal = Math.max(-0.3, Math.min(0.3, momentum12m));
  return Math.max(-1, Math.min(1, aboveDma200 + goldenCross + momentumSignal));
}

function calcBreadth(rsp: { date: string; close: number }[], spy: { date: string; close: number }[]): number {
  if (rsp.length < 21 || spy.length < 21) return 0;
  const rspC = rsp.map(p => p.close);
  const spyC = spy.map(p => p.close);
  const rsp1m = (rspC[rspC.length - 1] - rspC[rspC.length - 21]) / rspC[rspC.length - 21];
  const spy1m = (spyC[spyC.length - 1] - spyC[spyC.length - 21]) / spyC[spyC.length - 21];
  return Math.max(-1, Math.min(1, (rsp1m - spy1m) * 15));
}

function calcVolatility(vix: { date: string; close: number }[]): number {
  if (vix.length < 20) return 0;
  const closes = vix.map(p => p.close);
  const currentVix = closes[closes.length - 1];
  const avg20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  let levelSignal = 0;
  if (currentVix < 15) levelSignal = 0.5;
  else if (currentVix < 20) levelSignal = 0.2;
  else if (currentVix < 25) levelSignal = -0.1;
  else if (currentVix < 30) levelSignal = -0.3;
  else levelSignal = -0.6;
  const vixTrend = (currentVix - avg20) / avg20;
  const trendSignal = Math.max(-0.4, Math.min(0.4, -vixTrend * 5));
  return Math.max(-1, Math.min(1, levelSignal + trendSignal));
}

function calcLiquidity(tlt: { date: string; close: number }[], uup: { date: string; close: number }[]): number {
  let tltSignal = 0;
  if (tlt.length >= 21) {
    const c = tlt.map(p => p.close);
    const tlt1m = (c[c.length - 1] - c[c.length - 21]) / c[c.length - 21];
    tltSignal = Math.max(-1, Math.min(1, tlt1m * 10));
  }
  let dollarSignal = 0;
  if (uup.length >= 21) {
    const c = uup.map(p => p.close);
    const uup1m = (c[c.length - 1] - c[c.length - 21]) / c[c.length - 21];
    dollarSignal = Math.max(-1, Math.min(1, -uup1m * 10));
  }
  return Math.max(-1, Math.min(1, tltSignal * 0.6 + dollarSignal * 0.4));
}

function calcCredit(hyg: { date: string; close: number }[], lqd: { date: string; close: number }[]): number {
  if (hyg.length < 21 || lqd.length < 21) return 0;
  const hygC = hyg.map(p => p.close);
  const lqdC = lqd.map(p => p.close);
  const currentRatio = hygC[hygC.length - 1] / lqdC[lqdC.length - 1];
  const ratio20dAgo = hygC[hygC.length - 21] / lqdC[lqdC.length - 21];
  const ratioChange = (currentRatio - ratio20dAgo) / ratio20dAgo;
  return Math.max(-1, Math.min(1, ratioChange * 30));
}

function calcSentiment(vix: { date: string; close: number }[]): number {
  if (vix.length < 60) return 0;
  const closes = vix.map(p => p.close);
  const currentVix = closes[closes.length - 1];
  const mean = closes.reduce((a, b) => a + b, 0) / closes.length;
  const std = Math.sqrt(closes.reduce((a, b) => a + (b - mean) ** 2, 0) / closes.length);
  const zScore = std > 0 ? (currentVix - mean) / std : 0;
  if (zScore > 2) return 0.6;
  if (zScore > 1) return 0.3;
  if (zScore < -1.5) return -0.4;
  if (zScore < -0.5) return -0.2;
  return 0;
}

const WEIGHTS = { trend: 0.30, breadth: 0.15, volatility: 0.20, liquidity: 0.15, credit: 0.10, sentiment: 0.05, bubble: 0.05 };

function computeScore(engines: Record<string, number>): number {
  const score =
    engines.trend * WEIGHTS.trend +
    engines.breadth * WEIGHTS.breadth +
    engines.volatility * WEIGHTS.volatility +
    engines.liquidity * WEIGHTS.liquidity +
    engines.credit * WEIGHTS.credit +
    engines.sentiment * WEIGHTS.sentiment +
    (engines.bubble ?? 0) * WEIGHTS.bubble;
  return Math.max(-1, Math.min(1, score));
}

function equityAllocation(score: number): number {
  if (score > 0.5) return 90;
  if (score > 0.15) return 80;
  if (score > -0.15) return 70;
  if (score > -0.5) return 55;
  return 40;
}

function regimeMultiplier(score: number): number {
  if (score > 0.5) return 1.3;
  if (score > 0.15) return 1.2;
  if (score > -0.15) return 1.0;
  if (score > -0.5) return 0.8;
  return 0.6;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("[backfill] Fetching price data for all tickers...");
  const [gspc, rsp, spy, vix, tlt, uup, hyg, lqd] = await Promise.all([
    fetchEodhdFull("GSPC.INDX"),
    fetchEodhdFull("RSP.US"),
    fetchEodhdFull("SPY.US"),
    fetchEodhdFull("VIX.INDX"),
    fetchEodhdFull("TLT.US"),
    fetchEodhdFull("UUP.US"),
    fetchEodhdFull("HYG.US"),
    fetchEodhdFull("LQD.US"),
  ]);
  console.log(`[backfill] Data fetched: GSPC=${gspc.length} VIX=${vix.length} RSP=${rsp.length} SPY=${spy.length}`);

  // Collect all trading dates from GSPC over the last 90 days
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const today = new Date().toISOString().split("T")[0];
  const tradingDates = gspc
    .filter(r => r.date >= cutoff && r.date <= today)
    .map(r => r.date);

  console.log(`[backfill] Computing scores for ${tradingDates.length} trading days (from ${tradingDates[0]} to ${tradingDates[tradingDates.length - 1]})...`);

  let inserted = 0;
  let skipped = 0;

  for (const date of tradingDates) {
    // Slice all series to this date
    const gspcSlice = sliceTo(gspc, date);
    const rspSlice = sliceTo(rsp, date);
    const spySlice = sliceTo(spy, date);
    const vixSlice = sliceTo(vix, date);
    const tltSlice = sliceTo(tlt, date);
    const uupSlice = sliceTo(uup, date);
    const hygSlice = sliceTo(hyg, date);
    const lqdSlice = sliceTo(lqd, date);

    if (gspcSlice.length < 200 || vixSlice.length < 60) {
      console.log(`[backfill] ${date}: insufficient data (GSPC=${gspcSlice.length}, VIX=${vixSlice.length}), skipping`);
      skipped++;
      continue;
    }

    const engines = {
      trend:      calcTrend(gspcSlice),
      breadth:    calcBreadth(rspSlice, spySlice),
      volatility: calcVolatility(vixSlice),
      liquidity:  calcLiquidity(tltSlice, uupSlice),
      credit:     calcCredit(hygSlice, lqdSlice),
      sentiment:  calcSentiment(vixSlice),
      bubble:     0, // LPPLS too expensive to backfill; use 0 (neutral)
    };

    const overallScore = computeScore(engines);
    const regime = classify(overallScore);
    const equity = equityAllocation(overallScore);
    const multiplier = regimeMultiplier(overallScore);

    const values = {
      date,
      overallScore: overallScore.toFixed(4),
      regime,
      equityAllocation: equity,
      regimeMultiplier: multiplier.toFixed(2),
      engineScores: Object.fromEntries(Object.entries(engines).map(([k, v]) => [k, +v.toFixed(4)])),
    };

    try {
      await db
        .insert(marketRegimeHistory)
        .values(values)
        .onDuplicateKeyUpdate({
          set: {
            overallScore: values.overallScore,
            regime: values.regime,
            equityAllocation: values.equityAllocation,
            regimeMultiplier: values.regimeMultiplier,
            engineScores: values.engineScores,
          },
        });
      console.log(`[backfill] ${date}: score=${overallScore.toFixed(3)} regime=${regime} equity=${equity}%`);
      inserted++;
    } catch (e: any) {
      console.error(`[backfill] ${date}: DB insert failed: ${e.message}`);
    }
  }

  console.log(`\n[backfill] Done. Inserted/updated: ${inserted}, skipped: ${skipped}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
