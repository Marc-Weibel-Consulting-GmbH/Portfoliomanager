import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { eq } from "drizzle-orm";
import { savedPortfolios } from "../../drizzle/schema";

type OptimizationCriterion = "sharpe" | "dividend" | "minVolatility" | "maxReturn" | "balanced";

interface OptimizationResult {
  stocks: any[];
  expectedReturn: number;
  risk: number;
  sharpeRatio: number;
  dividendYield: number;
}

/**
 * Optimize portfolio based on selected criterion
 */
function optimizePortfolio(stocks: any[], criterion: OptimizationCriterion, targetReturn?: number, maxRisk?: number): OptimizationResult {
  // Simple optimization logic (in production, use proper portfolio optimization libraries)
  let optimizedStocks = [...stocks];
  
  switch (criterion) {
    case "sharpe":
      // Maximize Sharpe Ratio: favor stocks with high return/risk ratio
      optimizedStocks.sort((a, b) => (b.sharpeRatio || 0) - (a.sharpeRatio || 0));
      break;
      
    case "dividend":
      // Maximize Dividend Yield
      optimizedStocks.sort((a, b) => (b.dividendYield || 0) - (a.dividendYield || 0));
      break;
      
    case "minVolatility":
      // Minimize Volatility: favor stable stocks
      optimizedStocks.sort((a, b) => {
        const volatilityA = Math.abs(a.ytdPerformance || 0);
        const volatilityB = Math.abs(b.ytdPerformance || 0);
        return volatilityA - volatilityB;
      });
      break;
      
    case "maxReturn":
      // Maximize Return: favor high-performing stocks
      optimizedStocks.sort((a, b) => (b.ytdPerformance || 0) - (a.ytdPerformance || 0));
      break;
      
    case "balanced":
    default:
      // Balanced approach: consider multiple factors
      optimizedStocks.sort((a, b) => {
        const scoreA = (a.sharpeRatio || 0) * 0.3 + (a.dividendYield || 0) * 0.3 + (a.ytdPerformance || 0) * 0.01 * 0.4;
        const scoreB = (b.sharpeRatio || 0) * 0.3 + (b.dividendYield || 0) * 0.3 + (b.ytdPerformance || 0) * 0.01 * 0.4;
        return scoreB - scoreA;
      });
      break;
  }

  // Take top 10-15 stocks for diversification
  const topStocks = optimizedStocks.slice(0, 15);
  
  // Redistribute weights based on criterion
  const totalWeight = 100;
  let weights: number[];
  
  if (criterion === "minVolatility") {
    // Equal weighting for minimum volatility
    weights = topStocks.map(() => totalWeight / topStocks.length);
  } else {
    // Weighted by score (exponential decay)
    weights = topStocks.map((_, i) => Math.exp(-i * 0.2));
    const sumWeights = weights.reduce((a, b) => a + b, 0);
    weights = weights.map(w => (w / sumWeights) * totalWeight);
  }

  // Apply weights to stocks
  const optimizedWithWeights = topStocks.map((stock, i) => ({
    ...stock,
    portfolioWeight: weights[i],
    shares: Math.floor((weights[i] / 100) * 10000 / stock.currentPrice) // Assume 10k investment
  }));

  // Calculate portfolio metrics
  const expectedReturn = optimizedWithWeights.reduce((sum, s) => 
    sum + (s.ytdPerformance || 0) * (s.portfolioWeight / 100), 0
  );
  
  const dividendYield = optimizedWithWeights.reduce((sum, s) => 
    sum + (s.dividendYield || 0) * (s.portfolioWeight / 100), 0
  );
  
  const avgSharpe = optimizedWithWeights.reduce((sum, s) => 
    sum + (s.sharpeRatio || 0) * (s.portfolioWeight / 100), 0
  );

  // Estimate risk (volatility) as weighted average of absolute YTD performance
  const risk = optimizedWithWeights.reduce((sum, s) => 
    sum + Math.abs(s.ytdPerformance || 0) * (s.portfolioWeight / 100), 0
  );

  return {
    stocks: optimizedWithWeights,
    expectedReturn,
    risk,
    sharpeRatio: avgSharpe,
    dividendYield
  };
}

export const portfolioOptimizerRouter = router({
  /**
   * Optimize a portfolio based on selected criterion
   */
  optimize: protectedProcedure
    .input(z.object({
      portfolioId: z.number(),
      criterion: z.enum(["sharpe", "dividend", "minVolatility", "maxReturn", "balanced"]),
      targetReturn: z.number().optional(),
      maxRisk: z.number().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Fetch portfolio
      const [portfolio] = await db
        .select()
        .from(savedPortfolios)
        .where(eq(savedPortfolios.id, input.portfolioId))
        .limit(1);

      if (!portfolio) {
        throw new Error("Portfolio not found");
      }

      // Parse portfolio data
      const portfolioData = JSON.parse(portfolio.portfolioData);
      const stocks = portfolioData.stocks || [];

      if (stocks.length === 0) {
        throw new Error("Portfolio has no stocks");
      }

      // Optimize portfolio
      const result = optimizePortfolio(stocks, input.criterion, input.targetReturn, input.maxRisk);

      return result;
    })
});
