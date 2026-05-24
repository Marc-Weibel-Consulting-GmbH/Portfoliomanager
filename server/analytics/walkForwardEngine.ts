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
import { historicalPrices, watchlistStocks, walkForwardResults } from "../../drizzle/schema";
import { eq, and, gte, lte, asc, desc, inArray, sql } from "drizzle-orm";
import { normalizeTickerForDb } from "../tickerNormalization";

const EODHD_API_KEY = process.env.EODHD_API_KEY;
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
  if (!EODHD_API_KEY) {
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
    const url = `${EODHD_BASE_URL}/screener?api_token=${EODHD_API_KEY}&sort=market_capitalization.desc&limit=${maxTickers}&offset=0&exchange=${exchange}${filterStr}`;
    
    console.log(`[WalkForward] Screening stocks from EODHD: ${url.replace(EODHD_API_KEY, '***')}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[WalkForward] EODHD screener failed: ${response.status}`);
      // Fallback: return top tickers by market cap from a known list
      return getDefaultUniverseTickers(maxTickers);
    }

    const data = await response.json();
    const stocks: ScreenerResult[] = data?.data || data || [];
    
    if (!Array.isArray(stocks) || stocks.length === 0) {
      console.warn(`[WalkForward] No stocks from screener, using defaults`);
      return getDefaultUniverseTickers(maxTickers);
    }

    // Convert to normalized tickers
    const tickers = stocks
      .slice(0, maxTickers)
      .map(s => {
        const code = s.code || '';
        const exch = s.exchange || exchange;
        // Format as TICKER.EXCHANGE for EODHD
        if (code.includes('.')) return code;
        return `${code}.${exch.toUpperCase()}`;
      })
      .map(t => normalizeTickerForDb(t));

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
    'AAPL.US', 'MSFT.US', 'AMZN.US', 'NVDA.US', 'GOOGL.US', 'META.US', 'BRK-B.US',
    'TSLA.US', 'UNH.US', 'XOM.US', 'JNJ.US', 'JPM.US', 'V.US', 'PG.US', 'MA.US',
    'HD.US', 'CVX.US', 'MRK.US', 'ABBV.US', 'LLY.US', 'PEP.US', 'KO.US', 'AVGO.US',
    'COST.US', 'TMO.US', 'MCD.US', 'WMT.US', 'CSCO.US', 'ACN.US', 'ABT.US',
    'DHR.US', 'NEE.US', 'LIN.US', 'TXN.US', 'PM.US', 'UNP.US', 'BMY.US', 'RTX.US',
    'LOW.US', 'HON.US', 'ORCL.US', 'AMGN.US', 'COP.US', 'INTC.US', 'AMD.US',
    'QCOM.US', 'UPS.US', 'CAT.US', 'BA.US', 'GS.US', 'ELV.US', 'SBUX.US',
    'MDLZ.US', 'GILD.US', 'ADI.US', 'BLK.US', 'SYK.US', 'DE.US', 'ISRG.US',
    'VRTX.US', 'REGN.US', 'ADP.US', 'BKNG.US', 'TMUS.US', 'MMC.US', 'CI.US',
    'CB.US', 'PLD.US', 'SO.US', 'DUK.US', 'ZTS.US', 'CME.US', 'SCHW.US',
    'MO.US', 'CL.US', 'ITW.US', 'EQIX.US', 'AON.US', 'SHW.US', 'LRCX.US',
    'KLAC.US', 'SNPS.US', 'CDNS.US', 'PANW.US', 'CRWD.US', 'NOW.US', 'SNOW.US',
    'DDOG.US', 'NET.US', 'ZS.US', 'FTNT.US', 'WDAY.US', 'TEAM.US', 'HUBS.US',
    'MELI.US', 'SE.US', 'SHOP.US', 'SQ.US', 'COIN.US', 'PLTR.US', 'UBER.US',
    'ABNB.US', 'DASH.US'
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

  const stocks = await db
    .select({ ticker: watchlistStocks.ticker })
    .from(watchlistStocks)
    .where(eq(watchlistStocks.isActive, 1));

  return stocks.map(s => normalizeTickerForDb(s.ticker));
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
  benchmarkPrices: { date: string; close: number }[]
): Omit<TickerScoreData, 'ticker' | 'prices'> {
  if (prices.length < 20) {
    return { momentum1m: 0, momentum3m: 0, momentum6m: 0, volatility: 999, sharpe: 0, relativeStrength: 0, compositeScore: 0 };
  }

  // Sort by date
  const sorted = [...prices].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1].close;
  
  // Momentum calculations
  const oneMonthAgo = sorted.length >= 22 ? sorted[sorted.length - 22].close : sorted[0].close;
  const threeMonthsAgo = sorted.length >= 66 ? sorted[sorted.length - 66].close : sorted[0].close;
  const sixMonthsAgo = sorted.length >= 132 ? sorted[sorted.length - 132].close : sorted[0].close;
  
  const momentum1m = (latest - oneMonthAgo) / oneMonthAgo;
  const momentum3m = (latest - threeMonthsAgo) / threeMonthsAgo;
  const momentum6m = (latest - sixMonthsAgo) / sixMonthsAgo;
  
  // Daily returns for volatility
  const returns: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1].close > 0) {
      returns.push((sorted[i].close - sorted[i - 1].close) / sorted[i - 1].close);
    }
  }
  
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance) * Math.sqrt(252); // Annualized
  
  // Sharpe ratio (risk-free rate = 4%)
  const annualizedReturn = avgReturn * 252;
  const sharpe = volatility > 0 ? (annualizedReturn - 0.04) / volatility : 0;
  
  // Relative strength vs benchmark
  let relativeStrength = 0;
  if (benchmarkPrices.length >= 22) {
    const benchSorted = [...benchmarkPrices].sort((a, b) => a.date.localeCompare(b.date));
    const benchLatest = benchSorted[benchSorted.length - 1].close;
    const benchStart = benchSorted.length >= 66 ? benchSorted[benchSorted.length - 66].close : benchSorted[0].close;
    const benchReturn = benchStart > 0 ? (benchLatest - benchStart) / benchStart : 0;
    relativeStrength = momentum3m - benchReturn;
  }
  
  // Composite score (0-100)
  // Weighted: Momentum 35%, Sharpe 25%, Relative Strength 20%, Low Volatility 20%
  const momentumScore = Math.min(100, Math.max(0, (momentum3m + 0.3) / 0.6 * 100));
  const sharpeScore = Math.min(100, Math.max(0, (sharpe + 1) / 4 * 100));
  const rsScore = Math.min(100, Math.max(0, (relativeStrength + 0.2) / 0.4 * 100));
  const volScore = Math.min(100, Math.max(0, (0.5 - volatility) / 0.5 * 100));
  
  const compositeScore = momentumScore * 0.35 + sharpeScore * 0.25 + rsScore * 0.20 + volScore * 0.20;
  
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

/**
 * Run Walk-Forward Validation on a universe of stocks
 */
export async function runWalkForwardValidation(
  config: WalkForwardConfig,
  userId: number
): Promise<WalkForwardResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  console.log(`[WalkForward] Starting walk-forward validation`, config);

  // 1. Get universe of tickers
  let tickers: string[] = [];
  
  if (config.universeSource === 'watchlist' || config.universeSource === 'combined') {
    const watchlistTickers = await getWatchlistTickers();
    tickers.push(...watchlistTickers);
  }
  
  if (config.universeSource === 'screener' || config.universeSource === 'combined') {
    const screenedTickers = await screenStocksFromEODHD(config.screeningCriteria || { maxTickers: 100 });
    tickers.push(...screenedTickers);
  }
  
  // Deduplicate
  tickers = Array.from(new Set(tickers));
  
  // Apply score filter if specified
  if (config.screeningCriteria?.minScore) {
    // We'll filter after scoring in the first period
  }
  
  console.log(`[WalkForward] Universe: ${tickers.length} tickers`);
  
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

  const dataStart = dateRange[0]?.minDate || '2023-01-01';
  const dataEnd = dateRange[0]?.maxDate || new Date().toISOString().split('T')[0];
  
  console.log(`[WalkForward] Data range: ${dataStart} to ${dataEnd}`);

  // 3. Generate rolling windows
  const trainMonths = config.trainWindowMonths;
  const testMonths = config.testWindowMonths;
  const totalWindowMonths = trainMonths + testMonths;
  
  const startDate = new Date(dataStart);
  const endDate = new Date(dataEnd);
  
  const periods: WalkForwardPeriodResult[] = [];
  let currentStart = new Date(startDate);
  
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
    
    const trainStartStr = trainStart.toISOString().split('T')[0];
    const trainEndStr = trainEnd.toISOString().split('T')[0];
    const testStartStr = testStart.toISOString().split('T')[0];
    const testEndStr = testEnd.toISOString().split('T')[0];
    
    console.log(`[WalkForward] Period: Train ${trainStartStr}-${trainEndStr}, Test ${testStartStr}-${testEndStr}`);
    
    // 4. Score all tickers in training window
    const tickerScores: TickerScoreData[] = [];
    
    // Get benchmark prices for the training window
    const benchmarkPricesRaw = await db
      .select({ date: historicalPrices.date, close: historicalPrices.close })
      .from(historicalPrices)
      .where(and(
        eq(historicalPrices.ticker, 'SPY'),
        gte(historicalPrices.date, trainStartStr),
        lte(historicalPrices.date, trainEndStr)
      ))
      .orderBy(asc(historicalPrices.date));
    
    const benchmarkPrices = benchmarkPricesRaw.map(p => ({
      date: typeof p.date === 'string' ? p.date : String(p.date),
      close: parseFloat(String(p.close)) || 0
    }));
    
    // Score each ticker
    for (const ticker of tickers) {
      const pricesRaw = await db
        .select({ date: historicalPrices.date, close: historicalPrices.close })
        .from(historicalPrices)
        .where(and(
          eq(historicalPrices.ticker, ticker),
          gte(historicalPrices.date, trainStartStr),
          lte(historicalPrices.date, trainEndStr)
        ))
        .orderBy(asc(historicalPrices.date));
      
      if (pricesRaw.length < 20) continue; // Skip tickers with insufficient data
      
      const prices = pricesRaw.map(p => ({
        date: typeof p.date === 'string' ? p.date : String(p.date),
        close: parseFloat(String(p.close)) || 0
      }));
      
      const score = calculateTickerScore(prices, benchmarkPrices);
      
      // Apply minimum score filter
      if (config.screeningCriteria?.minScore && score.compositeScore < config.screeningCriteria.minScore) {
        continue;
      }
      
      tickerScores.push({ ticker, prices, ...score });
    }
    
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
    
    // 6. Measure out-of-sample performance in test window
    let topReturnSum = 0;
    let topCount = 0;
    let bottomReturnSum = 0;
    let bottomCount = 0;
    let hitsAboveBenchmark = 0;
    
    // Get benchmark return in test period
    const benchTestPricesRaw = await db
      .select({ date: historicalPrices.date, close: historicalPrices.close })
      .from(historicalPrices)
      .where(and(
        eq(historicalPrices.ticker, 'SPY'),
        gte(historicalPrices.date, testStartStr),
        lte(historicalPrices.date, testEndStr)
      ))
      .orderBy(asc(historicalPrices.date));
    
    let benchmarkReturn = 0;
    if (benchTestPricesRaw.length >= 2) {
      const benchFirst = parseFloat(String(benchTestPricesRaw[0].close)) || 0;
      const benchLast = parseFloat(String(benchTestPricesRaw[benchTestPricesRaw.length - 1].close)) || 0;
      benchmarkReturn = benchFirst > 0 ? (benchLast - benchFirst) / benchFirst : 0;
    }
    
    // Measure top quartile returns
    for (const ticker of topTickers) {
      const testPricesRaw = await db
        .select({ date: historicalPrices.date, close: historicalPrices.close })
        .from(historicalPrices)
        .where(and(
          eq(historicalPrices.ticker, ticker),
          gte(historicalPrices.date, testStartStr),
          lte(historicalPrices.date, testEndStr)
        ))
        .orderBy(asc(historicalPrices.date));
      
      if (testPricesRaw.length >= 2) {
        const first = parseFloat(String(testPricesRaw[0].close)) || 0;
        const last = parseFloat(String(testPricesRaw[testPricesRaw.length - 1].close)) || 0;
        if (first > 0) {
          const ret = (last - first) / first;
          topReturnSum += ret;
          topCount++;
          if (ret > benchmarkReturn) hitsAboveBenchmark++;
        }
      }
    }
    
    // Measure bottom quartile returns
    for (const ticker of bottomTickers) {
      const testPricesRaw = await db
        .select({ date: historicalPrices.date, close: historicalPrices.close })
        .from(historicalPrices)
        .where(and(
          eq(historicalPrices.ticker, ticker),
          gte(historicalPrices.date, testStartStr),
          lte(historicalPrices.date, testEndStr)
        ))
        .orderBy(asc(historicalPrices.date));
      
      if (testPricesRaw.length >= 2) {
        const first = parseFloat(String(testPricesRaw[0].close)) || 0;
        const last = parseFloat(String(testPricesRaw[testPricesRaw.length - 1].close)) || 0;
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
      topReturn: Math.round(topReturn * 10000) / 100, // as percentage
      bottomReturn: Math.round(bottomReturn * 10000) / 100,
      benchmarkReturn: Math.round(benchmarkReturn * 10000) / 100,
      alpha: Math.round(alpha * 10000) / 100,
      hitRate: Math.round(hitRate * 100) / 100,
    });
    
    // Move forward by test window
    currentStart.setMonth(currentStart.getMonth() + testMonths);
  }
  
  // 7. Aggregate results
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
  
  // Calculate overfit ratio (in-sample vs out-of-sample)
  // Simple approximation: if IS performance >> OOS performance, likely overfit
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
      avgRankScore: 0, // Will be filled from last period scores
    }))
    .filter(t => t.consistencyScore >= 0.3) // At least 30% of periods in top quartile
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
  try {
    await db.insert(walkForwardResults).values({
      userId,
      runName: result.runName,
      universeSource: result.universeSource,
      screeningCriteria: JSON.stringify(result.screeningCriteria),
      tickerCount: result.tickerCount,
      tickers: JSON.stringify(result.tickers.slice(0, 200)), // Limit stored tickers
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
