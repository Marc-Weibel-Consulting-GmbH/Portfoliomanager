/**
 * Performance Engine - TTWROR & IRR Calculation
 * 
 * Clean-room implementation based on Portfolio Performance's documented algorithms.
 * 
 * TTWROR (True Time-Weighted Rate of Return):
 *   - Measures pure investment performance, independent of cash flow timing/size
 *   - Daily sub-periods with geometric compounding
 *   - Formula: (1+r) = (MVE + CFout) / (MVB + CFin) per day
 *   - Total: TTWROR = [(1+r1) × (1+r2) × ... × (1+rn)] - 1
 * 
 * IRR (Internal Rate of Return / Money-Weighted Return):
 *   - Measures investor's actual experience including timing of cash flows
 *   - Formula: MVB × (1+IRR)^(RD/365) + Σ CFt × (1+IRR)^(RDt/365) = MVE
 *   - Solved iteratively via Newton-Raphson method
 * 
 * References:
 *   - Portfolio Performance Manual: https://help.portfolio-performance.info/en/concepts/performance/
 *   - CFA Institute GIPS Standards
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types & Interfaces
// ─────────────────────────────────────────────────────────────────────────────

/** A single cash flow event (deposit, withdrawal, buy, sell, dividend) */
export interface CashFlow {
  /** Date of the cash flow (YYYY-MM-DD) */
  date: string;
  /** Amount in portfolio currency (positive = inflow, negative = outflow) */
  amount: number;
  /** Type of cash flow for classification */
  type: 'deposit' | 'withdrawal' | 'buy' | 'sell' | 'dividend' | 'fee' | 'entry';
}

/** Daily portfolio valuation */
export interface DailyValuation {
  /** Date (YYYY-MM-DD) */
  date: string;
  /** Market value of portfolio at end of day (in portfolio currency) */
  marketValue: number;
}

/** Result of TTWROR calculation */
export interface TTWRORResult {
  /** Cumulative TTWROR for the entire period (as decimal, e.g., 0.15 = 15%) */
  totalReturn: number;
  /** Annualized TTWROR (as decimal) */
  annualizedReturn: number;
  /** Number of days in the period */
  periodDays: number;
  /** Daily cumulative performance series for charting */
  dailySeries: Array<{ date: string; cumulativeReturn: number }>;
}

/** Result of IRR calculation */
export interface IRRResult {
  /** Annualized IRR (as decimal, e.g., 0.12 = 12%) */
  annualizedIRR: number;
  /** Periodic IRR for the measurement period (as decimal) */
  periodicIRR: number;
  /** Whether the calculation converged */
  converged: boolean;
  /** Number of iterations needed */
  iterations: number;
}

/** Combined performance metrics */
export interface PerformanceMetrics {
  /** TTWROR result */
  ttwror: TTWRORResult;
  /** IRR result */
  irr: IRRResult;
  /** Start date of measurement period */
  startDate: string;
  /** End date of measurement period */
  endDate: string;
  /** Total invested (sum of all inflows) */
  totalInvested: number;
  /** Current market value */
  currentValue: number;
  /** Absolute gain/loss in currency */
  absoluteGain: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// TTWROR Calculation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate True Time-Weighted Rate of Return (TTWROR)
 * 
 * Algorithm (from Portfolio Performance):
 * 1. For each day, calculate the daily return using:
 *    (1 + r) = (MVE + CFout) / (MVB + CFin)
 *    where CFin = deposits/buys at start of day, CFout = withdrawals/sells at end of day
 * 2. Compound all daily returns: TTWROR = Π(1 + ri) - 1
 * 
 * At PORTFOLIO level:
 *   - Cash flows = Deposit, Withdrawal (money entering/leaving the portfolio)
 *   - Buy/Sell/Dividend are internal movements, NOT cash flows
 * 
 * @param valuations - Daily portfolio market values (must be sorted by date)
 * @param cashFlows - External cash flows (deposits/withdrawals only for portfolio level)
 * @returns TTWROR result with daily series
 */
export function calculateTTWROR(
  valuations: DailyValuation[],
  cashFlows: CashFlow[]
): TTWRORResult {
  if (valuations.length < 2) {
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      periodDays: 0,
      dailySeries: valuations.map(v => ({ date: v.date, cumulativeReturn: 0 })),
    };
  }

  // Sort valuations by date
  const sorted = [...valuations].sort((a, b) => a.date.localeCompare(b.date));

  // Build cash flow lookup: date -> { inflows, outflows }
  const cfByDate = new Map<string, { inflows: number; outflows: number }>();
  for (const cf of cashFlows) {
    if (!cfByDate.has(cf.date)) {
      cfByDate.set(cf.date, { inflows: 0, outflows: 0 });
    }
    const entry = cfByDate.get(cf.date)!;
    if (cf.amount > 0) {
      // Positive = money flowing IN (deposit, delivery-in)
      entry.inflows += cf.amount;
    } else {
      // Negative = money flowing OUT (withdrawal, delivery-out)
      entry.outflows += Math.abs(cf.amount);
    }
  }

  // Calculate daily returns and compound them
  let cumulativeProduct = 1.0;
  const dailySeries: Array<{ date: string; cumulativeReturn: number }> = [];

  // First day: no return yet, just record baseline
  dailySeries.push({ date: sorted[0].date, cumulativeReturn: 0 });

  for (let i = 1; i < sorted.length; i++) {
    const mvb = sorted[i - 1].marketValue; // Market Value at Beginning (= MVE of previous day)
    const mve = sorted[i].marketValue;       // Market Value at End
    const date = sorted[i].date;

    // Get cash flows for this day
    const cf = cfByDate.get(date) || { inflows: 0, outflows: 0 };

    // Portfolio Performance formula (Eq 3):
    // (1 + r) = (MVE + CFout) / (MVB + CFin)
    // CFin added to denominator (money available at start of day)
    // CFout added to numerator (money left at end of day, neutralizing the outflow effect)
    const denominator = mvb + cf.inflows;
    const numerator = mve + cf.outflows;

    if (denominator <= 0) {
      // Edge case: portfolio was empty and received new money
      // The return for this day is 0 (no prior capital to measure against)
      dailySeries.push({ date, cumulativeReturn: (cumulativeProduct - 1) });
      continue;
    }

    const dailyReturn = (numerator / denominator) - 1;

    // Sanity check: cap extreme daily returns (data errors)
    const cappedReturn = Math.max(-0.5, Math.min(0.5, dailyReturn));

    cumulativeProduct *= (1 + cappedReturn);
    dailySeries.push({ date, cumulativeReturn: cumulativeProduct - 1 });
  }

  const totalReturn = cumulativeProduct - 1;

  // Calculate annualized return
  const startDate = new Date(sorted[0].date);
  const endDate = new Date(sorted[sorted.length - 1].date);
  const periodDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

  let annualizedReturn = 0;
  if (periodDays >= 365) {
    // Standard annualization: (1 + total)^(365/days) - 1
    annualizedReturn = Math.pow(1 + totalReturn, 365 / periodDays) - 1;
  } else {
    // For periods less than a year, just report the periodic return
    // (annualizing short periods can be misleading)
    annualizedReturn = totalReturn;
  }

  return {
    totalReturn,
    annualizedReturn,
    periodDays,
    dailySeries,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// IRR Calculation (Newton-Raphson)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate Internal Rate of Return (IRR) / Money-Weighted Return
 * 
 * Formula: MVB × (1+IRR)^(RD/365) + Σ CFt × (1+IRR)^(RDt/365) = MVE
 * 
 * Where:
 *   - MVB = Market Value at Beginning of period
 *   - MVE = Market Value at End of period
 *   - CFt = Cash flow at time t (positive = inflow)
 *   - RDt = Remaining days from CFt to end of period
 *   - RD = Total days in period
 * 
 * Solved using Newton-Raphson iteration.
 * 
 * @param mvb - Market value at beginning of period
 * @param mve - Market value at end of period
 * @param cashFlows - Cash flows during the period (positive = inflow, negative = outflow)
 * @param startDate - Start date of period (YYYY-MM-DD)
 * @param endDate - End date of period (YYYY-MM-DD)
 * @returns IRR result
 */
export function calculateIRR(
  mvb: number,
  mve: number,
  cashFlows: CashFlow[],
  startDate: string,
  endDate: string
): IRRResult {
  const totalDays = daysBetween(startDate, endDate);

  if (totalDays <= 0) {
    return { annualizedIRR: 0, periodicIRR: 0, converged: false, iterations: 0 };
  }

  // If no cash flows and MVB > 0, simple return
  if (cashFlows.length === 0 && mvb > 0) {
    const simpleReturn = (mve / mvb) - 1;
    const annualized = totalDays >= 365
      ? Math.pow(1 + simpleReturn, 365 / totalDays) - 1
      : simpleReturn;
    return { annualizedIRR: annualized, periodicIRR: simpleReturn, converged: true, iterations: 0 };
  }

  // If MVB = 0 and no cash flows, return 0
  if (mvb === 0 && cashFlows.length === 0) {
    return { annualizedIRR: 0, periodicIRR: 0, converged: true, iterations: 0 };
  }

  // Newton-Raphson iteration to find IRR
  // f(r) = MVB × (1+r)^(RD/365) + Σ CFt × (1+r)^(RDt/365) - MVE = 0
  // f'(r) = MVB × (RD/365) × (1+r)^(RD/365 - 1) + Σ CFt × (RDt/365) × (1+r)^(RDt/365 - 1)

  const MAX_ITERATIONS = 100;
  const TOLERANCE = 1e-10;
  let irr = 0.1; // Initial guess: 10%
  let converged = false;
  let iterations = 0;

  // Pre-calculate remaining days for each cash flow
  const cfWithDays = cashFlows.map(cf => ({
    amount: cf.amount,
    remainingDays: daysBetween(cf.date, endDate),
  }));

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    iterations = i + 1;
    const r = irr;

    // Avoid (1+r) going negative
    if (r <= -1) {
      irr = -0.99;
      continue;
    }

    const base = 1 + r;

    // Calculate f(r) and f'(r)
    let fValue = -mve;
    let fDerivative = 0;

    // MVB contribution
    if (mvb > 0) {
      const exp = totalDays / 365;
      fValue += mvb * Math.pow(base, exp);
      fDerivative += mvb * exp * Math.pow(base, exp - 1);
    }

    // Cash flow contributions
    for (const cf of cfWithDays) {
      if (cf.remainingDays <= 0) continue;
      const exp = cf.remainingDays / 365;
      fValue += cf.amount * Math.pow(base, exp);
      fDerivative += cf.amount * exp * Math.pow(base, exp - 1);
    }

    // Check convergence
    if (Math.abs(fValue) < TOLERANCE) {
      converged = true;
      break;
    }

    // Newton-Raphson step
    if (Math.abs(fDerivative) < 1e-15) {
      // Derivative too small, try bisection step
      irr = irr + (fValue > 0 ? -0.01 : 0.01);
      continue;
    }

    const step = fValue / fDerivative;

    // Dampen large steps to prevent divergence
    const dampedStep = Math.max(-0.5, Math.min(0.5, step));
    irr = irr - dampedStep;

    // Clamp IRR to reasonable range [-0.99, 10.0] (i.e., -99% to +1000%)
    irr = Math.max(-0.99, Math.min(10.0, irr));
  }

  // If Newton-Raphson didn't converge, try bisection as fallback
  if (!converged) {
    const bisectionResult = bisectionIRR(mvb, mve, cfWithDays, totalDays);
    if (bisectionResult !== null) {
      irr = bisectionResult;
      converged = true;
      iterations = MAX_ITERATIONS;
    }
  }

  // Calculate periodic return from annualized IRR
  const periodicIRR = Math.pow(1 + irr, totalDays / 365) - 1;

  return {
    annualizedIRR: irr,
    periodicIRR,
    converged,
    iterations,
  };
}

/**
 * Bisection method as fallback for IRR when Newton-Raphson fails
 */
function bisectionIRR(
  mvb: number,
  mve: number,
  cfWithDays: Array<{ amount: number; remainingDays: number }>,
  totalDays: number
): number | null {
  let lo = -0.99;
  let hi = 5.0;
  const MAX_ITER = 200;
  const TOLERANCE = 1e-8;

  const evaluate = (r: number): number => {
    const base = 1 + r;
    let value = -mve;
    if (mvb > 0) value += mvb * Math.pow(base, totalDays / 365);
    for (const cf of cfWithDays) {
      if (cf.remainingDays <= 0) continue;
      value += cf.amount * Math.pow(base, cf.remainingDays / 365);
    }
    return value;
  };

  let fLo = evaluate(lo);
  let fHi = evaluate(hi);

  // If same sign, expand range
  if (fLo * fHi > 0) {
    // Try wider range
    lo = -0.999;
    hi = 10.0;
    fLo = evaluate(lo);
    fHi = evaluate(hi);
    if (fLo * fHi > 0) return null; // Cannot bracket root
  }

  for (let i = 0; i < MAX_ITER; i++) {
    const mid = (lo + hi) / 2;
    const fMid = evaluate(mid);

    if (Math.abs(fMid) < TOLERANCE || (hi - lo) / 2 < TOLERANCE) {
      return mid;
    }

    if (fMid * fLo < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }

  return (lo + hi) / 2; // Best estimate
}

// ─────────────────────────────────────────────────────────────────────────────
// Combined Performance Calculation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate both TTWROR and IRR for a portfolio
 * 
 * @param valuations - Daily portfolio market values
 * @param cashFlows - All cash flows (deposits/withdrawals for portfolio level)
 * @param startDate - Start of measurement period
 * @param endDate - End of measurement period
 * @returns Combined performance metrics
 */
export function calculatePerformance(
  valuations: DailyValuation[],
  cashFlows: CashFlow[],
  startDate: string,
  endDate: string
): PerformanceMetrics {
  // Filter valuations and cash flows to the measurement period
  const periodValuations = valuations.filter(v => v.date >= startDate && v.date <= endDate);
  const periodCashFlows = cashFlows.filter(cf => cf.date >= startDate && cf.date <= endDate);

  // TTWROR: only external cash flows (deposits/withdrawals) affect portfolio-level TTWROR
  const externalCashFlows = periodCashFlows.filter(cf =>
    cf.type === 'deposit' || cf.type === 'withdrawal' || cf.type === 'entry'
  );
  const ttwror = calculateTTWROR(periodValuations, externalCashFlows);

  // IRR: uses all external cash flows
  const mvb = periodValuations.length > 0 ? periodValuations[0].marketValue : 0;
  const mve = periodValuations.length > 0 ? periodValuations[periodValuations.length - 1].marketValue : 0;

  // For IRR, cash flows are positive for inflows and negative for outflows
  const irrCashFlows = externalCashFlows.map(cf => ({
    ...cf,
    amount: cf.type === 'withdrawal' ? -Math.abs(cf.amount) : Math.abs(cf.amount),
  }));

  const irr = calculateIRR(mvb, mve, irrCashFlows, startDate, endDate);

  // Calculate total invested
  const totalInvested = mvb + periodCashFlows
    .filter(cf => cf.amount > 0)
    .reduce((sum, cf) => sum + cf.amount, 0);

  const currentValue = mve;
  const totalWithdrawn = periodCashFlows
    .filter(cf => cf.amount < 0)
    .reduce((sum, cf) => sum + Math.abs(cf.amount), 0);

  const absoluteGain = currentValue + totalWithdrawn - totalInvested;

  return {
    ttwror,
    irr,
    startDate,
    endDate,
    totalInvested,
    currentValue,
    absoluteGain,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

/** Calculate days between two dates (YYYY-MM-DD strings) */
function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Build daily portfolio valuations from holdings + historical prices
 * This is the bridge between raw data and the performance engine.
 * 
 * @param holdings - Map of ticker -> shares held on each date
 * @param prices - Map of ticker -> Map of date -> price in CHF
 * @param cashBalances - Map of date -> cash balance in CHF
 * @param dates - Sorted array of dates to calculate for
 * @returns Array of daily valuations
 */
export function buildDailyValuations(
  holdingsOverTime: Map<string, Map<string, number>>, // ticker -> date -> shares
  pricesCHF: Map<string, Map<string, number>>,         // ticker -> date -> price in CHF
  cashBalances: Map<string, number>,                   // date -> cash balance
  dates: string[]
): DailyValuation[] {
  const valuations: DailyValuation[] = [];

  for (const date of dates) {
    let marketValue = 0;

    // Sum up all positions
    for (const [ticker, dateShares] of holdingsOverTime.entries()) {
      const shares = dateShares.get(date) || 0;
      if (shares <= 0) continue;

      const tickerPrices = pricesCHF.get(ticker);
      if (!tickerPrices) continue;

      // Get price for this date (or nearest previous)
      let price = tickerPrices.get(date);
      if (price === undefined) {
        // Look back up to 5 days for nearest price
        const d = new Date(date);
        for (let i = 1; i <= 5; i++) {
          d.setDate(d.getDate() - 1);
          const key = d.toISOString().split('T')[0];
          price = tickerPrices.get(key);
          if (price !== undefined) break;
        }
      }

      if (price !== undefined && price > 0) {
        marketValue += shares * price;
      }
    }

    // Add cash balance
    const cash = cashBalances.get(date) || 0;
    marketValue += cash;

    valuations.push({ date, marketValue });
  }

  return valuations;
}

/**
 * Extract external cash flows from portfolio transactions
 * At portfolio level, only deposits and withdrawals are external cash flows.
 * Buy/Sell/Dividend are internal movements.
 * 
 * @param transactions - Raw portfolio transactions
 * @returns Array of cash flows for performance calculation
 */
export function extractPortfolioCashFlows(
  transactions: Array<{
    transactionType: string;
    transactionDate: Date | string;
    totalAmountCHF?: string | null;
    totalAmount?: string | null;
    ticker?: string | null;
  }>
): CashFlow[] {
  const cashFlows: CashFlow[] = [];

  for (const tx of transactions) {
    const date = typeof tx.transactionDate === 'string'
      ? tx.transactionDate.split('T')[0]
      : tx.transactionDate.toISOString().split('T')[0];

    const amountCHF = parseFloat(tx.totalAmountCHF || tx.totalAmount || '0');

    switch (tx.transactionType) {
      case 'deposit':
      case 'entry':
        // Money entering the portfolio from outside
        cashFlows.push({ date, amount: amountCHF, type: tx.transactionType as any });
        break;
      case 'withdrawal':
        // Money leaving the portfolio
        cashFlows.push({ date, amount: -amountCHF, type: 'withdrawal' });
        break;
      // buy, sell, dividend are INTERNAL movements - not portfolio-level cash flows
      // They don't affect TTWROR at portfolio level
    }
  }

  return cashFlows;
}

/**
 * Build holdings timeline from transactions
 * Returns a map of ticker -> date -> cumulative shares held
 * 
 * @param transactions - Portfolio transactions sorted by date
 * @param dates - All dates to fill (sorted)
 * @returns Holdings over time
 */
export function buildHoldingsTimeline(
  transactions: Array<{
    transactionType: string;
    transactionDate: Date | string;
    ticker?: string | null;
    shares?: string | null;
  }>,
  dates: string[]
): Map<string, Map<string, number>> {
  // First, build cumulative holdings at each transaction date
  const holdingsState = new Map<string, number>(); // ticker -> current shares
  const transactionDates = new Map<string, Map<string, number>>(); // date -> ticker -> shares change

  for (const tx of transactions) {
    const date = typeof tx.transactionDate === 'string'
      ? tx.transactionDate.split('T')[0]
      : tx.transactionDate.toISOString().split('T')[0];

    if (!tx.ticker) continue;
    const shares = parseFloat(tx.shares || '0');

    if (!transactionDates.has(date)) transactionDates.set(date, new Map());
    const dayChanges = transactionDates.get(date)!;

    if (tx.transactionType === 'buy' || tx.transactionType === 'entry') {
      dayChanges.set(tx.ticker, (dayChanges.get(tx.ticker) || 0) + shares);
    } else if (tx.transactionType === 'sell') {
      dayChanges.set(tx.ticker, (dayChanges.get(tx.ticker) || 0) - shares);
    }
  }

  // Now fill the timeline for all dates
  const result = new Map<string, Map<string, number>>();

  for (const date of dates) {
    // Apply any transactions on this date
    const dayChanges = transactionDates.get(date);
    if (dayChanges) {
      for (const [ticker, change] of dayChanges.entries()) {
        holdingsState.set(ticker, (holdingsState.get(ticker) || 0) + change);
      }
    }

    // Record current state for all tickers
    for (const [ticker, shares] of holdingsState.entries()) {
      if (!result.has(ticker)) result.set(ticker, new Map());
      result.get(ticker)!.set(date, shares);
    }
  }

  return result;
}
