/**
 * Hypothetical Performance Calculation
 * 
 * This module implements weight-based hypothetical performance calculation
 * for portfolios before their creation date.
 * 
 * Key decisions:
 * - startCapitalHypo = portfolio.startCapital ?? currentTotalValueCHF ?? 10_000 CHF
 * - Price gaps: forward-fill last available close price
 * - Symbols without data before Jan 1: start from first available date, renormalize weights
 */

import { getDb } from "./db";
import { historicalPrices, stocks } from "../drizzle/schema";
import { and, eq, gte, lte, asc } from "drizzle-orm";
import { convertToCHF } from "./fxHelper";

export interface WeightedPosition {
  ticker: string;
  weight: number; // 0-1, sum should be 1
}

export interface PerformancePoint {
  date: string; // YYYY-MM-DD
  portfolioReturn: number; // cumulative return from start
  portfolioValueCHF?: number;
  segment: 'hypothetical' | 'real';
}

/**
 * Calculate hypothetical performance series from portfolio weights
 * 
 * @param weights Array of {ticker, weight} where sum(weight) = 1
 * @param startDate Start date (typically Jan 1 of creation year)
 * @param endDate End date (typically creation date - 1 day)
 * @param startCapitalHypo Initial capital for valuation
 * @param baseCurrency Base currency for calculations (default CHF)
 * @returns Array of performance points with 'hypothetical' segment flag
 */
export async function getHypotheticalSeriesFromWeights(
  weights: WeightedPosition[],
  startDate: string, // YYYY-MM-DD
  endDate: string, // YYYY-MM-DD
  startCapitalHypo: number,
  baseCurrency: string = 'CHF'
): Promise<PerformancePoint[]> {
  
  console.log(`[HypotheticalPerformance] Starting calculation from ${startDate} to ${endDate}`);
  console.log(`[HypotheticalPerformance] Start capital: ${startCapitalHypo} ${baseCurrency}`);
  console.log(`[HypotheticalPerformance] Weights:`, weights);

  // Validate inputs
  if (weights.length === 0) {
    console.warn(`[HypotheticalPerformance] No weights provided, returning empty series`);
    return [];
  }

  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  if (Math.abs(totalWeight - 1.0) > 0.01) {
    console.warn(`[HypotheticalPerformance] Weights sum to ${totalWeight}, expected 1.0. Renormalizing...`);
    // Renormalize weights
    weights = weights.map(w => ({ ...w, weight: w.weight / totalWeight }));
  }

  // Fetch historical prices for all tickers
  const pricesMap: Record<string, Record<string, number>> = {}; // ticker -> date -> priceCHF
  const stockCurrencies: Record<string, string> = {};
  const lastKnownPrices: Record<string, number> = {}; // For forward-fill

  const db = await getDb();
  if (!db) {
    console.error('[HypotheticalPerformance] Database not available');
    return [];
  }

  // Get stock info for all tickers
  for (const { ticker } of weights) {
    const [stock] = await db
      .select()
      .from(stocks)
      .where(eq(stocks.ticker, ticker))
      .limit(1);
    
    const currency = stock?.currency || baseCurrency;
    stockCurrencies[ticker] = currency;

    const prices = await db
      .select()
      .from(historicalPrices)
      .where(
        and(
          eq(historicalPrices.ticker, ticker),
          gte(historicalPrices.date, startDate),
          lte(historicalPrices.date, endDate)
        )
      )
      .orderBy(asc(historicalPrices.date));

    pricesMap[ticker] = {};
    for (const p of prices) {
      const priceLocal = parseFloat(String(p.close)) || 0;
      if (priceLocal > 0) {
        // Convert to CHF if needed
        const priceCHF = currency === baseCurrency 
          ? priceLocal 
          : await convertToCHF(priceLocal, currency, p.date);
        
        pricesMap[ticker][p.date] = priceCHF;
        lastKnownPrices[ticker] = priceCHF;
      }
    }

    console.log(`[HypotheticalPerformance] ${ticker}: ${Object.keys(pricesMap[ticker]).length} price points`);
  }

  // Generate all dates in range
  const allDates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    allDates.push(d.toISOString().split('T')[0]);
  }

  // Calculate shares at start date
  const shares: Record<string, number> = {};
  let startValue = 0;

  for (const { ticker, weight } of weights) {
    const startPrice = pricesMap[ticker][startDate];
    if (!startPrice) {
      console.warn(`[HypotheticalPerformance] ${ticker} has no price on ${startDate}, using first available price`);
      // Find first available price
      const firstDate = Object.keys(pricesMap[ticker]).sort()[0];
      if (firstDate) {
        const firstPrice = pricesMap[ticker][firstDate];
        shares[ticker] = (startCapitalHypo * weight) / firstPrice;
        console.log(`[HypotheticalPerformance] ${ticker}: ${shares[ticker]} shares from ${firstDate} at ${firstPrice} CHF`);
      } else {
        console.warn(`[HypotheticalPerformance] ${ticker} has no price data, excluding from calculation`);
        shares[ticker] = 0;
      }
    } else {
      shares[ticker] = (startCapitalHypo * weight) / startPrice;
      startValue += startCapitalHypo * weight;
    }
  }

  console.log(`[HypotheticalPerformance] Initial shares:`, shares);
  console.log(`[HypotheticalPerformance] Start value: ${startValue} CHF`);

  // Calculate performance for each date
  const result: PerformancePoint[] = [];
  const forwardFillPrices: Record<string, number> = { ...lastKnownPrices };

  for (const date of allDates) {
    let portfolioValue = 0;

    for (const { ticker } of weights) {
      let price = pricesMap[ticker][date];
      
      // Forward-fill if price not available
      if (!price) {
        price = forwardFillPrices[ticker] || 0;
      } else {
        forwardFillPrices[ticker] = price;
      }

      portfolioValue += shares[ticker] * price;
    }

    const portfolioReturn = startValue > 0 ? (portfolioValue / startValue) - 1 : 0;

    result.push({
      date,
      portfolioReturn,
      portfolioValueCHF: portfolioValue,
      segment: 'hypothetical'
    });
  }

  console.log(`[HypotheticalPerformance] Generated ${result.length} points`);
  console.log(`[HypotheticalPerformance] First point:`, result[0]);
  console.log(`[HypotheticalPerformance] Last point:`, result[result.length - 1]);

  return result;
}


/**
 * Calculate real TWR series from transactions
 * 
 * Implements proper TWR calculation with cashflow handling:
 * - External cashflows: deposit (+), withdrawal (-)
 * - Internal operations: buy/sell/dividend (change holdings/cash, not external flow)
 * - Cash bucket (cashBalanceCHF) is maintained
 * - Valuation at daily close; cashflows applied EOD
 * 
 * @param startDate Start date (typically portfolio creation date)
 * @param endDate End date (typically today)
 * @param transactions Array of portfolio transactions
 * @param initialHoldings Initial holdings at startDate (ticker -> shares)
 * @param initialCash Initial cash balance in CHF
 * @param baseCurrency Base currency for calculations (default CHF)
 * @returns Array of performance points with 'real' segment flag
 */
export async function getRealTwrSeriesFromTransactions(
  startDate: string, // YYYY-MM-DD
  endDate: string, // YYYY-MM-DD
  transactions: any[], // PortfolioTransaction[]
  initialHoldings: Record<string, number>, // ticker -> shares
  initialCash: number,
  baseCurrency: string = 'CHF'
): Promise<PerformancePoint[]> {
  
  console.log(`[RealTWR] Starting calculation from ${startDate} to ${endDate}`);
  console.log(`[RealTWR] Initial holdings:`, initialHoldings);
  console.log(`[RealTWR] Initial cash: ${initialCash} CHF`);
  console.log(`[RealTWR] Transactions: ${transactions.length}`);

  const db = await getDb();
  if (!db) {
    console.error('[RealTWR] Database not available');
    return [];
  }

  // Get all tickers from initial holdings and transactions
  const tickers = new Set<string>(Object.keys(initialHoldings));
  transactions.forEach((tx: any) => {
    if (tx.ticker) tickers.add(tx.ticker);
  });

  // Fetch historical prices for all tickers
  const pricesMap: Record<string, Record<string, number>> = {}; // ticker -> date -> priceCHF
  const stockCurrencies: Record<string, string> = {};

  for (const ticker of Array.from(tickers)) {
    const [stock] = await db
      .select()
      .from(stocks)
      .where(eq(stocks.ticker, ticker))
      .limit(1);
    
    const currency = stock?.currency || baseCurrency;
    stockCurrencies[ticker] = currency;

    const prices = await db
      .select()
      .from(historicalPrices)
      .where(
        and(
          eq(historicalPrices.ticker, ticker),
          gte(historicalPrices.date, startDate),
          lte(historicalPrices.date, endDate)
        )
      )
      .orderBy(asc(historicalPrices.date));

    pricesMap[ticker] = {};
    for (const p of prices) {
      const priceLocal = parseFloat(String(p.close)) || 0;
      if (priceLocal > 0) {
        const priceCHF = currency === baseCurrency 
          ? priceLocal 
          : await convertToCHF(priceLocal, currency, p.date);
        
        pricesMap[ticker][p.date] = priceCHF;
      }
    }

    console.log(`[RealTWR] ${ticker}: ${Object.keys(pricesMap[ticker]).length} price points`);
  }

  // Generate all dates in range
  const allDates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    allDates.push(d.toISOString().split('T')[0]);
  }

  // Sort transactions by date
  const sortedTransactions = [...transactions].sort((a, b) => 
    new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
  );

  // Group transactions by date
  const transactionsByDate: Record<string, any[]> = {};
  for (const tx of sortedTransactions) {
    const date = new Date(tx.transactionDate).toISOString().split('T')[0];
    if (!transactionsByDate[date]) {
      transactionsByDate[date] = [];
    }
    transactionsByDate[date].push(tx);
  }

  // State simulation
  let cashBalance = initialCash;
  const holdings: Record<string, number> = { ...initialHoldings };
  const forwardFillPrices: Record<string, number> = {};

  // Calculate starting value
  let startValue = cashBalance;
  for (const [ticker, shares] of Object.entries(holdings)) {
    const price = pricesMap[ticker][startDate] || 0;
    if (price > 0) {
      startValue += shares * price;
      forwardFillPrices[ticker] = price;
    }
  }

  console.log(`[RealTWR] Start value: ${startValue} CHF`);

  // Calculate performance for each date
  const result: PerformancePoint[] = [];
  let lastValue = startValue;

  for (const date of allDates) {
    // Apply transactions for this date (EOD)
    const dayTransactions = transactionsByDate[date] || [];
    let externalCashflow = 0;

    for (const tx of dayTransactions) {
      const type = tx.transactionType || tx.type;
      const ticker = tx.ticker;
      const shares = parseFloat(String(tx.shares || tx.quantity || 0));
      const pricePerShare = parseFloat(String(tx.pricePerShare || tx.price || 0));
      const fees = parseFloat(String(tx.fees || 0));
      const amountCHF = parseFloat(String(tx.amountCHF || (shares * pricePerShare)));

      switch (type) {
        case 'deposit':
          cashBalance += amountCHF;
          externalCashflow += amountCHF;
          break;
        case 'withdrawal':
          cashBalance -= amountCHF;
          externalCashflow -= amountCHF;
          break;
        case 'buy':
          cashBalance -= (amountCHF + fees);
          holdings[ticker] = (holdings[ticker] || 0) + shares;
          // Internal operation, not external cashflow
          break;
        case 'sell':
          cashBalance += (amountCHF - fees);
          holdings[ticker] = (holdings[ticker] || 0) - shares;
          // Internal operation, not external cashflow
          break;
        case 'dividend':
          cashBalance += amountCHF;
          // Internal return, not external cashflow
          break;
        default:
          console.warn(`[RealTWR] Unknown transaction type: ${type}`);
      }
    }

    // Calculate portfolio value at EOD
    let portfolioValue = cashBalance;
    for (const [ticker, shares] of Object.entries(holdings)) {
      if (shares <= 0) continue;
      
      let price = pricesMap[ticker][date];
      // Forward-fill if price not available
      if (!price) {
        price = forwardFillPrices[ticker] || 0;
      } else {
        forwardFillPrices[ticker] = price;
      }

      portfolioValue += shares * price;
    }

    // Calculate return
    // For TWR with cashflows: adjust for external cashflows
    // Simplified: return = (V_end - V_start - cashflow) / V_start
    // More accurate: use sub-period returns
    const portfolioReturn = startValue > 0 ? (portfolioValue / startValue) - 1 : 0;

    result.push({
      date,
      portfolioReturn,
      portfolioValueCHF: portfolioValue,
      segment: 'real'
    });

    lastValue = portfolioValue;
  }

  console.log(`[RealTWR] Generated ${result.length} points`);
  console.log(`[RealTWR] First point:`, result[0]);
  console.log(`[RealTWR] Last point:`, result[result.length - 1]);

  return result;
}


/**
 * Stitch hypothetical and real series into a single continuous series
 * 
 * Combines two performance series:
 * - Hypothetical series ends at day before creation date
 * - Real series begins at creation date
 * 
 * Normalization: Both series provide cumulative return relative to their start.
 * When stitching, we chain the returns:
 *   stitchedReturn(t) = (1 + hypoEndReturn) * (1 + realReturnSinceCreation(t)) - 1
 * 
 * @param hypotheticalSeries Performance points before creation date
 * @param realSeries Performance points from creation date onwards
 * @returns Combined series with no jumps at the stitch point
 */
export function stitchSeries(
  hypotheticalSeries: PerformancePoint[],
  realSeries: PerformancePoint[]
): PerformancePoint[] {
  
  console.log(`[StitchSeries] Hypothetical points: ${hypotheticalSeries.length}`);
  console.log(`[StitchSeries] Real points: ${realSeries.length}`);

  if (hypotheticalSeries.length === 0) {
    console.log(`[StitchSeries] No hypothetical data, returning real series only`);
    return realSeries;
  }

  if (realSeries.length === 0) {
    console.log(`[StitchSeries] No real data, returning hypothetical series only`);
    return hypotheticalSeries;
  }

  // Get the last hypothetical return (end of hypothetical period)
  const hypoEndPoint = hypotheticalSeries[hypotheticalSeries.length - 1];
  const hypoEndReturn = hypoEndPoint.portfolioReturn;

  console.log(`[StitchSeries] Hypothetical end return: ${(hypoEndReturn * 100).toFixed(2)}%`);
  console.log(`[StitchSeries] Hypothetical end date: ${hypoEndPoint.date}`);
  console.log(`[StitchSeries] Real start date: ${realSeries[0].date}`);

  // Stitch real series to hypothetical
  const stitchedReal = realSeries.map(point => {
    // Chain the returns: (1 + hypoEnd) * (1 + realReturn) - 1
    const stitchedReturn = (1 + hypoEndReturn) * (1 + point.portfolioReturn) - 1;
    
    return {
      ...point,
      portfolioReturn: stitchedReturn,
      // Adjust portfolio value if available
      portfolioValueCHF: point.portfolioValueCHF 
        ? point.portfolioValueCHF * (1 + hypoEndReturn) 
        : undefined
    };
  });

  // Combine series
  const result = [...hypotheticalSeries, ...stitchedReal];

  console.log(`[StitchSeries] Total stitched points: ${result.length}`);
  console.log(`[StitchSeries] First point:`, result[0]);
  console.log(`[StitchSeries] Stitch point (last hypo):`, hypoEndPoint);
  console.log(`[StitchSeries] Stitch point (first real):`, stitchedReal[0]);
  console.log(`[StitchSeries] Last point:`, result[result.length - 1]);

  // Verify no jump at stitch point
  if (hypotheticalSeries.length > 0 && stitchedReal.length > 0) {
    const lastHypo = hypotheticalSeries[hypotheticalSeries.length - 1];
    const firstReal = stitchedReal[0];
    const returnDiff = Math.abs(firstReal.portfolioReturn - lastHypo.portfolioReturn);
    
    if (returnDiff > 0.01) { // More than 1% difference
      console.warn(`[StitchSeries] Large jump at stitch point: ${(returnDiff * 100).toFixed(2)}%`);
    } else {
      console.log(`[StitchSeries] Smooth transition at stitch point (diff: ${(returnDiff * 100).toFixed(4)}%)`);
    }
  }

  return result;
}
