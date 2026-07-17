/**
 * Portfolio Performance Service
 * 
 * Bridges the raw database data (transactions, historical prices, FX rates)
 * to the performance engine (TTWROR + IRR calculation).
 * 
 * This is the single source of truth for all performance calculations in the app.
 */

import {
  calculateTTWROR,
  calculateIRR,
  calculatePerformance,
  buildDailyValuations,
  buildHoldingsTimeline,
  extractPortfolioCashFlows,
  type CashFlow,
  type DailyValuation,
  type TTWRORResult,
  type IRRResult,
  type PerformanceMetrics,
} from './performanceEngine';
import { getGrossAmountCHF, getFeesCHF, getSignedFlowCHF, withResolvedGrossAmountCHF, type FxRateForDateLookup } from './transactionSemantics';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PortfolioPerformanceInput {
  portfolioId: number;
  /** Start of measurement period (YYYY-MM-DD) */
  startDate: string;
  /** End of measurement period (YYYY-MM-DD) */
  endDate: string;
  /** Whether to include hypothetical performance before live start date */
  includeHypothetical?: boolean;
}

export interface PortfolioPerformanceResult {
  /** TTWROR metrics */
  ttwror: TTWRORResult;
  /** IRR metrics */
  irr: IRRResult;
  /** Start date used */
  startDate: string;
  /** End date used */
  endDate: string;
  /** Current portfolio value in CHF */
  currentValueCHF: number;
  /** Total invested (all inflows) in CHF */
  totalInvestedCHF: number;
  /** Absolute gain/loss in CHF */
  absoluteGainCHF: number;
  /** Daily performance series for charting (cumulative % returns) */
  dailySeries: Array<{ date: string; cumulativeReturn: number }>;
  /**
   * Daily portfolio market values in CHF (stocks + cash), valued with
   * HISTORICAL prices (R-04) — the value-history counterpart to dailySeries.
   */
  dailyValuations: DailyValuation[];
  /**
   * Ticker mit Beständen, für die im Zeitraum KEINE historicalPrices-Zeile
   * existiert. Diese Positionen fehlen in der Bewertung (buildDailyValuations
   * lässt sie weg) — die Kurve ist dann unvollständig/zu flach. Aufrufer
   * sollen das dem Nutzer sagen statt eine stille 0-%-Linie zu zeigen.
   */
  unpricedTickers?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Service Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate full performance metrics for a portfolio
 * 
 * This function:
 * 1. Loads transactions from DB
 * 2. Builds holdings timeline (what was held on each day)
 * 3. Gets historical prices for all tickers
 * 4. Converts everything to CHF
 * 5. Builds daily portfolio valuations
 * 6. Runs TTWROR and IRR calculations
 * 
 * @param input - Portfolio ID and date range
 * @returns Full performance metrics
 */
export async function calculatePortfolioPerformance(
  input: PortfolioPerformanceInput
): Promise<PortfolioPerformanceResult> {
  const { getDb, getPortfolioTransactions, getSavedPortfolioById } = await import('../db');
  const { batchGetStocks } = await import('../db-optimized');
  const { convertToCHF, tryGetFxRate } = await import('../fxHelper');
  const { historicalPrices } = await import('../../drizzle/schema');
  const { inArray, and, gte, lte } = await import('drizzle-orm');

  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  // 1. Load transactions
  const rawTransactions = await getPortfolioTransactions(input.portfolioId);
  if (rawTransactions.length === 0) {
    return emptyResult(input.startDate, input.endDate);
  }

  // R-15: Zeilen ohne totalAmountCHF/fxRate werden mit dem FX-Kurs zum
  // TRANSAKTIONSDATUM aufgelöst, bevor Cash-Timeline und Flows sie lesen
  // (vorher: Lokalbetrag stillschweigend als CHF).
  const fxLookup: FxRateForDateLookup = (currency, date) => tryGetFxRate(date, `${currency}CHF`);
  const transactions = await withResolvedGrossAmountCHF(rawTransactions as any[], fxLookup);

  // 2. Get all unique tickers from transactions
  const allTickers = new Set<string>();
  for (const tx of transactions) {
    if (tx.ticker) allTickers.add(tx.ticker);
  }
  if (allTickers.size === 0) {
    return emptyResult(input.startDate, input.endDate);
  }

  // 3. Get stock metadata (for currency info)
  const stocksMap = await batchGetStocks(Array.from(allTickers));

  // 4. Get historical prices for the entire period
  const tickerArray = Array.from(allTickers);
  const pricesResult = await db.select().from(historicalPrices)
    .where(and(
      inArray(historicalPrices.ticker, tickerArray),
      gte(historicalPrices.date, input.startDate),
      lte(historicalPrices.date, input.endDate)
    ));

  // Build price maps: ticker -> date -> price (in original currency)
  // R-11: adjustedClose (split-bereinigt) für die Renditeserie, Fallback close.
  const rawPriceMap = new Map<string, Map<string, number>>();
  for (const p of pricesResult) {
    if (!rawPriceMap.has(p.ticker)) rawPriceMap.set(p.ticker, new Map());
    rawPriceMap.get(p.ticker)!.set(p.date, parseFloat(p.adjustedClose ?? p.close));
  }

  // Ehrlichkeit: Ticker ganz ohne Kursdaten im Zeitraum fehlen in der Bewertung
  // (buildDailyValuations lässt sie weg) — an die Aufrufer melden.
  const unpricedTickers = tickerArray.filter((t) => !(rawPriceMap.get(t)?.size)).sort();

  // 5. Get all trading dates in the period
  const allDates = new Set<string>();
  for (const tickerPrices of rawPriceMap.values()) {
    for (const date of tickerPrices.keys()) {
      allDates.add(date);
    }
  }
  const sortedDates = Array.from(allDates).sort();

  if (sortedDates.length === 0) {
    return { ...emptyResult(input.startDate, input.endDate), unpricedTickers };
  }

  // 6. Convert all prices to CHF
  // First, collect unique currencies
  const currencyByTicker = new Map<string, string>();
  for (const [ticker, stock] of stocksMap.entries()) {
    currencyByTicker.set(ticker, (stock as any).currency || 'CHF');
  }

  // Get FX rates - we'll use a simplified approach: get rate for start and end,
  // and for intermediate dates use the nearest available
  const pricesCHF = new Map<string, Map<string, number>>();
  for (const [ticker, datePrices] of rawPriceMap.entries()) {
    const currency = currencyByTicker.get(ticker) || 'CHF';
    const chfPrices = new Map<string, number>();

    if (currency === 'CHF') {
      // No conversion needed
      for (const [date, price] of datePrices.entries()) {
        chfPrices.set(date, price);
      }
    } else {
      // Convert each price to CHF
      // For efficiency, batch convert using a single FX rate per date range
      // (FX rates don't change dramatically day-to-day)
      const fxRateCache = new Map<string, number>();

      for (const [date, price] of datePrices.entries()) {
        let fxRate = fxRateCache.get(date);
        if (fxRate === undefined) {
          // Get FX rate for this date (convertToCHF returns amount * rate)
          fxRate = await convertToCHF(1, currency, date);
          fxRateCache.set(date, fxRate);
        }
        chfPrices.set(date, price * fxRate);
      }
    }

    pricesCHF.set(ticker, chfPrices);
  }

  // 7. Build holdings timeline
  const holdingsTimeline = buildHoldingsTimeline(transactions as any, sortedDates);

  // 8. Build cash balance timeline
  // Cash balance changes with deposits/withdrawals and buy/sell transactions
  const cashBalances = buildCashTimeline(transactions as any, sortedDates);

  // 9. Build daily valuations
  const valuations = buildDailyValuations(holdingsTimeline, pricesCHF, cashBalances, sortedDates);

  // 10. Extract external cash flows (deposits/withdrawals only)
  const cashFlows = extractPortfolioCashFlows(transactions as any);

  // 11. Calculate TTWROR
  const ttwror = calculateTTWROR(valuations, cashFlows);

  // 12. Calculate IRR
  const mvb = valuations.length > 0 ? valuations[0].marketValue : 0;
  const mve = valuations.length > 0 ? valuations[valuations.length - 1].marketValue : 0;

  // R-37: Flows am (oder vor dem) ersten Bewertungstag stecken bereits im MVB
  // (Tagesend-Bewertung inkl. Cash) und dürfen nicht zusätzlich als IRR-Flow
  // bzw. als «investiert» gezählt werden. Die Flows sind bereits vorzeichen-
  // normalisiert (Deposits positiv, Withdrawals negativ — R-01,
  // siehe lib/transactionSemantics.ts).
  const firstValuationDate = valuations.length > 0 ? valuations[0].date : input.startDate;
  const postBaselineFlows: CashFlow[] = cashFlows.filter(cf => cf.date > firstValuationDate);

  // R-17: IRR-Periode an die tatsächlich BEWERTETEN Stichtage koppeln (erster/
  // letzter Preisstand). Vorher lief die Periode bis input.endDate (bei
  // Aufrufern oft «heute» via new Date()), obwohl MVE am letzten Preisdatum
  // steht — die Periode war zu lang, die annualisierte IRR zu tief.
  const lastValuationDate = valuations.length > 0 ? valuations[valuations.length - 1].date : input.endDate;
  const irr = calculateIRR(mvb, mve, postBaselineFlows, firstValuationDate, lastValuationDate);

  // 13. Calculate totals
  const totalInvested = postBaselineFlows
    .filter(cf => cf.amount > 0)
    .reduce((sum, cf) => sum + cf.amount, 0) + mvb;

  const currentValueCHF = mve;
  const totalWithdrawn = postBaselineFlows
    .filter(cf => cf.amount < 0)
    .reduce((sum, cf) => sum + Math.abs(cf.amount), 0);

  const absoluteGainCHF = currentValueCHF + totalWithdrawn - totalInvested;

  return {
    ttwror,
    irr,
    startDate: input.startDate,
    endDate: input.endDate,
    currentValueCHF,
    totalInvestedCHF: totalInvested,
    absoluteGainCHF,
    dailySeries: ttwror.dailySeries,
    dailyValuations: valuations,
    unpricedTickers,
  };
}

/**
 * Calculate performance for multiple portfolios aggregated
 */
export async function calculateAggregatedPerformance(
  portfolioIds: number[],
  startDate: string,
  endDate: string
): Promise<PortfolioPerformanceResult> {
  const { getDb, getPortfolioTransactions } = await import('../db');
  const { batchGetStocks } = await import('../db-optimized');
  const { convertToCHF, tryGetFxRate } = await import('../fxHelper');
  const { historicalPrices } = await import('../../drizzle/schema');
  const { inArray, and, gte, lte } = await import('drizzle-orm');

  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  // Collect all transactions from all portfolios
  const rawAllTransactions: any[] = [];
  const allTickers = new Set<string>();

  for (const pid of portfolioIds) {
    const txs = await getPortfolioTransactions(pid);
    rawAllTransactions.push(...txs);
    for (const tx of txs) {
      if (tx.ticker) allTickers.add(tx.ticker);
    }
  }

  if (rawAllTransactions.length === 0 || allTickers.size === 0) {
    return emptyResult(startDate, endDate);
  }

  // R-15: fehlende totalAmountCHF mit FX-Kurs zum Transaktionsdatum auflösen.
  const fxLookup: FxRateForDateLookup = (currency, date) => tryGetFxRate(date, `${currency}CHF`);
  const allTransactions = await withResolvedGrossAmountCHF(rawAllTransactions, fxLookup);

  // Get stock metadata
  const stocksMap = await batchGetStocks(Array.from(allTickers));

  // Get historical prices
  const tickerArray = Array.from(allTickers);
  const pricesResult = await db.select().from(historicalPrices)
    .where(and(
      inArray(historicalPrices.ticker, tickerArray),
      gte(historicalPrices.date, startDate),
      lte(historicalPrices.date, endDate)
    ));

  // Build price maps
  // R-11: adjustedClose (split-bereinigt) für die Renditeserie, Fallback close.
  const rawPriceMap = new Map<string, Map<string, number>>();
  for (const p of pricesResult) {
    if (!rawPriceMap.has(p.ticker)) rawPriceMap.set(p.ticker, new Map());
    rawPriceMap.get(p.ticker)!.set(p.date, parseFloat(p.adjustedClose ?? p.close));
  }

  // Get all dates
  const allDates = new Set<string>();
  for (const tickerPrices of rawPriceMap.values()) {
    for (const date of tickerPrices.keys()) allDates.add(date);
  }
  const sortedDates = Array.from(allDates).sort();

  if (sortedDates.length === 0) {
    return emptyResult(startDate, endDate);
  }

  // Convert prices to CHF
  const currencyByTicker = new Map<string, string>();
  for (const [ticker, stock] of stocksMap.entries()) {
    currencyByTicker.set(ticker, (stock as any).currency || 'CHF');
  }

  const pricesCHF = new Map<string, Map<string, number>>();
  for (const [ticker, datePrices] of rawPriceMap.entries()) {
    const currency = currencyByTicker.get(ticker) || 'CHF';
    const chfPrices = new Map<string, number>();

    if (currency === 'CHF') {
      for (const [date, price] of datePrices.entries()) chfPrices.set(date, price);
    } else {
      const fxRateCache = new Map<string, number>();
      for (const [date, price] of datePrices.entries()) {
        let fxRate = fxRateCache.get(date);
        if (fxRate === undefined) {
          fxRate = await convertToCHF(1, currency, date);
          fxRateCache.set(date, fxRate);
        }
        chfPrices.set(date, price * fxRate);
      }
    }
    pricesCHF.set(ticker, chfPrices);
  }

  // Build aggregated holdings timeline (all portfolios combined)
  const holdingsTimeline = buildHoldingsTimeline(allTransactions, sortedDates);

  // Build aggregated cash timeline
  const cashBalances = buildCashTimeline(allTransactions, sortedDates);

  // Build daily valuations
  const valuations = buildDailyValuations(holdingsTimeline, pricesCHF, cashBalances, sortedDates);

  // Extract cash flows
  const cashFlows = extractPortfolioCashFlows(allTransactions);

  // Calculate TTWROR
  const ttwror = calculateTTWROR(valuations, cashFlows);

  // Calculate IRR
  const mvb = valuations.length > 0 ? valuations[0].marketValue : 0;
  const mve = valuations.length > 0 ? valuations[valuations.length - 1].marketValue : 0;

  // R-37: Flows am (oder vor dem) ersten Bewertungstag stecken bereits im MVB —
  // nicht zusätzlich als IRR-Flow / «investiert» zählen (Flows sind bereits
  // vorzeichen-normalisiert, R-01 — siehe lib/transactionSemantics.ts).
  const firstValuationDate = valuations.length > 0 ? valuations[0].date : startDate;
  const postBaselineFlows: CashFlow[] = cashFlows.filter(cf => cf.date > firstValuationDate);
  // R-17: IRR-Periode an die bewerteten Stichtage koppeln (s. o. in
  // calculatePortfolioPerformance).
  const lastValuationDate = valuations.length > 0 ? valuations[valuations.length - 1].date : endDate;
  const irr = calculateIRR(mvb, mve, postBaselineFlows, firstValuationDate, lastValuationDate);

  // Totals
  const totalInvested = postBaselineFlows
    .filter(cf => cf.amount > 0)
    .reduce((sum, cf) => sum + cf.amount, 0) + mvb;
  const currentValueCHF = mve;
  const totalWithdrawn = postBaselineFlows
    .filter(cf => cf.amount < 0)
    .reduce((sum, cf) => sum + Math.abs(cf.amount), 0);
  const absoluteGainCHF = currentValueCHF + totalWithdrawn - totalInvested;

  return {
    ttwror,
    irr,
    startDate,
    endDate,
    currentValueCHF,
    totalInvestedCHF: totalInvested,
    absoluteGainCHF,
    dailySeries: ttwror.dailySeries,
    dailyValuations: valuations,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build cash balance timeline from transactions
 * Tracks how cash changes over time with deposits, withdrawals, buys, sells
 */
function buildCashTimeline(
  transactions: Array<{
    transactionType: string;
    transactionDate: Date | string;
    totalAmountCHF?: string | null;
    totalAmount?: string | null;
    ticker?: string | null;
    fees?: string | null;
  }>,
  dates: string[]
): Map<string, number> {
  // Sort transactions by date
  const sortedTxs = [...transactions].sort((a, b) => {
    const dateA = typeof a.transactionDate === 'string' ? a.transactionDate : a.transactionDate.toISOString();
    const dateB = typeof b.transactionDate === 'string' ? b.transactionDate : b.transactionDate.toISOString();
    return dateA.localeCompare(dateB);
  });

  // Build cumulative cash balance at each transaction date
  const txDates = new Map<string, number>(); // date -> cash change on that date
  for (const tx of sortedTxs) {
    const date = typeof tx.transactionDate === 'string'
      ? tx.transactionDate.split('T')[0]
      : tx.transactionDate.toISOString().split('T')[0];

    // Kanonische Semantik (siehe lib/transactionSemantics.ts):
    // totalAmountCHF = Brutto EXKL. Fees; Vorzeichen via Transaktionstyp.
    const amountCHF = getGrossAmountCHF(tx);
    const fees = getFeesCHF(tx);

    let cashChange = 0;
    switch (tx.transactionType) {
      case 'deposit':
      case 'entry':
      case 'withdrawal':
        // R-01: Deposit/Entry erhöhen Cash, Withdrawal senkt Cash — unabhängig
        // von der gespeicherten Vorzeichen-Konvention (vorher machte
        // `-amountCHF` aus einer negativ gespeicherten Entnahme einen Zufluss).
        cashChange = getSignedFlowCHF(tx);
        break;
      case 'buy':
        // Cash decreases (we spend money to buy shares); Brutto + Fees ist
        // unter der kanonischen Semantik korrekt (Fees nicht doppelt, R-02).
        cashChange = -(amountCHF + fees);
        break;
      case 'sell':
        // Cash increases (we receive money from selling shares)
        cashChange = amountCHF - fees;
        break;
      case 'dividend':
        // Cash increases (dividend received)
        cashChange = amountCHF;
        break;
    }

    txDates.set(date, (txDates.get(date) || 0) + cashChange);
  }

  // Fill the timeline
  const cashBalances = new Map<string, number>();
  let runningCash = 0;

  for (const date of dates) {
    const change = txDates.get(date);
    if (change !== undefined) {
      runningCash += change;
    }
    // Don't allow negative cash (rounding errors)
    cashBalances.set(date, Math.max(0, runningCash));
  }

  return cashBalances;
}

/**
 * Return empty result for edge cases
 */
function emptyResult(startDate: string, endDate: string): PortfolioPerformanceResult {
  return {
    ttwror: {
      totalReturn: 0,
      annualizedReturn: 0,
      periodDays: 0,
      dailySeries: [],
    },
    irr: {
      annualizedIRR: 0,
      periodicIRR: 0,
      converged: true,
      iterations: 0,
    },
    startDate,
    endDate,
    currentValueCHF: 0,
    totalInvestedCHF: 0,
    absoluteGainCHF: 0,
    dailySeries: [],
    dailyValuations: [],
  };
}
