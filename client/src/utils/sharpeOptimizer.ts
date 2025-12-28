// Sharpe Ratio Optimizer
// Optimizes portfolio weights to maximize risk-adjusted returns

interface Stock {
  ticker: string;
  ytdPerformance: string;
  dividendYield: string;
  currentPrice: string;
  [key: string]: any;
}

interface PortfolioWeights {
  [ticker: string]: number; // Weight as percentage (0-1)
}

interface OptimizationResult {
  weights: PortfolioWeights;
  sharpeRatio: number;
  expectedReturn: number;
  volatility: number;
}

/**
 * Calculate Sharpe Ratio for a portfolio
 * Sharpe Ratio = (Expected Return - Risk Free Rate) / Volatility
 */
export function calculateSharpeRatio(
  stocks: Stock[],
  weights: PortfolioWeights,
  riskFreeRate: number = 0.02 // 2% default risk-free rate
): { sharpeRatio: number; expectedReturn: number; volatility: number } {
  // Calculate expected return (weighted average of YTD performance)
  let expectedReturn = 0;
  for (const stock of stocks) {
    const weight = weights[stock.ticker] || 0;
    const ytdPerf = parseFloat(stock.ytdPerformance || "0") / 100; // Convert % to decimal
    expectedReturn += weight * ytdPerf;
  }

  // Estimate volatility (simplified: use standard deviation of returns)
  // In reality, we'd use historical daily/monthly returns
  // Here we use YTD performance as a proxy
  const returns = stocks.map(s => parseFloat(s.ytdPerformance || "0") / 100);
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance);

  // Sharpe Ratio
  const sharpeRatio = volatility > 0 ? (expectedReturn - riskFreeRate) / volatility : 0;

  return {
    sharpeRatio,
    expectedReturn,
    volatility,
  };
}

/**
 * Generate random portfolio weights that sum to 1
 */
function generateRandomWeights(tickers: string[]): PortfolioWeights {
  const weights: PortfolioWeights = {};
  const random = tickers.map(() => Math.random());
  const sum = random.reduce((a, b) => a + b, 0);
  
  tickers.forEach((ticker, i) => {
    weights[ticker] = random[i] / sum;
  });
  
  return weights;
}

/**
 * Optimize portfolio using Monte Carlo simulation
 * Tests many random weight combinations and finds the one with highest Sharpe Ratio
 */
export function optimizePortfolioSharpe(
  stocks: Stock[],
  numberOfPositions: number,
  iterations: number = 5000
): OptimizationResult {
  if (stocks.length === 0) {
    return {
      weights: {},
      sharpeRatio: 0,
      expectedReturn: 0,
      volatility: 0,
    };
  }

  // Take top N stocks by score (already sorted)
  const selectedStocks = stocks.slice(0, numberOfPositions);
  const tickers = selectedStocks.map(s => s.ticker);

  let bestResult: OptimizationResult = {
    weights: {},
    sharpeRatio: -Infinity,
    expectedReturn: 0,
    volatility: 0,
  };

  // Monte Carlo simulation
  for (let i = 0; i < iterations; i++) {
    const weights = generateRandomWeights(tickers);
    const { sharpeRatio, expectedReturn, volatility } = calculateSharpeRatio(
      selectedStocks,
      weights
    );

    if (sharpeRatio > bestResult.sharpeRatio) {
      bestResult = {
        weights,
        sharpeRatio,
        expectedReturn,
        volatility,
      };
    }
  }

  return bestResult;
}

/**
 * Convert optimized weights to actual position sizes
 */
export function weightsToPositions(
  stocks: Stock[],
  weights: PortfolioWeights,
  investmentAmount: number,
  maxPositionPercent: number = 0.10,
  getFxRate?: (currency: string | undefined) => number
): Array<{
  ticker: string;
  weight: number;
  amount: number;
  shares: number;
}> {
  const positions = [];

  for (const stock of stocks) {
    const weight = weights[stock.ticker] || 0;
    if (weight === 0) continue;

    const currentPrice = parseFloat(stock.currentPrice || "0");
    if (currentPrice === 0) continue;

    // Convert price to CHF if FX rate function provided
    const fxRate = getFxRate ? getFxRate(stock.currency) : 1.0;
    const priceInCHF = currentPrice * fxRate;

    // Apply max position constraint
    const constrainedWeight = Math.min(weight, maxPositionPercent);
    const amount = investmentAmount * constrainedWeight;
    const shares = Math.floor(amount / priceInCHF);
    const actualAmount = shares * priceInCHF;

    positions.push({
      ticker: stock.ticker,
      weight: constrainedWeight,
      amount: actualAmount,
      shares,
    });
  }

  return positions;
}

