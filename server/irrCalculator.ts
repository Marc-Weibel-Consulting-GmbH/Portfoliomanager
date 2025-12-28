/**
 * Calculate Internal Rate of Return (IRR) / Money-Weighted Return (MWR)
 * using Newton-Raphson method
 * 
 * @param cashflows Array of { date: Date, amount: number } where:
 *   - Negative amounts = money invested (deposits, buys)
 *   - Positive amounts = money withdrawn (dividends, sells, withdrawals)
 * @param currentValue Current portfolio value (positive number)
 * @returns IRR as percentage (e.g., 12.5 for 12.5% annual return) or null if calculation fails
 */
export function calculateIRR(
  cashflows: Array<{ date: Date; amount: number }>,
  currentValue: number
): number | null {
  if (cashflows.length === 0) {
    return null;
  }

  // Sort cashflows by date
  const sortedCashflows = [...cashflows].sort((a, b) => a.date.getTime() - b.date.getTime());
  
  // Start date is the first cashflow date
  const startDate = sortedCashflows[0].date;
  const endDate = new Date(); // Today
  
  // Calculate time periods in years from start date
  const periods = sortedCashflows.map(cf => {
    const daysDiff = (cf.date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff / 365.25; // Convert to years
  });
  
  // Add final period for current value
  const finalPeriod = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  
  // Newton-Raphson method to find IRR
  // We're solving: NPV = 0 = Σ(CF_i / (1 + r)^t_i) + CurrentValue / (1 + r)^t_final
  
  let rate = 0.1; // Initial guess: 10%
  const maxIterations = 100;
  const tolerance = 0.0001;
  
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let npv = 0;
    let derivative = 0;
    
    // Calculate NPV and its derivative
    sortedCashflows.forEach((cf, i) => {
      const period = periods[i];
      const discountFactor = Math.pow(1 + rate, period);
      npv += cf.amount / discountFactor;
      derivative -= (period * cf.amount) / Math.pow(1 + rate, period + 1);
    });
    
    // Add current value (final cashflow)
    const finalDiscountFactor = Math.pow(1 + rate, finalPeriod);
    npv += currentValue / finalDiscountFactor;
    derivative -= (finalPeriod * currentValue) / Math.pow(1 + rate, finalPeriod + 1);
    
    // Check convergence
    if (Math.abs(npv) < tolerance) {
      // Convert to percentage
      return rate * 100;
    }
    
    // Newton-Raphson update
    if (Math.abs(derivative) < 1e-10) {
      // Derivative too small, can't continue
      break;
    }
    
    rate = rate - npv / derivative;
    
    // Prevent negative rates below -99% (portfolio can't lose more than 100%)
    if (rate < -0.99) {
      rate = -0.99;
    }
  }
  
  // If we didn't converge, return null
  console.warn("[IRR] Failed to converge after", maxIterations, "iterations");
  return null;
}

/**
 * Calculate simple time-weighted return (TWR) for comparison
 * This is less accurate than IRR but simpler
 */
export function calculateSimpleReturn(
  initialInvestment: number,
  currentValue: number,
  startDate: Date
): number {
  if (initialInvestment <= 0) {
    return 0;
  }
  
  const daysDiff = (new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  const years = daysDiff / 365.25;
  
  if (years <= 0) {
    return 0;
  }
  
  // Simple return: (Current / Initial - 1) * 100
  const totalReturn = ((currentValue / initialInvestment) - 1) * 100;
  
  // Annualize if more than 1 year
  if (years >= 1) {
    return (Math.pow(currentValue / initialInvestment, 1 / years) - 1) * 100;
  }
  
  // For less than 1 year, scale to annual
  return (totalReturn / years);
}

/**
 * Calculate portfolio value from transactions and current stock prices
 */
export async function calculatePortfolioValue(
  portfolioId: number,
  transactions: Array<{
    transactionType: string;
    ticker: string | null;
    shares: string | null;
    pricePerShare: string | null;
    totalAmount: string;
    transactionDate: Date;
  }>
): Promise<{ currentValue: number; holdings: Record<string, number>; cash: number }> {
  // Calculate holdings and cash from transactions
  const holdings: Record<string, number> = {}; // ticker -> shares
  let cash = 0;
  
  transactions.forEach(tx => {
    const amount = parseFloat(tx.totalAmount);
    
    switch (tx.transactionType) {
      case "buy":
        if (tx.ticker && tx.shares) {
          holdings[tx.ticker] = (holdings[tx.ticker] || 0) + parseFloat(tx.shares);
          cash -= amount; // Reduce cash
        }
        break;
      
      case "sell":
        if (tx.ticker && tx.shares) {
          holdings[tx.ticker] = (holdings[tx.ticker] || 0) - parseFloat(tx.shares);
          cash += amount; // Increase cash
        }
        break;
      
      case "dividend":
        cash += amount; // Dividends increase cash
        break;
      
      case "deposit":
        cash += amount; // Deposits increase cash
        break;
      
      case "withdrawal":
        cash += amount; // amount is already negative for withdrawals
        break;
    }
  });
  
  // Fetch current prices for all holdings
  const { getAllStocks } = await import("./db");
  const allStocks = await getAllStocks();
  const stockPrices: Record<string, number> = {};
  
  allStocks.forEach(stock => {
    stockPrices[stock.ticker] = parseFloat(stock.currentPrice || "0");
  });
  
  // Calculate current value
  let holdingsValue = 0;
  Object.entries(holdings).forEach(([ticker, shares]) => {
    const price = stockPrices[ticker] || 0;
    holdingsValue += shares * price;
  });
  
  const currentValue = holdingsValue + cash;
  
  return { currentValue, holdings, cash };
}
