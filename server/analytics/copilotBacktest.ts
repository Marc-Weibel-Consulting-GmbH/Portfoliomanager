/**
 * Copilot Backtest Engine
 * =======================
 * Simulates the Portfolio Copilot's monthly rebalancing recommendations
 * over the past 12 months and compares performance vs. buy-and-hold.
 * 
 * Methodology:
 * 1. Fetch 18 months of daily prices (12 months backtest + 6 months lookback for indicators)
 * 2. At each monthly rebalancing date, compute ranking scores using data available at that point
 * 3. Apply rebalancing weights (Copilot strategy) and track forward performance
 * 4. Compare against buy-and-hold (initial equal weights, no rebalancing)
 * 5. Calculate alpha, hit rate, and monthly attribution
 */

import { calculateRankings, calculateRebalancingSuggestions, type PortfolioHolding, type RankingResult } from './portfolioCopilot';
import * as ss from 'simple-statistics';
import { DEFAULT_RISK_FREE_RATE } from "./riskStats";

// ============================================================
// TYPES
// ============================================================

export interface BacktestConfig {
  months: number;           // Number of months to backtest (default: 12)
  lookbackDays: number;     // Days of price history needed for indicators (default: 126 = 6 months)
  rebalanceDay: number;     // Day of month to rebalance (default: 1)
  tradingCostBps: number;   // Trading cost per trade in basis points (default: 10)
  maxPositionSize: number;  // Max weight per position (default: 0.20)
  minPositionSize: number;  // Min weight per position (default: 0.03)
  maxTurnoverPerMonth: number; // Max turnover per rebalancing (default: 0.30 = 30%)
}

export interface MonthlySnapshot {
  date: string;             // YYYY-MM-DD of rebalancing date
  month: string;            // YYYY-MM label
  copilotReturn: number;    // Monthly return of copilot strategy (decimal)
  buyHoldReturn: number;    // Monthly return of buy-and-hold (decimal)
  alpha: number;            // copilotReturn - buyHoldReturn
  weights: Record<string, number>;  // Copilot weights at start of month
  rankings: Array<{ ticker: string; score: number; signal: string }>;
  turnover: number;         // Sum of absolute weight changes (0-2)
  tradingCosts: number;     // Estimated trading costs (decimal)
}

export interface BacktestResult {
  summary: {
    copilotTotalReturn: number;     // Cumulative return (decimal)
    buyHoldTotalReturn: number;     // Cumulative return (decimal)
    alpha: number;                   // Outperformance (decimal)
    alphaAnnualized: number;        // Annualized alpha
    copilotSharpe: number;          // Sharpe ratio of copilot
    buyHoldSharpe: number;          // Sharpe ratio of buy-and-hold
    copilotMaxDrawdown: number;     // Max drawdown of copilot
    buyHoldMaxDrawdown: number;     // Max drawdown of buy-and-hold
    hitRate: number;                 // % of months where copilot > buy-and-hold
    avgMonthlyAlpha: number;        // Average monthly outperformance
    totalTurnover: number;          // Total turnover over backtest period
    totalTradingCosts: number;      // Total trading costs
    monthsPositive: number;         // Months with positive copilot return
    monthsOutperformed: number;     // Months where copilot beat buy-and-hold
  };
  monthly: MonthlySnapshot[];
  equityCurve: {
    dates: string[];
    copilot: number[];        // Cumulative equity (starts at 1.0)
    buyHold: number[];        // Cumulative equity (starts at 1.0)
  };
  tickers: string[];
  config: BacktestConfig;
  computedAt: string;
}

// ============================================================
// DEFAULT CONFIG
// ============================================================

const DEFAULT_CONFIG: BacktestConfig = {
  months: 12,
  lookbackDays: 126,
  rebalanceDay: 1,
  tradingCostBps: 10,
  maxPositionSize: 0.20,
  minPositionSize: 0.03,
  maxTurnoverPerMonth: 0.30,
};

// ============================================================
// MAIN BACKTEST FUNCTION
// ============================================================

/**
 * Run a backtest of the Copilot strategy.
 * 
 * @param allPrices - Map of ticker -> array of {date, close} sorted by date ascending
 *                    Must cover at least (lookbackDays + months*21) trading days
 * @param tickers - List of tickers in the portfolio
 * @param config - Backtest configuration
 */
export async function runCopilotBacktest(
  allPrices: Map<string, Array<{ date: string; close: number }>>,
  tickers: string[],
  config: Partial<BacktestConfig> = {}
): Promise<BacktestResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // Validate data availability
  const validTickers = tickers.filter(t => {
    const prices = allPrices.get(t);
    return prices && prices.length >= cfg.lookbackDays + cfg.months * 21;
  });

  if (validTickers.length < 2) {
    throw new Error(`Zu wenig Daten: Nur ${validTickers.length} Titel haben genug historische Kurse für den Backtest.`);
  }

  // Find common date range across all valid tickers
  const allDates = findCommonDates(allPrices, validTickers);
  
  const requiredDays = cfg.lookbackDays + cfg.months * 21;
  if (allDates.length < requiredDays) {
    // Gracefully reduce the backtest period to fit available data
    const availableForBacktest = allDates.length - cfg.lookbackDays;
    if (availableForBacktest < 21) {
      throw new Error(`Zu wenig gemeinsame Handelstage (${allDates.length}). Mindestens ${cfg.lookbackDays + 21} benötigt.`);
    }
    // Reduce months to fit available data
    cfg.months = Math.floor(availableForBacktest / 21);
  }

  // Determine monthly rebalancing dates
  const rebalanceDates = getMonthlyRebalanceDates(allDates, cfg.months);
  
  if (rebalanceDates.length < 2) {
    throw new Error('Nicht genug Rebalancing-Termine gefunden.');
  }

  // Initialize strategies
  const n = validTickers.length;
  let copilotWeights = new Map<string, number>();
  const buyHoldWeights = new Map<string, number>();
  
  // Start with equal weights
  for (const t of validTickers) {
    copilotWeights.set(t, 1 / n);
    buyHoldWeights.set(t, 1 / n);
  }

  const monthly: MonthlySnapshot[] = [];
  const equityCopilot: number[] = [1.0];
  const equityBuyHold: number[] = [1.0];
  const equityDates: string[] = [rebalanceDates[0]];
  
  let cumCopilot = 1.0;
  let cumBuyHold = 1.0;

  // Run month by month
  for (let m = 0; m < rebalanceDates.length - 1; m++) {
    const startDate = rebalanceDates[m];
    const endDate = rebalanceDates[m + 1];
    
    const startIdx = allDates.indexOf(startDate);
    const endIdx = allDates.indexOf(endDate);
    
    if (startIdx < 0 || endIdx < 0 || endIdx <= startIdx) continue;

    // 1. Calculate rankings at this point in time (using lookback data)
    const holdings = buildHoldingsAtDate(allPrices, validTickers, allDates, startIdx, cfg.lookbackDays, copilotWeights);
    const rankings = await calculateRankings(holdings);
    
    // 2. Calculate new target weights from rankings (with turnover constraint)
    const newWeights = calculateTargetWeights(rankings, validTickers, cfg, copilotWeights);
    
    // 3. Calculate turnover and trading costs
    const turnover = calculateTurnover(copilotWeights, newWeights, validTickers);
    const tradingCosts = turnover * cfg.tradingCostBps / 10000;
    
    // 4. Apply new weights (copilot rebalances, buy-and-hold drifts)
    const prevCopilotWeights = new Map(copilotWeights);
    copilotWeights = new Map(newWeights);
    
    // 5. Calculate forward returns for this month
    const monthReturns = calculateMonthReturns(allPrices, validTickers, allDates, startIdx, endIdx);
    
    // Copilot return (with new weights, minus trading costs)
    let copilotReturn = 0;
    for (const t of validTickers) {
      copilotReturn += (copilotWeights.get(t) || 0) * (monthReturns.get(t) || 0);
    }
    copilotReturn -= tradingCosts;
    
    // Buy-and-hold return (weights drift naturally)
    let buyHoldReturn = 0;
    for (const t of validTickers) {
      buyHoldReturn += (buyHoldWeights.get(t) || 0) * (monthReturns.get(t) || 0);
    }
    
    // Update buy-and-hold weights (drift with returns)
    let totalBHValue = 0;
    const bhValues = new Map<string, number>();
    for (const t of validTickers) {
      const val = (buyHoldWeights.get(t) || 0) * (1 + (monthReturns.get(t) || 0));
      bhValues.set(t, val);
      totalBHValue += val;
    }
    if (totalBHValue > 0) {
      for (const t of validTickers) {
        buyHoldWeights.set(t, (bhValues.get(t) || 0) / totalBHValue);
      }
    }

    // Update cumulative equity
    cumCopilot *= (1 + copilotReturn);
    cumBuyHold *= (1 + buyHoldReturn);
    
    equityCopilot.push(cumCopilot);
    equityBuyHold.push(cumBuyHold);
    equityDates.push(endDate);

    // Record monthly snapshot
    const monthLabel = startDate.substring(0, 7); // YYYY-MM
    monthly.push({
      date: startDate,
      month: monthLabel,
      copilotReturn,
      buyHoldReturn,
      alpha: copilotReturn - buyHoldReturn,
      weights: Object.fromEntries(copilotWeights),
      rankings: rankings.slice(0, 5).map(r => ({ ticker: r.ticker, score: r.rankScore, signal: r.signal })),
      turnover,
      tradingCosts,
    });
  }

  // Calculate summary statistics
  const monthlyAlphas = monthly.map(m => m.alpha);
  const monthlyCopilotReturns = monthly.map(m => m.copilotReturn);
  const monthlyBHReturns = monthly.map(m => m.buyHoldReturn);

  const summary = {
    copilotTotalReturn: cumCopilot - 1,
    buyHoldTotalReturn: cumBuyHold - 1,
    alpha: cumCopilot - cumBuyHold,
    alphaAnnualized: ((cumCopilot / cumBuyHold) ** (12 / monthly.length) - 1),
    copilotSharpe: calculateSharpeFromReturns(monthlyCopilotReturns),
    buyHoldSharpe: calculateSharpeFromReturns(monthlyBHReturns),
    copilotMaxDrawdown: calculateMaxDrawdownFromEquity(equityCopilot),
    buyHoldMaxDrawdown: calculateMaxDrawdownFromEquity(equityBuyHold),
    hitRate: monthlyAlphas.filter(a => a > 0).length / monthlyAlphas.length,
    avgMonthlyAlpha: monthlyAlphas.length > 0 ? ss.mean(monthlyAlphas) : 0,
    totalTurnover: monthly.reduce((sum, m) => sum + m.turnover, 0),
    totalTradingCosts: monthly.reduce((sum, m) => sum + m.tradingCosts, 0),
    monthsPositive: monthlyCopilotReturns.filter(r => r > 0).length,
    monthsOutperformed: monthlyAlphas.filter(a => a > 0).length,
  };

  return {
    summary,
    monthly,
    equityCurve: {
      dates: equityDates,
      copilot: equityCopilot,
      buyHold: equityBuyHold,
    },
    tickers: validTickers,
    config: cfg,
    computedAt: new Date().toISOString(),
  };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function findCommonDates(
  allPrices: Map<string, Array<{ date: string; close: number }>>,
  tickers: string[]
): string[] {
  // Find dates where ALL tickers have data
  const dateSets = tickers.map(t => new Set((allPrices.get(t) || []).map(p => p.date)));
  
  if (dateSets.length === 0) return [];
  
  // Start with the first ticker's dates
  let commonDates = [...dateSets[0]];
  
  // Intersect with all other tickers
  for (let i = 1; i < dateSets.length; i++) {
    commonDates = commonDates.filter(d => dateSets[i].has(d));
  }
  
  return commonDates.sort();
}

function getMonthlyRebalanceDates(allDates: string[], months: number): string[] {
  // Get the last N+1 month boundaries (first trading day of each month)
  const monthBoundaries: string[] = [];
  let lastMonth = '';
  
  for (const date of allDates) {
    const month = date.substring(0, 7); // YYYY-MM
    if (month !== lastMonth) {
      monthBoundaries.push(date);
      lastMonth = month;
    }
  }
  
  // Take the last (months + 1) boundaries (we need months+1 dates to get months intervals)
  const startIdx = Math.max(0, monthBoundaries.length - months - 1);
  return monthBoundaries.slice(startIdx);
}

function buildHoldingsAtDate(
  allPrices: Map<string, Array<{ date: string; close: number }>>,
  tickers: string[],
  allDates: string[],
  dateIdx: number,
  lookbackDays: number,
  currentWeights: Map<string, number>
): PortfolioHolding[] {
  const holdings: PortfolioHolding[] = [];
  
  for (const ticker of tickers) {
    const priceData = allPrices.get(ticker) || [];
    const dateMap = new Map(priceData.map(p => [p.date, p.close]));
    
    // Get lookback prices ending at dateIdx
    const lookbackStart = Math.max(0, dateIdx - lookbackDays);
    const relevantDates = allDates.slice(lookbackStart, dateIdx + 1);
    const prices: number[] = [];
    
    for (const d of relevantDates) {
      const price = dateMap.get(d);
      if (price != null) prices.push(price);
    }
    
    if (prices.length < 20) continue;
    
    holdings.push({
      ticker,
      companyName: ticker,
      weight: currentWeights.get(ticker) || 1 / tickers.length,
      shares: 1, // Not relevant for backtest
      currentPrice: prices[prices.length - 1],
      currency: 'USD',
      prices,
      volumes: [], // Not critical for ranking
      fundamentals: {},
    });
  }
  
  return holdings;
}

function calculateTargetWeights(
  rankings: RankingResult[],
  tickers: string[],
  cfg: BacktestConfig,
  currentWeights: Map<string, number>
): Map<string, number> {
  const weights = new Map<string, number>();
  
  if (rankings.length === 0) {
    // Fallback to equal weight
    for (const t of tickers) weights.set(t, 1 / tickers.length);
    return weights;
  }

  // Score-weighted allocation (unconstrained target)
  const totalScore = rankings.reduce((sum, r) => sum + Math.max(r.rankScore, 10), 0);
  
  for (const r of rankings) {
    let w = Math.max(r.rankScore, 10) / totalScore;
    // Apply position size constraints
    w = Math.max(cfg.minPositionSize, Math.min(cfg.maxPositionSize, w));
    weights.set(r.ticker, w);
  }
  
  // Normalize to sum to 1
  let total = [...weights.values()].reduce((sum, w) => sum + w, 0);
  if (total > 0) {
    for (const [t, w] of weights) {
      weights.set(t, w / total);
    }
  }

  // Apply turnover constraint: limit total weight change per month
  const maxTurnover = cfg.maxTurnoverPerMonth;
  let proposedTurnover = 0;
  for (const t of tickers) {
    proposedTurnover += Math.abs((weights.get(t) || 0) - (currentWeights.get(t) || 0));
  }

  if (proposedTurnover > maxTurnover && proposedTurnover > 0) {
    // Scale down the changes proportionally
    const scaleFactor = maxTurnover / proposedTurnover;
    for (const t of tickers) {
      const currentW = currentWeights.get(t) || 0;
      const targetW = weights.get(t) || 0;
      const delta = targetW - currentW;
      const constrainedW = currentW + delta * scaleFactor;
      weights.set(t, Math.max(0, constrainedW));
    }
    // Re-normalize after constraint
    total = [...weights.values()].reduce((sum, w) => sum + w, 0);
    if (total > 0) {
      for (const [t, w] of weights) {
        weights.set(t, w / total);
      }
    }
  }
  
  return weights;
}

function calculateTurnover(
  oldWeights: Map<string, number>,
  newWeights: Map<string, number>,
  tickers: string[]
): number {
  let turnover = 0;
  for (const t of tickers) {
    turnover += Math.abs((newWeights.get(t) || 0) - (oldWeights.get(t) || 0));
  }
  return turnover; // 0-2 range (sum of absolute changes)
}

function calculateMonthReturns(
  allPrices: Map<string, Array<{ date: string; close: number }>>,
  tickers: string[],
  allDates: string[],
  startIdx: number,
  endIdx: number
): Map<string, number> {
  const returns = new Map<string, number>();
  
  for (const ticker of tickers) {
    const priceData = allPrices.get(ticker) || [];
    const dateMap = new Map(priceData.map(p => [p.date, p.close]));
    
    const startPrice = dateMap.get(allDates[startIdx]);
    const endPrice = dateMap.get(allDates[endIdx]);
    
    if (startPrice && endPrice && startPrice > 0) {
      returns.set(ticker, endPrice / startPrice - 1);
    } else {
      returns.set(ticker, 0);
    }
  }
  
  return returns;
}

function calculateSharpeFromReturns(monthlyReturns: number[]): number {
  if (monthlyReturns.length < 3) return 0;
  const mean = ss.mean(monthlyReturns);
  const std = ss.standardDeviation(monthlyReturns);
  if (std === 0) return 0;
  // Annualize: monthly Sharpe * sqrt(12), subtract risk-free (2% / 12 per month)
  const riskFreeMonthly = DEFAULT_RISK_FREE_RATE / 12;
  return ((mean - riskFreeMonthly) / std) * Math.sqrt(12);
}

function calculateMaxDrawdownFromEquity(equity: number[]): number {
  let maxDD = 0;
  let peak = equity[0];
  for (const val of equity) {
    if (val > peak) peak = val;
    const dd = (peak - val) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}
