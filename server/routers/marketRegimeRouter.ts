import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { fetchHistoricalPrices } from "../_core/stockDataApi";
import { ENV } from "../_core/env";
import { apiCache, CACHE_TTL } from "../_core/apiCache";

type RegimeLevel = "bullish" | "neutral" | "bearish";
type EngineResult = {
  label: string;
  score: number;
  level: RegimeLevel;
  description: string;
};

function classify(score: number): RegimeLevel {
  if (score > 0.15) return "bullish";
  if (score < -0.15) return "bearish";
  return "neutral";
}

function labelFromLevel(level: RegimeLevel): string {
  switch (level) {
    case "bullish": return "Bullish";
    case "neutral": return "Neutral";
    case "bearish": return "Bearish";
  }
}

/**
 * Trend Engine: S&P 500 vs 200DMA, 50/200 Cross, 12M Momentum
 */
async function calculateTrendEngine(): Promise<EngineResult> {
  try {
    const prices = await fetchHistoricalPrices('GSPC.INDX', 2);
    if (!prices || prices.length < 200) {
      return { label: "Ungenügend Daten", score: 0, level: "neutral", description: "Weniger als 200 Tage Daten" };
    }

    const closes = prices.map((p: any) => p.close);
    const current = closes[closes.length - 1];
    
    // 200 DMA
    const dma200 = closes.slice(-200).reduce((a: number, b: number) => a + b, 0) / 200;
    const dma50 = closes.slice(-50).reduce((a: number, b: number) => a + b, 0) / 50;
    
    // Signals
    const aboveDma200 = current > dma200 ? 0.4 : -0.4;
    const goldenCross = dma50 > dma200 ? 0.3 : -0.3;
    
    // 12M Momentum
    const price12mAgo = closes.length >= 252 ? closes[closes.length - 252] : closes[0];
    const momentum12m = (current - price12mAgo) / price12mAgo;
    const momentumSignal = Math.max(-0.3, Math.min(0.3, momentum12m));
    
    const score = Math.max(-1, Math.min(1, aboveDma200 + goldenCross + momentumSignal));
    const level = classify(score);
    
    const pctAbove200 = ((current / dma200 - 1) * 100).toFixed(1);
    const desc = `S&P 500 ${Number(pctAbove200) >= 0 ? '+' : ''}${pctAbove200}% über 200DMA | ${dma50 > dma200 ? 'Golden Cross' : 'Death Cross'} | 12M: ${(momentum12m * 100).toFixed(1)}%`;
    
    return { label: labelFromLevel(level), score, level, description: desc };
  } catch (e) {
    console.error('[MarketRegime] Trend engine error:', e);
    return { label: "Fehler", score: 0, level: "neutral", description: "Datenabruf fehlgeschlagen" };
  }
}

/**
 * Breadth Engine: RSP/SPY ratio as proxy for market breadth
 */
async function calculateBreadthEngine(): Promise<EngineResult> {
  try {
    const [rspPrices, spyPrices] = await Promise.all([
      fetchHistoricalPrices('RSP.US', 1),
      fetchHistoricalPrices('SPY.US', 1),
    ]);
    
    if (!rspPrices || !spyPrices || rspPrices.length < 20 || spyPrices.length < 20) {
      return { label: "Ungenügend Daten", score: 0, level: "neutral", description: "Weniger als 20 Tage Daten" };
    }

    const rspCloses = rspPrices.map((p: any) => p.close);
    const spyCloses = spyPrices.map((p: any) => p.close);
    
    const rsp1m = (rspCloses[rspCloses.length - 1] - rspCloses[rspCloses.length - 21]) / rspCloses[rspCloses.length - 21];
    const spy1m = (spyCloses[spyCloses.length - 1] - spyCloses[spyCloses.length - 21]) / spyCloses[spyCloses.length - 21];
    
    // If RSP outperforms SPY, breadth is healthy (bullish)
    const breadthDiff = rsp1m - spy1m;
    const score = Math.max(-1, Math.min(1, breadthDiff * 15));
    const level = classify(score);
    
    const desc = `RSP 1M: ${(rsp1m * 100).toFixed(1)}% | SPY 1M: ${(spy1m * 100).toFixed(1)}% | Breadth ${breadthDiff > 0 ? 'gesund' : 'schwach'}`;
    
    return { label: labelFromLevel(level), score, level, description: desc };
  } catch (e) {
    console.error('[MarketRegime] Breadth engine error:', e);
    return { label: "Fehler", score: 0, level: "neutral", description: "Datenabruf fehlgeschlagen" };
  }
}

/**
 * Volatility/Risk Engine: VIX level and trend
 */
async function calculateVolatilityEngine(): Promise<EngineResult> {
  try {
    const prices = await fetchHistoricalPrices('VIX.INDX', 1);
    
    if (!prices || prices.length < 20) {
      return { label: "Ungenügend Daten", score: 0, level: "neutral", description: "Weniger als 20 Tage VIX-Daten" };
    }

    const closes = prices.map((p: any) => p.close);
    const currentVix = closes[closes.length - 1];
    const avg20 = closes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20;
    
    // VIX level signal (inverted: low VIX = bullish)
    let levelSignal = 0;
    if (currentVix < 15) levelSignal = 0.5;
    else if (currentVix < 20) levelSignal = 0.2;
    else if (currentVix < 25) levelSignal = -0.1;
    else if (currentVix < 30) levelSignal = -0.3;
    else levelSignal = -0.6;
    
    // VIX trend (rising VIX = bearish)
    const vixTrend = (currentVix - avg20) / avg20;
    const trendSignal = Math.max(-0.4, Math.min(0.4, -vixTrend * 5));
    
    const score = Math.max(-1, Math.min(1, levelSignal + trendSignal));
    const level = classify(score);
    
    const desc = `VIX: ${currentVix.toFixed(1)} | 20D-Avg: ${avg20.toFixed(1)} | ${currentVix < avg20 ? 'Fallend' : 'Steigend'}`;
    
    return { label: labelFromLevel(level), score, level, description: desc };
  } catch (e) {
    console.error('[MarketRegime] Volatility engine error:', e);
    return { label: "Fehler", score: 0, level: "neutral", description: "Datenabruf fehlgeschlagen" };
  }
}

/**
 * Liquidity Engine: TLT (bonds) and UUP (dollar) as proxies
 */
async function calculateLiquidityEngine(): Promise<EngineResult> {
  try {
    const [tltPrices, uupPrices] = await Promise.all([
      fetchHistoricalPrices('TLT.US', 1),
      fetchHistoricalPrices('UUP.US', 1),
    ]);
    
    let tltSignal = 0;
    if (tltPrices && tltPrices.length >= 50) {
      const tltCloses = tltPrices.map((p: any) => p.close);
      const tlt1m = (tltCloses[tltCloses.length - 1] - tltCloses[tltCloses.length - 21]) / tltCloses[tltCloses.length - 21];
      tltSignal = Math.max(-1, Math.min(1, tlt1m * 10));
    }

    let dollarSignal = 0;
    if (uupPrices && uupPrices.length >= 50) {
      const uupCloses = uupPrices.map((p: any) => p.close);
      const uup1m = (uupCloses[uupCloses.length - 1] - uupCloses[uupCloses.length - 21]) / uupCloses[uupCloses.length - 21];
      dollarSignal = Math.max(-1, Math.min(1, -uup1m * 10));
    }

    const score = Math.max(-1, Math.min(1, (tltSignal * 0.6 + dollarSignal * 0.4)));
    const level = classify(score);
    
    const desc = `TLT-Signal: ${tltSignal > 0 ? '+' : ''}${(tltSignal * 100).toFixed(0)}% | USD-Signal: ${dollarSignal > 0 ? '+' : ''}${(dollarSignal * 100).toFixed(0)}%`;
    
    return { label: labelFromLevel(level), score, level, description: desc };
  } catch (e) {
    console.error('[MarketRegime] Liquidity engine error:', e);
    return { label: "Fehler", score: 0, level: "neutral", description: "Datenabruf fehlgeschlagen" };
  }
}

/**
 * Credit/Stress Engine: HYG/LQD ratio as credit spread proxy
 */
async function calculateCreditEngine(): Promise<EngineResult> {
  try {
    const [hygPrices, lqdPrices] = await Promise.all([
      fetchHistoricalPrices('HYG.US', 1),
      fetchHistoricalPrices('LQD.US', 1),
    ]);
    
    if (!hygPrices || !lqdPrices || hygPrices.length < 20 || lqdPrices.length < 20) {
      return { label: "Ungenügend Daten", score: 0, level: "neutral", description: "Weniger als 20 Tage Daten" };
    }

    const hygCloses = hygPrices.map((p: any) => p.close);
    const lqdCloses = lqdPrices.map((p: any) => p.close);
    
    // HYG/LQD ratio: rising = tightening spreads = bullish
    const currentRatio = hygCloses[hygCloses.length - 1] / lqdCloses[lqdCloses.length - 1];
    const ratio20dAgo = hygCloses[hygCloses.length - 21] / lqdCloses[lqdCloses.length - 21];
    
    const ratioChange = (currentRatio - ratio20dAgo) / ratio20dAgo;
    const score = Math.max(-1, Math.min(1, ratioChange * 30));
    const level = classify(score);
    
    const desc = `HYG/LQD Ratio: ${currentRatio.toFixed(3)} | 20D-Trend: ${ratioChange > 0 ? 'Spreads tightening' : 'Spreads widening'}`;
    
    return { label: labelFromLevel(level), score, level, description: desc };
  } catch (e) {
    console.error('[MarketRegime] Credit engine error:', e);
    return { label: "Fehler", score: 0, level: "neutral", description: "Datenabruf fehlgeschlagen" };
  }
}

/**
 * Sentiment Engine: Risikoappetit via XLY/XLP-Ratio (zyklischer Konsum vs.
 * Basiskonsum).
 *
 * SIG-8 (Audit 2026-07): Vorher war das Sentiment ein VIX-Z-Score — damit
 * hingen 25 % des Gesamtscores doppelt am VIX (Volatility-Engine 20 % +
 * Sentiment 5 %, teils gegenläufig interpretiert). Die XLY/XLP-Relative-
 * Stärke ist ein etablierter, VIX-unabhängiger Risk-On/Risk-Off-Indikator:
 * steigt zyklischer Konsum relativ zu defensivem Basiskonsum, sind Anleger
 * risikofreudig (bullish) — und umgekehrt.
 */
async function calculateSentimentEngine(): Promise<EngineResult> {
  try {
    const [xly, xlp] = await Promise.all([
      fetchHistoricalPrices('XLY.US', 1),
      fetchHistoricalPrices('XLP.US', 1),
    ]);

    if (!xly || !xlp || xly.length < 60 || xlp.length < 60) {
      return { label: "Ungenügend Daten", score: 0, level: "neutral", description: "Weniger als 60 Tage XLY/XLP-Daten" };
    }

    // Ratio-Serie über die letzten gemeinsamen Handelstage (beide US-Kalender).
    const len = Math.min(xly.length, xlp.length);
    const ratios: number[] = [];
    for (let i = 0; i < len; i++) {
      const y = xly[xly.length - len + i]?.close;
      const p = xlp[xlp.length - len + i]?.close;
      if (y > 0 && p > 0) ratios.push(y / p);
    }
    if (ratios.length < 60) {
      return { label: "Ungenügend Daten", score: 0, level: "neutral", description: "Zu wenige gültige XLY/XLP-Kurse" };
    }

    const current = ratios[ratios.length - 1];
    const avg50 = ratios.slice(-50).reduce((a, b) => a + b, 0) / 50;
    const prev20 = ratios[ratios.length - 21] ?? current;

    // Niveau vs. 50-Tage-Schnitt (±3 % ≈ ±0.3) + 20-Tage-Trend (±2 % ≈ ±0.2),
    // je begrenzt — Gesamtscore in [-0.5, 0.5].
    const levelSignal = Math.max(-0.3, Math.min(0.3, (current / avg50 - 1) * 10));
    const trendSignal = Math.max(-0.2, Math.min(0.2, (current / prev20 - 1) * 10));
    const score = levelSignal + trendSignal;

    const level = classify(score);
    const desc = `Risikoappetit (XLY/XLP): ${current.toFixed(2)} | 50T-Schnitt: ${avg50.toFixed(2)} | ${score > 0.15 ? 'Risk-On' : score < -0.15 ? 'Defensiv' : 'Neutral'}`;

    return { label: labelFromLevel(level), score, level, description: desc };
  } catch (e) {
    console.error('[MarketRegime] Sentiment engine error:', e);
    return { label: "Fehler", score: 0, level: "neutral", description: "Datenabruf fehlgeschlagen" };
  }
}

/**
 * Bubble/LPPL Engine: Uses our existing LPPLS BubbleScore
 */
async function calculateBubbleEngine(): Promise<EngineResult> {
  try {
    const prices = await fetchHistoricalPrices('GSPC.INDX', 2);
    
    if (!prices || prices.length < 250) {
      return { label: "Ungenügend Daten", score: 0, level: "neutral", description: "Weniger als 250 Tage Daten" };
    }

    const { detectBubble } = await import("../analytics/lpplsEngine");
    const priceData = prices.map((p: any) => p.close);
    
    const result = detectBubble({ prices: priceData, sentimentScore: 0 });
    
    // BubbleScore > 0 means bubble detected (bearish for market)
    const score = -result.bubbleScore; // Invert: bubble = bearish
    const level = classify(score);
    
    let desc = `LPPLS Confidence: ${(result.bubbleConfidence * 100).toFixed(0)}%`;
    if (result.bubbleScore > 0.5) desc += " | Bubble-Warnung!";
    else if (result.bubbleScore > 0.2) desc += " | Erhöhtes Risiko";
    else desc += " | Normal";
    
    return { label: labelFromLevel(level), score, level, description: desc };
  } catch (e) {
    console.error('[MarketRegime] Bubble engine error:', e);
    return { label: "Fehler", score: 0, level: "neutral", description: "Berechnung fehlgeschlagen" };
  }
}

// Weights for each engine
const ENGINE_WEIGHTS = {
  trend: 0.30,
  breadth: 0.15,
  volatility: 0.20,
  liquidity: 0.15,
  credit: 0.10,
  sentiment: 0.05,
  bubble: 0.05,
};

/**
 * Sector Performance: Fetch performance data for sector ETFs
 */
async function fetchSectorPerformance(): Promise<Array<{
  sector: string;
  etf: string;
  performance1d: number;
  performance1w: number;
  performance1m: number;
  performanceYtd: number;
  currentPrice: number;
}>> {
  const sectorETFs = [
    { sector: 'Technologie', etf: 'XLK.US' },
    { sector: 'Gesundheit', etf: 'XLV.US' },
    { sector: 'Finanzen', etf: 'XLF.US' },
    { sector: 'Konsumgüter (zyklisch)', etf: 'XLY.US' },
    { sector: 'Konsumgüter (defensiv)', etf: 'XLP.US' },
    { sector: 'Industrie', etf: 'XLI.US' },
    { sector: 'Energie', etf: 'XLE.US' },
    { sector: 'Versorger', etf: 'XLU.US' },
    { sector: 'Immobilien', etf: 'XLRE.US' },
    { sector: 'Materialien', etf: 'XLB.US' },
    { sector: 'Kommunikation', etf: 'XLC.US' },
  ];

  const results = await Promise.allSettled(
    sectorETFs.map(async ({ sector, etf }) => {
      const prices = await fetchHistoricalPrices(etf, 1);
      if (!prices || prices.length < 22) {
        return { sector, etf, performance1d: 0, performance1w: 0, performance1m: 0, performanceYtd: 0, currentPrice: 0 };
      }

      const closes = prices.map((p: any) => p.close);
      const current = closes[closes.length - 1];
      const prev1d = closes.length > 1 ? closes[closes.length - 2] : current;
      const prev1w = closes.length > 5 ? closes[closes.length - 6] : closes[0];
      const prev1m = closes.length > 22 ? closes[closes.length - 23] : closes[0];
      
      // YTD: find first trading day of current year
      const now = new Date();
      const yearStart = new Date(now.getFullYear(), 0, 1);
      let ytdStart = closes[0];
      for (let i = 0; i < prices.length; i++) {
        const d = new Date(prices[i].date);
        if (d >= yearStart) { ytdStart = prices[i].close; break; }
      }

      return {
        sector,
        etf,
        performance1d: current && prev1d ? ((current - prev1d) / prev1d) * 100 : 0,
        performance1w: current && prev1w ? ((current - prev1w) / prev1w) * 100 : 0,
        performance1m: current && prev1m ? ((current - prev1m) / prev1m) * 100 : 0,
        performanceYtd: current && ytdStart ? ((current - ytdStart) / ytdStart) * 100 : 0,
        currentPrice: current || 0,
      };
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
    .map(r => r.value);
}

export const marketRegimeRouter = router({
  sectorPerformance: publicProcedure.query(async () => {
    const cacheKey = "marketRegime:sectorPerformance";
    const cached = apiCache.get<Awaited<ReturnType<typeof fetchSectorPerformance>>>(cacheKey);
    if (cached) return cached;
    const result = await fetchSectorPerformance();
    apiCache.set(cacheKey, result, CACHE_TTL.QUOTE);
    return result;
  }),

  // Markt-Hub Überblick (Mockup S.13): Index-KPIs (SMI / S&P 500 / MSCI World / Gold)
  // + normalisierte YTD-Performance-Serie für das "Indizes Performance YTD"-Chart.
  // Echte Indexpunkte via EODHD (SSMI.INDX=SMI, GSPC.INDX=S&P 500, URTH.US=MSCI World ETF, GLD.US=Gold ETF).
  getIndices: publicProcedure.query(async () => {
    const cacheKey = "marketRegime:getIndices";
    const cachedIndices = apiCache.get<{ indices: any[]; chart: any[]; asOf: string }>(cacheKey);
    if (cachedIndices) return cachedIndices;

    const EODHD_API_KEY = ENV.eodhdApiKey;
    const EODHD_BASE_URL = "https://eodhd.com/api";

    const today = new Date();
    const ytdStart = `${today.getFullYear()}-01-01`;
    const todayStr = today.toISOString().split("T")[0];

    const summarize = (rows: { date: string; close: any }[]) => {
      const series = rows
        .map((r) => ({ date: r.date, close: parseFloat(String(r.close)) }))
        .filter((r) => r.close > 0);
      if (series.length === 0) return null;
      const first = series[0].close;
      const last = series[series.length - 1].close;
      const prev = series.length > 1 ? series[series.length - 2].close : last;
      return {
        value: last,
        dayChange: prev > 0 ? ((last - prev) / prev) * 100 : 0,
        ytd: first > 0 ? ((last - first) / first) * 100 : 0,
        series,
      };
    };

    // Fetch historical EOD data from EODHD for real index points
    const fetchEodhdHistory = async (ticker: string): Promise<{ date: string; close: number }[]> => {
      if (!EODHD_API_KEY) return [];
      try {
        const url = `${EODHD_BASE_URL}/eod/${ticker}?api_token=${EODHD_API_KEY}&from=${ytdStart}&to=${todayStr}&fmt=json&period=d`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json() as Array<{ date: string; close: number; adjusted_close: number }>;
        if (!Array.isArray(data)) return [];
        return data.map(d => ({ date: d.date, close: d.adjusted_close || d.close }));
      } catch {
        return [];
      }
    };

    // Real index tickers on EODHD
    const indexKeys: { key: string; label: string; eodhdTicker: string; currency: string }[] = [
      { key: "smi",     label: "SPI",        eodhdTicker: "SSMI.INDX",  currency: "CHF" },
      { key: "sp500",   label: "S&P 500",    eodhdTicker: "GSPC.INDX",  currency: "USD" },
      { key: "msci",    label: "MSCI World", eodhdTicker: "ACWI.US",    currency: "USD" },
      { key: "nasdaq",  label: "NASDAQ",     eodhdTicker: "IXIC.INDX",  currency: "USD" },
      { key: "sox",     label: "SOX",        eodhdTicker: "SOXX.US",    currency: "USD" },
      { key: "gold",    label: "GOLD",       eodhdTicker: "GLD.US",     currency: "USD" },
      { key: "btc",     label: "BTC",        eodhdTicker: "BTC-USD.CC", currency: "USD" },
    ];

    const results = await Promise.all(
      indexKeys.map(async (b) => {
        const rows = await fetchEodhdHistory(b.eodhdTicker);
        return { ...b, summary: summarize(rows) };
      })
    );

    // Fallback to DB proxy tickers if EODHD failed
    const { getBenchmarkData, getDb } = await import("../db");
    const { historicalPrices } = await import("../../drizzle/schema");
    const { eq, gte, asc, and } = await import("drizzle-orm");
    const db = await getDb();

    const finalResults = await Promise.all(
      results.map(async (r) => {
        if (r.summary) return r;
        // Fallback for SMI/SP500/MSCI
        if (r.key === "smi") {
          const rows = (await getBenchmarkData("SMI", ytdStart, todayStr)) as any;
          return { ...r, summary: summarize(rows) };
        }
        if (r.key === "sp500") {
          const rows = (await getBenchmarkData("SP500", ytdStart, todayStr)) as any;
          return { ...r, summary: summarize(rows) };
        }
        if (r.key === "msci") {
          const rows = (await getBenchmarkData("MSCI_WORLD", ytdStart, todayStr)) as any;
          return { ...r, summary: summarize(rows) };
        }
        // Fallback for gold: try DB
        if (r.key === "gold" && db) {
          for (const t of ["GLD", "GC=F", "GOLD", "XAUUSD", "IAU"]) {
            const rows = await db
              .select()
              .from(historicalPrices)
              .where(and(eq(historicalPrices.ticker, t), gte(historicalPrices.date, ytdStart)))
              .orderBy(asc(historicalPrices.date));
            const s = summarize(rows as any);
            if (s) return { ...r, summary: s };
          }
        }
        return r;
      })
    );

    const indices = finalResults.map((b) =>
      b.summary
        ? { key: b.key, label: b.label, currency: b.currency, value: b.summary.value, dayChange: +b.summary.dayChange.toFixed(2), ytd: +b.summary.ytd.toFixed(2), series: b.summary.series.slice(-20) }
        : { key: b.key, label: b.label, currency: b.currency, value: null, dayChange: null, ytd: null, series: [] as { date: string; close: number }[] }
    );

    // Merge YTD-normalisierte Serien (wöchentlich gesampelt) für das Chart
    const smiResult  = finalResults.find((b) => b.key === "smi");
    const spResult   = finalResults.find((b) => b.key === "sp500");
    const msciResult = finalResults.find((b) => b.key === "msci");

    const dateSet = new Set<string>();
    [smiResult, spResult, msciResult].forEach((b) => b?.summary?.series.forEach((p) => dateSet.add(p.date)));
    const dates = Array.from(dateSet).sort();
    const interval = Math.max(1, Math.floor(dates.length / 52));
    const sampled = dates.filter((_, i) => i % interval === 0 || i === dates.length - 1);

    const norm = (series?: { date: string; close: number }[]) => {
      if (!series || series.length === 0) return null;
      const base = series[0].close;
      const map: Record<string, number> = {};
      series.forEach((p) => { map[p.date] = base > 0 ? ((p.close - base) / base) * 100 : 0; });
      return map;
    };
    const smiMap  = norm(smiResult?.summary?.series);
    const spMap   = norm(spResult?.summary?.series);
    const msciMap = norm(msciResult?.summary?.series);

    let lastSmi = 0, lastSp = 0, lastMsci = 0;
    const chart = sampled.map((d) => {
      if (smiMap  && smiMap[d]  !== undefined) lastSmi  = smiMap[d];
      if (spMap   && spMap[d]   !== undefined) lastSp   = spMap[d];
      if (msciMap && msciMap[d] !== undefined) lastMsci = msciMap[d];
      return { date: d, smi: +lastSmi.toFixed(2), sp500: +lastSp.toFixed(2), msci: +lastMsci.toFixed(2) };
    });

    const payload = { indices, chart, asOf: todayStr };
    apiCache.set(cacheKey, payload, CACHE_TTL.QUOTE);
    return payload;
  }),

  getRegime: publicProcedure.query(async () => {
    const cacheKey = "marketRegime:getRegime";
    const cached = apiCache.get<Awaited<ReturnType<typeof computeRegime>>>(cacheKey);
    if (cached) return cached;
    const result = await computeRegime();
    apiCache.set(cacheKey, result, CACHE_TTL.QUOTE);
    return result;
  }),

  // Regime-Verlauf (R4): letzte `days` Handelstage des Gesamt-Scores für die
  // Sparkline. Fehlertolerant — fehlt die Tabelle (noch nicht migriert) oder die
  // DB, kommt eine leere Serie zurück und die UI zeigt einen ehrlichen Hinweis.
  getHistory: publicProcedure
    .input(z.object({ days: z.number().int().min(7).max(365).default(90) }).optional())
    .query(async ({ input }) => {
      const days = input?.days ?? 90;
      try {
        const { getDb } = await import("../db");
        const { marketRegimeHistory } = await import("../../drizzle/schema");
        const { gte, asc } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) return { points: [] as RegimeHistoryPoint[] };

        const cutoff = new Date();
        cutoff.setUTCDate(cutoff.getUTCDate() - days);
        const cutoffStr = cutoff.toISOString().split("T")[0];

        const rows = await db
          .select()
          .from(marketRegimeHistory)
          .where(gte(marketRegimeHistory.date, cutoffStr))
          .orderBy(asc(marketRegimeHistory.date));

        const points: RegimeHistoryPoint[] = rows.map((r: any) => ({
          date: r.date,
          score: parseFloat(String(r.overallScore)),
          regime: r.regime,
        }));
        return { points };
      } catch (e) {
        console.warn("[MarketRegime] getHistory failed:", (e as Error).message);
        return { points: [] as RegimeHistoryPoint[] };
      }
    }),

  /** MSCI-Faktor-ETF Performance (IWVL, IWMO, IWQU, MVOL, WSML) */
  getFactorETFs: publicProcedure
    .input(z.object({ period: z.enum(["ytd", "1y", "3y", "5y"]).default("ytd") }))
    .query(async ({ input }) => {
      const EODHD_API_KEY = process.env.EODHD_API_KEY;
      if (!EODHD_API_KEY) return { factors: [], chart: [] };

      const FACTORS = [
        { key: "value",    label: "Value",          ticker: "IWVL.LSE",  color: "#f59e0b" },
        { key: "momentum", label: "Momentum",       ticker: "IWMO.LSE",  color: "#8b5cf6" },
        { key: "quality",  label: "Quality",        ticker: "IWQU.LSE",  color: "#00CFC1" },
        { key: "minvol",   label: "Min Volatility", ticker: "MVOL.LSE",  color: "#3b82f6" },
        { key: "smallcap", label: "Small Cap",      ticker: "WSML.LSE",  color: "#ec4899" },
      ];

      const today = new Date();
      let fromDate: Date;
      if (input.period === "ytd") {
        fromDate = new Date(today.getFullYear(), 0, 1);
      } else if (input.period === "1y") {
        fromDate = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
      } else if (input.period === "3y") {
        fromDate = new Date(today.getTime() - 3 * 365 * 24 * 60 * 60 * 1000);
      } else {
        fromDate = new Date(today.getTime() - 5 * 365 * 24 * 60 * 60 * 1000);
      }
      const from = fromDate.toISOString().split("T")[0];
      const to = today.toISOString().split("T")[0];

      const results = await Promise.allSettled(
        FACTORS.map(async (f) => {
          const url = `https://eodhd.com/api/eod/${f.ticker}?api_token=${EODHD_API_KEY}&from=${from}&to=${to}&fmt=json&period=d`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data: Array<{ date: string; adjusted_close: number; close: number }> = await res.json();
          if (!Array.isArray(data) || data.length === 0) throw new Error("No data");
          const prices = data.map(d => ({ date: d.date, price: d.adjusted_close ?? d.close }));
          const first = prices[0].price;
          const last = prices[prices.length - 1].price;
          const totalReturn = ((last - first) / first) * 100;
          const normalised = prices.map(p => ({ date: p.date, [f.key]: parseFloat(((p.price / first) * 100 - 100).toFixed(3)) }));
          return { ...f, totalReturn: parseFloat(totalReturn.toFixed(2)), latestPrice: parseFloat(last.toFixed(4)), normalised };
        })
      );

      const factors = results
        .map((r, i) => r.status === "fulfilled" ? r.value : { ...FACTORS[i], totalReturn: null as number | null, latestPrice: null as number | null, normalised: [] as Array<Record<string, number | string>> })
        .filter(f => f.normalised.length > 0);

      // Merge all normalised series into a single chart array keyed by date
      const dateMap = new Map<string, Record<string, number>>();
      for (const f of factors) {
        for (const pt of f.normalised) {
          const existing = dateMap.get(pt.date as string) ?? {};
          const val = pt[f.key];
          if (typeof val === "number") existing[f.key] = val;
          dateMap.set(pt.date as string, existing);
        }
      }
      const chart = Array.from(dateMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, vals]) => ({ date, ...vals }));

      return {
        factors: factors.map(f => ({ key: f.key, label: f.label, color: f.color, totalReturn: f.totalReturn, latestPrice: f.latestPrice })),
        chart,
      };
    }),
});

export type RegimeHistoryPoint = { date: string; score: number; regime: string };

/**
 * Berechnet das aktuelle Gesamt-Regime aus allen sieben Engines.
 * Geteilt von `getRegime` (Live-Query) und `recordRegimeSnapshot` (Cron).
 */
export async function computeRegime() {
  const [trend, breadth, volatility, liquidity, credit, sentiment, bubble] = await Promise.all([
    calculateTrendEngine(),
    calculateBreadthEngine(),
    calculateVolatilityEngine(),
    calculateLiquidityEngine(),
    calculateCreditEngine(),
    calculateSentimentEngine(),
    calculateBubbleEngine(),
  ]);

  const overallScore =
    trend.score * ENGINE_WEIGHTS.trend +
    breadth.score * ENGINE_WEIGHTS.breadth +
    volatility.score * ENGINE_WEIGHTS.volatility +
    liquidity.score * ENGINE_WEIGHTS.liquidity +
    credit.score * ENGINE_WEIGHTS.credit +
    sentiment.score * ENGINE_WEIGHTS.sentiment +
    bubble.score * ENGINE_WEIGHTS.bubble;

  let overallRegime: string;
  let equityAllocation: number;
  let regimeMultiplier: number;

  if (overallScore > 0.25) {
    overallRegime = "Risk-On";
    equityAllocation = 80;
    regimeMultiplier = 1.2;
  } else if (overallScore > -0.1) {
    overallRegime = "Neutral";
    equityAllocation = 60;
    regimeMultiplier = 1.0;
  } else if (overallScore > -0.4) {
    overallRegime = "Defensive";
    equityAllocation = 40;
    regimeMultiplier = 0.7;
  } else {
    overallRegime = "Risk-Off";
    equityAllocation = 20;
    regimeMultiplier = 0.3;
  }

  return {
    overallRegime,
    overallScore,
    equityAllocation,
    regimeMultiplier,
    engines: { trend, breadth, volatility, liquidity, credit, sentiment, bubble },
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Persistiert einen Tages-Snapshot des Regimes (Upsert per UTC-Datum).
 * Aufgerufen vom regimeHistoryCron. Fehlertolerant: fehlt DB/Tabelle, No-op.
 */
export async function recordRegimeSnapshot(): Promise<{ recorded: boolean; date: string; score: number }> {
  const regime = await computeRegime();
  const date = new Date().toISOString().split("T")[0];
  try {
    const { getDb } = await import("../db");
    const { marketRegimeHistory } = await import("../../drizzle/schema");
    const db = await getDb();
    if (!db) return { recorded: false, date, score: regime.overallScore };

    const engineScores = Object.fromEntries(
      Object.entries(regime.engines).map(([k, v]) => [k, +v.score.toFixed(4)]),
    );
    const values = {
      date,
      overallScore: regime.overallScore.toFixed(4),
      regime: regime.overallRegime,
      equityAllocation: regime.equityAllocation,
      regimeMultiplier: regime.regimeMultiplier.toFixed(2),
      engineScores,
    };
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
    return { recorded: true, date, score: regime.overallScore };
  } catch (e) {
    console.warn("[MarketRegime] recordRegimeSnapshot failed:", (e as Error).message);
    return { recorded: false, date, score: regime.overallScore };
  }
}
