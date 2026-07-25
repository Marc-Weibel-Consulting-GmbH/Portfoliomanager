/**
 * Walk-Forward Validation Engine
 * 
 * Implements rolling window walk-forward analysis on a broad stock universe
 * to validate ranking algorithms without overfitting.
 * 
 * Sources:
 * 1. Watchlist stocks (123+ existing tickers)
 * 2. EODHD Screener API (worldwide universe filtered by criteria)
 * 
 * Walk-Forward Process:
 * - Train window: N months of historical data for scoring
 * - Test window: 1 month of out-of-sample forward performance
 * - Roll forward 1 month at a time
 * - Track OOS Alpha, Hit Rate, Sharpe, Overfit Ratio
 */

import { getDb } from "../db";
import { historicalPrices, stocks, walkForwardResults } from "../../drizzle/schema";
import { activeCurated } from "../lib/stockUniverse";
import { eq, and, gte, lte, asc, desc, inArray, sql } from "drizzle-orm";
import { getEodhdApiKey } from "../_core/env";
import { DEFAULT_RISK_FREE_RATE } from "./riskStats";

// A-10: key resolved lazily per call (env with DB-secret fallback)
const EODHD_BASE_URL = "https://eodhd.com/api";

// ============ TYPES ============

export interface ScreeningCriteria {
  region?: string; // US, EU, CH, etc.
  exchange?: string; // NYSE, NASDAQ, LSE, SWX, etc.
  sector?: string; // Technology, Healthcare, etc.
  minMarketCap?: number; // Minimum market cap in millions
  maxMarketCap?: number;
  minScore?: number; // Minimum composite score (0-100)
  targetSharpe?: number; // Target Sharpe ratio
  maxTickers?: number; // Max tickers to select (default 100)
}

export interface WalkForwardConfig {
  trainWindowMonths: number; // e.g. 6
  testWindowMonths: number; // e.g. 1
  topQuartilePercent: number; // e.g. 25 (top 25%)
  universeSource: 'watchlist' | 'screener' | 'combined';
  screeningCriteria?: ScreeningCriteria;
  strategyProfile?: 'shortTerm' | 'midTerm' | 'longTerm';
  quickMode?: boolean; // Only last 36 periods (3 years)
}

export interface WalkForwardPeriodResult {
  periodStart: string;
  periodEnd: string;
  trainStart: string;
  trainEnd: string;
  testStart: string;
  testEnd: string;
  topTickers: string[];
  bottomTickers: string[];
  topReturn: number; // Average return of top quartile
  bottomReturn: number; // Average return of bottom quartile
  benchmarkReturn: number; // SPY return in test period
  alpha: number; // topReturn - benchmarkReturn
  hitRate: number; // % of top tickers that beat benchmark
}

export interface WalkForwardResult {
  id?: number;
  runName: string;
  universeSource: 'watchlist' | 'screener' | 'combined';
  screeningCriteria: ScreeningCriteria | null;
  tickerCount: number;
  tickers: string[];
  trainWindow: number;
  testWindow: number;
  totalPeriods: number;
  oosAlpha: number; // Average OOS alpha across all periods
  oosHitRate: number; // Average OOS hit rate
  oosSharpe: number; // Sharpe of OOS returns
  overfitRatio: number; // IS performance / OOS performance (>2 = likely overfit)
  topPerformers: TopPerformerInfo[];
  periodResults: WalkForwardPeriodResult[];
  status: 'running' | 'completed' | 'failed';
}

export interface TopPerformerInfo {
  ticker: string;
  companyName?: string;
  timesInTopQuartile: number;
  totalPeriods: number;
  consistencyScore: number; // timesInTopQuartile / totalPeriods
  avgOosReturn: number;
  avgRankScore: number;
}

// ============ EODHD SCREENER ============

interface ScreenerResult {
  code: string;
  exchange: string;
  name: string;
  market_capitalization?: number;
  sector?: string;
}

/**
 * Screen stocks from EODHD Screener API based on criteria
 */
export async function screenStocksFromEODHD(criteria: ScreeningCriteria): Promise<string[]> {
  const apiKey = await getEodhdApiKey();
  if (!apiKey) {
    throw new Error("EODHD_API_KEY not configured");
  }

  const maxTickers = criteria.maxTickers || 100;
  
  // Build screener filters
  const filters: string[] = [];
  
  // Market cap filter (in millions)
  if (criteria.minMarketCap) {
    filters.push(`market_capitalization>=${criteria.minMarketCap * 1_000_000}`);
  }
  if (criteria.maxMarketCap) {
    filters.push(`market_capitalization<=${criteria.maxMarketCap * 1_000_000}`);
  }
  
  // Exchange filter
  let exchange = criteria.exchange || 'us'; // Default to US
  if (criteria.region) {
    switch (criteria.region.toUpperCase()) {
      case 'US': exchange = 'us'; break;
      case 'EU': exchange = 'XETRA'; break;
      case 'CH': exchange = 'SW'; break;
      case 'UK': exchange = 'LSE'; break;
      case 'DE': exchange = 'XETRA'; break;
      case 'FR': exchange = 'PA'; break;
      default: exchange = criteria.region.toLowerCase();
    }
  }

  // Sector filter
  if (criteria.sector) {
    filters.push(`sector=="${criteria.sector}"`);
  }

  try {
    // Use EODHD stock screener endpoint
    const filterStr = filters.length > 0 ? `&filters_json=${encodeURIComponent(JSON.stringify(filters))}` : '';
    const url = `${EODHD_BASE_URL}/screener?api_token=${apiKey}&sort=market_capitalization.desc&limit=${maxTickers}&offset=0&exchange=${exchange}${filterStr}`;
    
    console.log(`[WalkForward] Screening stocks from EODHD: ${url.replace(apiKey, '***')}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[WalkForward] EODHD screener failed: ${response.status}`);
      return getDefaultUniverseTickers(maxTickers);
    }

    const data = await response.json();
    const stocks: ScreenerResult[] = data?.data || data || [];
    
    if (!Array.isArray(stocks) || stocks.length === 0) {
      console.warn(`[WalkForward] No stocks from screener, using defaults`);
      return getDefaultUniverseTickers(maxTickers);
    }

    // Convert to tickers matching our DB format
    const tickers = stocks
      .slice(0, maxTickers)
      .map(s => {
        const code = (s.code || '').trim().toUpperCase();
        const exch = (s.exchange || exchange).toUpperCase();
        if (exch === 'SW' || exch === 'SWX') return code.includes('.') ? code : `${code}.SW`;
        if (['PA', 'XETRA', 'LSE', 'AS', 'MI'].includes(exch)) return code.includes('.') ? code : `${code}.${exch}`;
        if (code.includes('.US')) return code.replace('.US', '');
        if (code.includes('.')) return code;
        return code;
      });

    console.log(`[WalkForward] Screened ${tickers.length} tickers from ${exchange}`);
    return tickers;
  } catch (error) {
    console.error(`[WalkForward] Screener error:`, error);
    return getDefaultUniverseTickers(maxTickers);
  }
}

/**
 * Get default universe tickers (S&P 500 top components) as fallback
 */
function getDefaultUniverseTickers(count: number): string[] {
  const sp500Top = [
    'AAPL', 'MSFT', 'AMZN', 'NVDA', 'GOOGL', 'META', 'BRK-B',
    'TSLA', 'UNH', 'XOM', 'JNJ', 'JPM', 'V', 'PG', 'MA',
    'HD', 'CVX', 'MRK', 'ABBV', 'LLY', 'PEP', 'KO', 'AVGO',
    'COST', 'TMO', 'MCD', 'WMT', 'CSCO', 'ACN', 'ABT',
    'DHR', 'NEE', 'LIN', 'TXN', 'PM', 'UNP', 'BMY', 'RTX',
    'LOW', 'HON', 'ORCL', 'AMGN', 'COP', 'INTC', 'AMD',
    'QCOM', 'UPS', 'CAT', 'BA', 'GS', 'ELV', 'SBUX',
    'MDLZ', 'GILD', 'ADI', 'BLK', 'SYK', 'DE', 'ISRG',
    'VRTX', 'REGN', 'ADP', 'BKNG', 'TMUS', 'MMC', 'CI',
    'CB', 'PLD', 'SO', 'DUK', 'ZTS', 'CME', 'SCHW',
    'MO', 'CL', 'ITW', 'EQIX', 'AON', 'SHW', 'LRCX',
    'KLAC', 'SNPS', 'CDNS', 'PANW', 'CRWD', 'NOW', 'SNOW',
    'DDOG', 'NET', 'ZS', 'FTNT', 'WDAY', 'TEAM', 'HUBS',
    'MELI', 'SE', 'SHOP', 'SQ', 'COIN', 'PLTR', 'UBER',
    'ABNB', 'DASH'
  ];
  return sp500Top.slice(0, count);
}

// ============ WATCHLIST UNIVERSE ============

/**
 * Get all active watchlist tickers from database
 */
export async function getWatchlistTickers(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({ ticker: stocks.ticker })
    .from(stocks)
    .where(activeCurated());

  return rows.map(s => s.ticker.trim().toUpperCase());
}

// ============ SCORING ENGINE ============

interface TickerScoreData {
  ticker: string;
  prices: { date: string; close: number }[];
  momentum1m: number;
  momentum3m: number;
  momentum6m: number;
  volatility: number;
  sharpe: number;
  relativeStrength: number;
  compositeScore: number;
}

/**
 * Calculate composite score for a ticker based on historical prices
 * Uses momentum, volatility, and relative strength
 */
function calculateTickerScore(
  prices: { date: string; close: number }[],
  benchmarkPrices: { date: string; close: number }[],
  weights?: { momentum: number; sharpe: number; relativeStrength: number; lowVol: number }
): Omit<TickerScoreData, 'ticker' | 'prices'> {
  if (prices.length < 20) {
    return { momentum1m: 0, momentum3m: 0, momentum6m: 0, volatility: 999, sharpe: 0, relativeStrength: 0, compositeScore: 0 };
  }

  const sorted = [...prices].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1].close;
  
  const oneMonthAgo = sorted.length >= 22 ? sorted[sorted.length - 22].close : sorted[0].close;
  const threeMonthsAgo = sorted.length >= 66 ? sorted[sorted.length - 66].close : sorted[0].close;
  const sixMonthsAgo = sorted.length >= 132 ? sorted[sorted.length - 132].close : sorted[0].close;
  
  const momentum1m = (latest - oneMonthAgo) / oneMonthAgo;
  const momentum3m = (latest - threeMonthsAgo) / threeMonthsAgo;
  const momentum6m = (latest - sixMonthsAgo) / sixMonthsAgo;
  
  const returns: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1].close > 0) {
      returns.push((sorted[i].close - sorted[i - 1].close) / sorted[i - 1].close);
    }
  }
  
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance) * Math.sqrt(252);
  
  const annualizedReturn = avgReturn * 252;
  const sharpe = volatility > 0 ? (annualizedReturn - DEFAULT_RISK_FREE_RATE) / volatility : 0;
  
  let relativeStrength = 0;
  if (benchmarkPrices.length >= 22) {
    const benchSorted = [...benchmarkPrices].sort((a, b) => a.date.localeCompare(b.date));
    const benchLatest = benchSorted[benchSorted.length - 1].close;
    const benchStart = benchSorted.length >= 66 ? benchSorted[benchSorted.length - 66].close : benchSorted[0].close;
    const benchReturn = benchStart > 0 ? (benchLatest - benchStart) / benchStart : 0;
    relativeStrength = momentum3m - benchReturn;
  }
  
  const w = weights || { momentum: 0.35, sharpe: 0.25, relativeStrength: 0.20, lowVol: 0.20 };
  const momentumScore = Math.min(100, Math.max(0, (momentum3m + 0.3) / 0.6 * 100));
  const sharpeScore = Math.min(100, Math.max(0, (sharpe + 1) / 4 * 100));
  const rsScore = Math.min(100, Math.max(0, (relativeStrength + 0.2) / 0.4 * 100));
  const volScore = Math.min(100, Math.max(0, (0.5 - volatility) / 0.5 * 100));
  
  const compositeScore = momentumScore * w.momentum + sharpeScore * w.sharpe + rsScore * w.relativeStrength + volScore * w.lowVol;
  
  return {
    momentum1m,
    momentum3m,
    momentum6m,
    volatility,
    sharpe,
    relativeStrength,
    compositeScore: Math.round(compositeScore * 10) / 10
  };
}

// ============ WALK-FORWARD ENGINE ============

// Strategy profile scoring weight overrides
const STRATEGY_SCORING_WEIGHTS: Record<string, { momentum: number; sharpe: number; relativeStrength: number; lowVol: number }> = {
  shortTerm: { momentum: 0.50, sharpe: 0.15, relativeStrength: 0.25, lowVol: 0.10 },
  midTerm: { momentum: 0.35, sharpe: 0.25, relativeStrength: 0.20, lowVol: 0.20 },
  longTerm: { momentum: 0.15, sharpe: 0.35, relativeStrength: 0.15, lowVol: 0.35 },
};

/**
 * Batch-fetch all prices for a set of tickers within a date range.
 * Returns a Map<ticker, {date, close}[]> — much faster than individual queries.
 */
async function batchFetchPrices(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  tickers: string[],
  startDate: string,
  endDate: string
): Promise<Map<string, { date: string; close: number }[]>> {
  const result = new Map<string, { date: string; close: number }[]>();
  
  // Process in chunks of 50 tickers to avoid query size limits
  const CHUNK_SIZE = 50;
  for (let i = 0; i < tickers.length; i += CHUNK_SIZE) {
    const chunk = tickers.slice(i, i + CHUNK_SIZE);
    
    const rows = await db
      .select({
        ticker: historicalPrices.ticker,
        date: historicalPrices.date,
        close: historicalPrices.close,
      })
      .from(historicalPrices)
      .where(and(
        inArray(historicalPrices.ticker, chunk),
        gte(historicalPrices.date, startDate),
        lte(historicalPrices.date, endDate)
      ))
      .orderBy(asc(historicalPrices.ticker), asc(historicalPrices.date));
    
    for (const row of rows) {
      const ticker = row.ticker;
      if (!result.has(ticker)) {
        result.set(ticker, []);
      }
      result.get(ticker)!.push({
        date: typeof row.date === 'string' ? row.date : String(row.date),
        close: parseFloat(String(row.close)) || 0,
      });
    }
    
    // Small yield between chunks
    if (i + CHUNK_SIZE < tickers.length) {
      await new Promise(r => setTimeout(r, 5));
    }
  }
  
  return result;
}

/**
 * Run Walk-Forward Validation on a universe of stocks
 * 
 * OPTIMIZED: Uses batch DB queries per period instead of individual ticker queries.
 * This reduces DB round-trips from O(tickers × periods) to O(periods × 3).
 */
export async function runWalkForwardValidation(
  config: WalkForwardConfig,
  userId: number,
  progressCallback?: (msg: string) => void
): Promise<WalkForwardResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const logProgress = (msg: string) => {
    console.log(`[WalkForward] ${msg}`);
    progressCallback?.(msg);
  };

  logProgress(`Walk-Forward Validation gestartet (${config.universeSource}, Train: ${config.trainWindowMonths}M, Test: ${config.testWindowMonths}M)`);
  if (config.strategyProfile) {
    logProgress(`Strategie-Profil: ${config.strategyProfile}`);
  }

  // 1. Get universe of tickers
  let tickers: string[] = [];
  
  if (config.universeSource === 'watchlist' || config.universeSource === 'combined') {
    logProgress('Lade Watchlist-Titel...');
    const watchlistTickers = await getWatchlistTickers();
    tickers.push(...watchlistTickers);
    logProgress(`${watchlistTickers.length} Watchlist-Titel geladen`);
  }
  
  if (config.universeSource === 'screener' || config.universeSource === 'combined') {
    logProgress('Lade Screener-Titel (EODHD)...');
    const screenedTickers = await screenStocksFromEODHD(config.screeningCriteria || { maxTickers: 100 });
    tickers.push(...screenedTickers);
    logProgress(`${screenedTickers.length} Screener-Titel geladen`);
  }
  
  // Deduplicate
  tickers = Array.from(new Set(tickers));
  
  logProgress(`Universum: ${tickers.length} Titel (dedupliziert)`);
  
  if (tickers.length < 10) {
    throw new Error(`Universe too small: only ${tickers.length} tickers. Need at least 10.`);
  }

  // 2. Determine date range from available data
  const dateRange = await db
    .select({
      minDate: sql<string>`MIN(date)`,
      maxDate: sql<string>`MAX(date)`,
    })
    .from(historicalPrices)
    .where(inArray(historicalPrices.ticker, tickers.slice(0, 200)));

  let dataStart = dateRange[0]?.minDate || '2023-01-01';
  const dataEnd = dateRange[0]?.maxDate || new Date().toISOString().split('T')[0];
  
  // Quick-Mode: Limit to last 3 years of data
  if (config.quickMode) {
    const threeYearsAgo = new Date(dataEnd);
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    const quickStart = threeYearsAgo.toISOString().split('T')[0];
    if (quickStart > dataStart) {
      dataStart = quickStart;
      logProgress(`Quick-Mode: Datenbereich auf letzte 3 Jahre begrenzt`);
    }
  }
  
  logProgress(`Datenbereich: ${dataStart} bis ${dataEnd}`);

  // 3. Pre-calculate total number of periods
  const trainMonths = config.trainWindowMonths;
  const testMonths = config.testWindowMonths;
  
  const startDate = new Date(dataStart);
  const endDate = new Date(dataEnd);
  
  let totalExpectedPeriods = 0;
  {
    const tempStart = new Date(startDate);
    while (true) {
      const tempTrainEnd = new Date(tempStart);
      tempTrainEnd.setMonth(tempTrainEnd.getMonth() + trainMonths);
      const tempTestEnd = new Date(tempTrainEnd);
      tempTestEnd.setDate(tempTestEnd.getDate() + 1);
      tempTestEnd.setMonth(tempTestEnd.getMonth() + testMonths);
      if (tempTestEnd > endDate) break;
      totalExpectedPeriods++;
      tempStart.setMonth(tempStart.getMonth() + testMonths);
    }
  }
  logProgress(`Erwartete Perioden: ${totalExpectedPeriods}`);

  // Get strategy scoring weights
  const scoringWeights = config.strategyProfile 
    ? STRATEGY_SCORING_WEIGHTS[config.strategyProfile] 
    : STRATEGY_SCORING_WEIGHTS.midTerm;
  
  const periods: WalkForwardPeriodResult[] = [];
  const currentStart = new Date(startDate);
  let periodIndex = 0;
  
  // Roll forward by testMonths each iteration
  while (true) {
    const trainStart = new Date(currentStart);
    const trainEnd = new Date(trainStart);
    trainEnd.setMonth(trainEnd.getMonth() + trainMonths);
    
    const testStart = new Date(trainEnd);
    testStart.setDate(testStart.getDate() + 1);
    const testEnd = new Date(testStart);
    testEnd.setMonth(testEnd.getMonth() + testMonths);
    
    if (testEnd > endDate) break;
    
    periodIndex++;
    const trainStartStr = trainStart.toISOString().split('T')[0];
    const trainEndStr = trainEnd.toISOString().split('T')[0];
    const testStartStr = testStart.toISOString().split('T')[0];
    const testEndStr = testEnd.toISOString().split('T')[0];
    
    logProgress(`Periode ${periodIndex}/${totalExpectedPeriods}: Train ${trainStartStr}–${trainEndStr}, Test ${testStartStr}–${testEndStr}`);
    
    // Yield to event loop between periods
    await new Promise(r => setTimeout(r, 10));
    
    // 4. BATCH FETCH all prices for this training window (single query per chunk)
    const trainPricesMap = await batchFetchPrices(db, [...tickers, 'SPY'], trainStartStr, trainEndStr);
    
    const benchmarkPrices = trainPricesMap.get('SPY') || [];
    
    // Score all tickers using pre-fetched data
    const tickerScores: TickerScoreData[] = [];
    
    for (const ticker of tickers) {
      const prices = trainPricesMap.get(ticker);
      if (!prices || prices.length < 20) continue;
      
      const score = calculateTickerScore(prices, benchmarkPrices, scoringWeights);
      
      if (config.screeningCriteria?.minScore && score.compositeScore < config.screeningCriteria.minScore) {
        continue;
      }
      
      tickerScores.push({ ticker, prices, ...score });
    }
    logProgress(`Periode ${periodIndex}: ${tickerScores.length}/${tickers.length} Titel bewertet`);
    
    if (tickerScores.length < 4) {
      console.warn(`[WalkForward] Only ${tickerScores.length} tickers scored in period, skipping`);
      currentStart.setMonth(currentStart.getMonth() + testMonths);
      continue;
    }
    
    // 5. Rank and select top/bottom quartile
    tickerScores.sort((a, b) => b.compositeScore - a.compositeScore);
    const quartileSize = Math.max(1, Math.floor(tickerScores.length * (config.topQuartilePercent / 100)));
    
    const topTickers = tickerScores.slice(0, quartileSize).map(t => t.ticker);
    const bottomTickers = tickerScores.slice(-quartileSize).map(t => t.ticker);
    
    // 6. BATCH FETCH test period prices for top + bottom + benchmark
    const testTickers = [...new Set([...topTickers, ...bottomTickers, 'SPY'])];
    const testPricesMap = await batchFetchPrices(db, testTickers, testStartStr, testEndStr);
    
    // Get benchmark return in test period
    const benchTestPrices = testPricesMap.get('SPY') || [];
    let benchmarkReturn = 0;
    if (benchTestPrices.length >= 2) {
      const benchFirst = benchTestPrices[0].close;
      const benchLast = benchTestPrices[benchTestPrices.length - 1].close;
      benchmarkReturn = benchFirst > 0 ? (benchLast - benchFirst) / benchFirst : 0;
    }
    
    // Measure top quartile returns
    let topReturnSum = 0;
    let topCount = 0;
    let hitsAboveBenchmark = 0;
    
    for (const ticker of topTickers) {
      const testPrices = testPricesMap.get(ticker);
      if (testPrices && testPrices.length >= 2) {
        const first = testPrices[0].close;
        const last = testPrices[testPrices.length - 1].close;
        if (first > 0) {
          const ret = (last - first) / first;
          topReturnSum += ret;
          topCount++;
          if (ret > benchmarkReturn) hitsAboveBenchmark++;
        }
      }
    }
    
    // Measure bottom quartile returns
    let bottomReturnSum = 0;
    let bottomCount = 0;
    
    for (const ticker of bottomTickers) {
      const testPrices = testPricesMap.get(ticker);
      if (testPrices && testPrices.length >= 2) {
        const first = testPrices[0].close;
        const last = testPrices[testPrices.length - 1].close;
        if (first > 0) {
          const ret = (last - first) / first;
          bottomReturnSum += ret;
          bottomCount++;
        }
      }
    }
    
    const topReturn = topCount > 0 ? topReturnSum / topCount : 0;
    const bottomReturn = bottomCount > 0 ? bottomReturnSum / bottomCount : 0;
    const hitRate = topCount > 0 ? hitsAboveBenchmark / topCount : 0;
    const alpha = topReturn - benchmarkReturn;
    
    periods.push({
      periodStart: trainStartStr,
      periodEnd: testEndStr,
      trainStart: trainStartStr,
      trainEnd: trainEndStr,
      testStart: testStartStr,
      testEnd: testEndStr,
      topTickers,
      bottomTickers,
      topReturn: Math.round(topReturn * 10000) / 100,
      bottomReturn: Math.round(bottomReturn * 10000) / 100,
      benchmarkReturn: Math.round(benchmarkReturn * 10000) / 100,
      alpha: Math.round(alpha * 10000) / 100,
      hitRate: Math.round(hitRate * 100) / 100,
    });
    
    // Move forward by test window
    currentStart.setMonth(currentStart.getMonth() + testMonths);
  }
  
  // 7. Aggregate results
  logProgress(`Aggregiere Ergebnisse aus ${periods.length} Perioden...`);
  const avgAlpha = periods.length > 0 
    ? periods.reduce((a, p) => a + p.alpha, 0) / periods.length 
    : 0;
  const avgHitRate = periods.length > 0 
    ? periods.reduce((a, p) => a + p.hitRate, 0) / periods.length 
    : 0;
  
  // Calculate OOS Sharpe
  const alphas = periods.map(p => p.alpha);
  const avgAlphaForSharpe = alphas.reduce((a, b) => a + b, 0) / alphas.length;
  const alphaVariance = alphas.reduce((a, b) => a + Math.pow(b - avgAlphaForSharpe, 2), 0) / alphas.length;
  const alphaStd = Math.sqrt(alphaVariance);
  const oosSharpe = alphaStd > 0 ? avgAlphaForSharpe / alphaStd : 0;
  
  // Calculate overfit ratio
  const avgTopReturn = periods.length > 0
    ? periods.reduce((a, p) => a + p.topReturn, 0) / periods.length
    : 0;
  const overfitRatio = avgAlpha !== 0 ? Math.abs(avgTopReturn / avgAlpha) : 1;
  
  // 8. Find consistent top performers
  const tickerAppearances: Record<string, { topCount: number; totalPeriods: number; returns: number[]; scores: number[] }> = {};
  
  for (const period of periods) {
    for (const ticker of period.topTickers) {
      if (!tickerAppearances[ticker]) {
        tickerAppearances[ticker] = { topCount: 0, totalPeriods: 0, returns: [], scores: [] };
      }
      tickerAppearances[ticker].topCount++;
      tickerAppearances[ticker].totalPeriods = periods.length;
      tickerAppearances[ticker].returns.push(period.topReturn);
    }
  }
  
  const topPerformers: TopPerformerInfo[] = Object.entries(tickerAppearances)
    .map(([ticker, data]) => ({
      ticker,
      timesInTopQuartile: data.topCount,
      totalPeriods: data.totalPeriods,
      consistencyScore: data.topCount / data.totalPeriods,
      avgOosReturn: data.returns.reduce((a, b) => a + b, 0) / data.returns.length,
      avgRankScore: 0,
    }))
    .filter(t => t.consistencyScore >= 0.3)
    .sort((a, b) => b.consistencyScore - a.consistencyScore)
    .slice(0, 20);
  
  const result: WalkForwardResult = {
    runName: `Walk-Forward ${config.universeSource} ${new Date().toISOString().split('T')[0]}`,
    universeSource: config.universeSource,
    screeningCriteria: config.screeningCriteria || null,
    tickerCount: tickers.length,
    tickers,
    trainWindow: config.trainWindowMonths,
    testWindow: config.testWindowMonths,
    totalPeriods: periods.length,
    oosAlpha: Math.round(avgAlpha * 100) / 100,
    oosHitRate: Math.round(avgHitRate * 100) / 100,
    oosSharpe: Math.round(oosSharpe * 100) / 100,
    overfitRatio: Math.round(overfitRatio * 100) / 100,
    topPerformers,
    periodResults: periods,
    status: 'completed',
  };
  
  // 9. Save to database
  logProgress(`Speichere Ergebnisse in Datenbank...`);
  try {
    await db.insert(walkForwardResults).values({
      userId,
      runName: result.runName,
      universeSource: result.universeSource,
      screeningCriteria: JSON.stringify(result.screeningCriteria),
      tickerCount: result.tickerCount,
      tickers: JSON.stringify(result.tickers.slice(0, 200)),
      trainWindow: result.trainWindow,
      testWindow: result.testWindow,
      totalPeriods: result.totalPeriods,
      oosAlpha: result.oosAlpha.toString(),
      oosHitRate: result.oosHitRate.toString(),
      oosSharpe: result.oosSharpe.toString(),
      overfitRatio: result.overfitRatio.toString(),
      topPerformers: JSON.stringify(result.topPerformers),
      fullResults: JSON.stringify(result.periodResults),
      status: 'completed',
      completedAt: new Date(),
    });
  } catch (err) {
    console.error(`[WalkForward] Failed to save results:`, err);
  }
  
  return result;
}

/**
 * Get past walk-forward results for a user
 */
export async function getWalkForwardHistory(userId: number): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  
  const results = await db
    .select()
    .from(walkForwardResults)
    .where(eq(walkForwardResults.userId, userId))
    .orderBy(desc(walkForwardResults.createdAt))
    .limit(20);
  
  return results.map(r => ({
    ...r,
    screeningCriteria: r.screeningCriteria ? JSON.parse(String(r.screeningCriteria)) : null,
    tickers: r.tickers ? JSON.parse(String(r.tickers)) : [],
    topPerformers: r.topPerformers ? JSON.parse(String(r.topPerformers)) : [],
    fullResults: r.fullResults ? JSON.parse(String(r.fullResults)) : [],
  }));
}
