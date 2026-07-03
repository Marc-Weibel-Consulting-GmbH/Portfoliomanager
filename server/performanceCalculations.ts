/**
 * Portfolio Performance Calculations Module — LEGACY (R-04/D-01)
 *
 * DEPRECATED as a history/return engine: `buildValuePoints` values PAST dates
 * with CURRENT prices, so every TWR/MWR/value-history number derived from it
 * is meaningless once prices have moved. The user-facing consumers
 * (routers/portfolioPerformanceRouter.ts) have been rewired onto the
 * historically-correct pipeline (lib/performanceService.ts +
 * lib/performanceEngine.ts). Do NOT wire new consumers onto
 * `buildValuePoints`, `calculatePerformanceMetrics`,
 * `calculateTimeWeightedReturn` or `calculateMoneyWeightedReturn`.
 *
 * Still legitimately in use (point-in-time, no history involved):
 * - `calculateHoldingsPerformance` (cost basis / current value per holding)
 * - `calculatePortfolioValueAtDate` (takes historical prices as input)
 *
 * The module is kept (not deleted) because CT-1/CT-6
 * (server/__characterization__/) pin its behavior including the known bugs.
 */

import { PortfolioTransaction } from "../drizzle/schema";
import { getGrossAmountCHF, getFeesCHF, getSignedFlowCHF } from "./lib/transactionSemantics";

export interface PortfolioValuePoint {
  date: string; // YYYY-MM-DD
  value: number; // Portfolio value in CHF
  cashFlows: number; // Net cash flows on this date (deposits - withdrawals)
}

export interface PerformanceMetrics {
  totalReturn: number; // Absolute return in CHF
  totalReturnPercent: number; // Total return as percentage
  timeWeightedReturn: number; // TWR as percentage (annualized if > 1 year)
  moneyWeightedReturn: number; // IRR/MWR as percentage (annualized)
  unrealizedGains: number; // Current unrealized gains in CHF
  unrealizedGainsPercent: number; // Unrealized gains as percentage
  realizedGains: number; // Total realized gains in CHF
  totalInvested: number; // Total amount invested (deposits - withdrawals)
  currentValue: number; // Current portfolio value in CHF
  dividendsReceived: number; // Total dividends received
  feesPaid: number; // Total fees paid
}

export interface HoldingPerformance {
  ticker: string;
  shares: number;
  avgCostBasis: number; // Average purchase price per share in CHF
  currentPrice: number; // Current price per share in CHF
  currentValue: number; // Current value in CHF
  unrealizedGain: number; // Unrealized gain/loss in CHF
  unrealizedGainPercent: number; // Unrealized gain/loss as percentage
  totalInvested: number; // Total amount invested in this position
}

/**
 * Calculate Time-Weighted Return (TWR)
 * TWR measures the compound rate of growth in a portfolio, eliminating the effect of cash flows
 * 
 * Formula: TWR = [(1 + R1) × (1 + R2) × ... × (1 + Rn)] - 1
 * where Ri is the return for each sub-period between cash flows
 * 
 * @param valuePoints Array of portfolio values over time with cash flows
 * @returns TWR as a percentage (e.g., 12.5 for 12.5%)
 */
export function calculateTimeWeightedReturn(valuePoints: PortfolioValuePoint[]): number {
  if (valuePoints.length < 2) return 0;

  // Sort by date
  const sorted = [...valuePoints].sort((a, b) => a.date.localeCompare(b.date));
  
  let cumulativeReturn = 1.0;
  
  for (let i = 1; i < sorted.length; i++) {
    const prevValue = sorted[i - 1].value;
    const currentValue = sorted[i].value;
    const cashFlow = sorted[i].cashFlows;
    
    // Adjust for cash flows: remove cash flows from current value to get pure investment return
    const adjustedValue = currentValue - cashFlow;
    
    if (prevValue > 0) {
      const periodReturn = (adjustedValue - prevValue) / prevValue;
      cumulativeReturn *= (1 + periodReturn);
    }
  }
  
  const totalReturn = (cumulativeReturn - 1) * 100;
  
  // Annualize if period is longer than 1 year
  const daysDiff = daysBetween(sorted[0].date, sorted[sorted.length - 1].date);
  if (daysDiff > 365) {
    const years = daysDiff / 365;
    return (Math.pow(1 + totalReturn / 100, 1 / years) - 1) * 100;
  }
  
  return totalReturn;
}

/**
 * Calculate Money-Weighted Return (MWR/IRR) using Newton-Raphson method
 * MWR accounts for the timing and size of cash flows
 * 
 * IRR is the rate r that satisfies: NPV = Σ(CFt / (1 + r)^t) = 0
 * 
 * @param valuePoints Array of portfolio values over time with cash flows
 * @param currentValue Current portfolio value
 * @returns MWR/IRR as a percentage (annualized)
 */
export function calculateMoneyWeightedReturn(
  valuePoints: PortfolioValuePoint[],
  currentValue: number
): number {
  if (valuePoints.length < 1) return 0;

  const sorted = [...valuePoints].sort((a, b) => a.date.localeCompare(b.date));
  const startDate = sorted[0].date;
  const endDate = sorted[sorted.length - 1].date;
  
  // Build cash flow array with dates
  const cashFlows: Array<{ date: string; amount: number }> = [];
  
  // Initial investment (negative cash flow)
  if (sorted[0].cashFlows !== 0) {
    cashFlows.push({ date: sorted[0].date, amount: -sorted[0].cashFlows });
  }
  
  // Intermediate cash flows
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].cashFlows !== 0) {
      cashFlows.push({ date: sorted[i].date, amount: -sorted[i].cashFlows });
    }
  }
  
  // Final value (positive cash flow)
  cashFlows.push({ date: endDate, amount: currentValue });
  
  if (cashFlows.length < 2) return 0;
  
  // Calculate IRR using Newton-Raphson method
  const irr = calculateIRR(cashFlows, startDate);
  
  // Annualize the IRR
  const daysDiff = daysBetween(startDate, endDate);
  if (daysDiff === 0) return 0;
  
  const years = daysDiff / 365;
  return (Math.pow(1 + irr, 1 / years) - 1) * 100;
}

/**
 * Calculate IRR using Newton-Raphson method
 * @param cashFlows Array of cash flows with dates
 * @param startDate Start date for calculating time periods
 * @returns IRR as a decimal (e.g., 0.125 for 12.5%)
 */
function calculateIRR(
  cashFlows: Array<{ date: string; amount: number }>,
  startDate: string
): number {
  // Initial guess
  let rate = 0.1;
  const maxIterations = 100;
  const tolerance = 0.0001;
  
  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let dnpv = 0;
    
    for (const cf of cashFlows) {
      const years = daysBetween(startDate, cf.date) / 365;
      const discountFactor = Math.pow(1 + rate, years);
      
      npv += cf.amount / discountFactor;
      dnpv -= (cf.amount * years) / (discountFactor * (1 + rate));
    }
    
    if (Math.abs(npv) < tolerance) {
      return rate;
    }
    
    // Newton-Raphson update
    rate = rate - npv / dnpv;
    
    // Prevent negative or extreme rates
    if (rate < -0.99) rate = -0.99;
    if (rate > 10) rate = 10;
  }
  
  return rate;
}

/**
 * Calculate current holdings and their performance
 * @param transactions All transactions for the portfolio
 * @param currentPrices Map of ticker to current price
 * @returns Array of holding performance data
 */
export function calculateHoldingsPerformance(
  transactions: PortfolioTransaction[],
  currentPrices: Map<string, number>
): HoldingPerformance[] {
  // Group transactions by ticker
  const holdingsMap = new Map<string, {
    shares: number;
    totalCost: number; // Total amount invested (in CHF)
    ticker: string;
  }>();
  
  for (const tx of transactions) {
    if (!tx.ticker) continue;
    
    const ticker = tx.ticker;
    const holding = holdingsMap.get(ticker) || { shares: 0, totalCost: 0, ticker };
    
    const shares = parseFloat(tx.shares || "0");
    // Kanonische Semantik (R-02): totalAmountCHF = Brutto EXKL. Fees,
    // Kostenbasis = Brutto + Fees (siehe lib/transactionSemantics.ts).
    const totalAmountCHF = getGrossAmountCHF(tx);
    const fees = getFeesCHF(tx);

    if (tx.transactionType === "buy") {
      holding.shares += shares;
      holding.totalCost += totalAmountCHF + fees;
    } else if (tx.transactionType === "sell") {
      // For sells, reduce shares and proportionally reduce cost basis
      if (holding.shares > 0) {
        const sellRatio = shares / holding.shares;
        holding.totalCost -= holding.totalCost * sellRatio;
        holding.shares -= shares;
      }
    }
    
    holdingsMap.set(ticker, holding);
  }
  
  // Calculate performance for each holding
  const holdings: HoldingPerformance[] = [];
  
  for (const [ticker, holding] of Array.from(holdingsMap.entries())) {
    if (holding.shares <= 0) continue; // Skip closed positions
    
    const currentPrice = currentPrices.get(ticker) || 0;
    const currentValue = holding.shares * currentPrice;
    const avgCostBasis = holding.shares > 0 ? holding.totalCost / holding.shares : 0;
    const unrealizedGain = currentValue - holding.totalCost;
    const unrealizedGainPercent = holding.totalCost > 0 
      ? (unrealizedGain / holding.totalCost) * 100 
      : 0;
    
    holdings.push({
      ticker,
      shares: holding.shares,
      avgCostBasis,
      currentPrice,
      currentValue,
      unrealizedGain,
      unrealizedGainPercent,
      totalInvested: holding.totalCost,
    });
  }
  
  return holdings;
}

/**
 * Calculate comprehensive performance metrics for a portfolio
 *
 * @deprecated R-04/D-01 — the TWR/MWR fields are derived from
 * `buildValuePoints`, which values past dates with CURRENT prices. Use
 * lib/performanceService.calculatePortfolioPerformance instead. Kept only for
 * the CT-1 characterization pins; no user-facing consumer remains.
 *
 * @param transactions All transactions for the portfolio
 * @param currentPrices Map of ticker to current price
 * @param realizedGainsTotal Total realized gains from closed positions
 * @param portfolioCreationDate Optional: Date when portfolio was created (for initial investment handling)
 * @returns Complete performance metrics
 */
export function calculatePerformanceMetrics(
  transactions: PortfolioTransaction[],
  currentPrices: Map<string, number>,
  realizedGainsTotal: number = 0,
  portfolioCreationDate?: Date
): PerformanceMetrics {
  // Calculate holdings performance
  const holdings = calculateHoldingsPerformance(transactions, currentPrices);
  
  // Sum up metrics
  const currentValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const unrealizedGains = holdings.reduce((sum, h) => sum + h.unrealizedGain, 0);
  const totalInvestedInHoldings = holdings.reduce((sum, h) => sum + h.totalInvested, 0);
  
  // Calculate deposits, withdrawals, dividends, fees
  let totalDeposits = 0;
  let totalWithdrawals = 0;
  let dividendsReceived = 0;
  let feesPaid = 0;
  
  for (const tx of transactions) {
    if (tx.transactionType === "deposit") {
      totalDeposits += getSignedFlowCHF(tx); // immer positiv
    } else if (tx.transactionType === "withdrawal") {
      // R-01: getSignedFlowCHF normalisiert beide Speicher-Konventionen
      // (negativ wie TransactionModal oder positiv) auf einen negativen Flow;
      // totalWithdrawals ist damit immer der positive Entnahmebetrag.
      totalWithdrawals += -getSignedFlowCHF(tx);
    } else if (tx.transactionType === "dividend") {
      dividendsReceived += getGrossAmountCHF(tx);
    }

    feesPaid += getFeesCHF(tx);
  }
  
  const totalInvested = totalDeposits - totalWithdrawals;
  
  // Total return = current value + realized gains + dividends - total invested - fees
  const totalReturn = currentValue + realizedGainsTotal + dividendsReceived - totalInvested - feesPaid;
  const totalReturnPercent = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;
  
  const unrealizedGainsPercent = totalInvestedInHoldings > 0 
    ? (unrealizedGains / totalInvestedInHoldings) * 100 
    : 0;
  
  // Build value points for TWR and MWR calculations
  const valuePoints = buildValuePoints(transactions, currentPrices, portfolioCreationDate);
  
  const timeWeightedReturn = calculateTimeWeightedReturn(valuePoints);
  const moneyWeightedReturn = calculateMoneyWeightedReturn(valuePoints, currentValue);
  
  return {
    totalReturn,
    totalReturnPercent,
    timeWeightedReturn,
    moneyWeightedReturn,
    unrealizedGains,
    unrealizedGainsPercent,
    realizedGains: realizedGainsTotal,
    totalInvested,
    currentValue,
    dividendsReceived,
    feesPaid,
  };
}

/**
 * Build portfolio value points from transactions
 * This creates a timeline of portfolio values and cash flows
 *
 * @deprecated R-04/D-01 — values every PAST date with CURRENT prices
 * (`currentPrices.get(ticker)`), producing a flat series that is wrong as soon
 * as prices move. Use lib/performanceService (historical prices) instead.
 * Kept only for the CT-1 characterization pins; no user-facing consumer
 * remains.
 *
 * IMPORTANT: Initial investments (first buy transactions on portfolio creation date)
 * are treated as performance-neutral (cashFlow = 0) to establish the baseline.
 * Only subsequent cash flows affect TWR calculation.
 *
 * @param transactions All transactions for the portfolio
 * @param currentPrices Map of ticker to current price
 * @param portfolioCreationDate Optional: Date when portfolio was created (for initial investment handling)
 * @returns Array of value points sorted by date
 */
export function buildValuePoints(
  transactions: PortfolioTransaction[],
  currentPrices: Map<string, number>,
  portfolioCreationDate?: Date
): PortfolioValuePoint[] {
  if (transactions.length === 0) return [];
  
  // Sort transactions by date
  const sorted = [...transactions].sort((a, b) => 
    a.transactionDate.toISOString().localeCompare(b.transactionDate.toISOString())
  );
  
  // Determine creation date: use provided date or first transaction date
  const creationDateStr = portfolioCreationDate 
    ? portfolioCreationDate.toISOString().split('T')[0]
    : sorted[0].transactionDate.toISOString().split('T')[0];
  
  // Group transactions by date
  const dateGroups = new Map<string, PortfolioTransaction[]>();
  for (const tx of sorted) {
    const dateStr = tx.transactionDate.toISOString().split('T')[0];
    const group = dateGroups.get(dateStr) || [];
    group.push(tx);
    dateGroups.set(dateStr, group);
  }
  
  // Calculate portfolio value at each date
  const valuePoints: PortfolioValuePoint[] = [];
  const holdings = new Map<string, { shares: number; totalCost: number }>();
  
  // Track if this is the initial investment (first date = creation date)
  const isInitialInvestment = (date: string) => date === creationDateStr;
  
  for (const [date, txs] of Array.from(dateGroups.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    let cashFlows = 0;
    const isInitial = isInitialInvestment(date);
    
    for (const tx of txs) {
      const amount = getGrossAmountCHF(tx);
      const shares = parseFloat(tx.shares || "0");
      const fees = getFeesCHF(tx);

      if (tx.transactionType === "deposit") {
        // Initial deposit is performance-neutral
        if (!isInitial) {
          cashFlows += getSignedFlowCHF(tx);
        }
      } else if (tx.transactionType === "withdrawal") {
        // R-01: Entnahme ist IMMER ein negativer externer Flow — unabhängig
        // davon, ob die Zeile den Betrag negativ oder positiv gespeichert hat.
        cashFlows += getSignedFlowCHF(tx);
      // R-05: Dividenden sind interner Ertrag des Portfolios und KEIN
      // externer Cashflow mehr (vorher: cashFlows += amount, was die
      // Dividende vom Periodenertrag abzog und MWR verzerrte).
      } else if (tx.transactionType === "buy" && tx.ticker) {
        const holding = holdings.get(tx.ticker) || { shares: 0, totalCost: 0 };
        holding.shares += shares;
        holding.totalCost += amount + fees;
        holdings.set(tx.ticker, holding);
        // Initial buys are performance-neutral (establish baseline)
        if (!isInitial) {
          cashFlows += amount + fees; // Buying is a cash outflow
        }
      } else if (tx.transactionType === "sell" && tx.ticker) {
        const holding = holdings.get(tx.ticker);
        if (holding && holding.shares > 0) {
          const sellRatio = shares / holding.shares;
          holding.totalCost -= holding.totalCost * sellRatio;
          holding.shares -= shares;
          holdings.set(tx.ticker, holding);
        }
        cashFlows -= amount - fees; // Selling is a cash inflow (minus fees)
      }
    }
    
    // Calculate portfolio value at this date
    let portfolioValue = 0;
    for (const [ticker, holding] of Array.from(holdings.entries())) {
      const price = currentPrices.get(ticker) || 0;
      portfolioValue += holding.shares * price;
    }
    
    valuePoints.push({
      date,
      value: portfolioValue,
      cashFlows,
    });
  }
  
  // Add current date if not already present
  const today = new Date().toISOString().split('T')[0];
  if (valuePoints.length === 0 || valuePoints[valuePoints.length - 1].date !== today) {
    let portfolioValue = 0;
    for (const [ticker, holding] of Array.from(holdings.entries())) {
      const price = currentPrices.get(ticker) || 0;
      portfolioValue += holding.shares * price;
    }
    
    valuePoints.push({
      date: today,
      value: portfolioValue,
      cashFlows: 0,
    });
  }
  
  return valuePoints;
}

/**
 * Calculate number of days between two dates
 * @param date1 First date (YYYY-MM-DD)
 * @param date2 Second date (YYYY-MM-DD)
 * @returns Number of days between the dates
 */
function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate portfolio value at a specific date
 * @param transactions All transactions up to the date
 * @param date Target date
 * @param historicalPrices Map of ticker to historical prices
 * @returns Portfolio value at the date
 */
export function calculatePortfolioValueAtDate(
  transactions: PortfolioTransaction[],
  date: Date,
  historicalPrices: Map<string, Map<string, number>> // ticker -> date -> price
): number {
  // Filter transactions up to the date
  const relevantTxs = transactions.filter(tx => tx.transactionDate <= date);
  
  // Calculate holdings at this date
  const holdings = new Map<string, number>(); // ticker -> shares
  
  for (const tx of relevantTxs) {
    if (!tx.ticker) continue;
    
    const shares = parseFloat(tx.shares || "0");
    const currentShares = holdings.get(tx.ticker) || 0;
    
    if (tx.transactionType === "buy") {
      holdings.set(tx.ticker, currentShares + shares);
    } else if (tx.transactionType === "sell") {
      holdings.set(tx.ticker, currentShares - shares);
    }
  }
  
  // Calculate value
  const dateStr = date.toISOString().split('T')[0];
  let totalValue = 0;
  
  for (const [ticker, shares] of Array.from(holdings.entries())) {
    const priceMap = historicalPrices.get(ticker);
    const price = priceMap?.get(dateStr) || 0;
    totalValue += shares * price;
  }
  
  return totalValue;
}
