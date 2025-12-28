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

/**
 * Generate smart portfolio based on investment amount and investor type
 */
async function generateSmartPortfolio(
  investmentAmount: number,
  investorType: "conservative" | "balanced" | "dynamic",
  userId: number
): Promise<{ portfolioId: number; stocks: any[] }> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Fetch all available stocks from database
  const { getAllStocks } = await import("../db");
  const allStocks = await getAllStocks();

  if (allStocks.length === 0) {
    throw new Error("No stocks available in database");
  }

  // Filter and score stocks based on investor type
  let scoredStocks = allStocks.map(stock => {
    const currentPrice = parseFloat(stock.currentPrice || "0");
    const dividendYield = parseFloat(stock.dividendYield || "0");
    const ytdPerformance = parseFloat(stock.ytdPerformance || "0");
    const peRatio = parseFloat(stock.peRatio || "0");
    
    let score = 0;
    
    switch (investorType) {
      case "conservative":
        // Prioritize high dividend yield, low volatility, established companies
        score = dividendYield * 3 + (peRatio > 0 && peRatio < 20 ? 2 : 0);
        if (ytdPerformance > -10 && ytdPerformance < 20) score += 2; // Stable performance
        break;
        
      case "balanced":
        // Balance between growth and dividends
        score = dividendYield * 1.5 + (ytdPerformance > 0 ? ytdPerformance * 0.1 : 0);
        if (peRatio > 0 && peRatio < 30) score += 1;
        break;
        
      case "dynamic":
        // Prioritize growth and performance
        score = (ytdPerformance > 0 ? ytdPerformance * 0.2 : 0) + (peRatio > 20 ? 1 : 0);
        if (dividendYield > 0) score += dividendYield * 0.5; // Bonus for dividends but not primary
        break;
    }
    
    return { ...stock, score, currentPrice, dividendYield, ytdPerformance };
  });

  // Filter out stocks with invalid prices
  scoredStocks = scoredStocks.filter(s => s.currentPrice > 0);

  // Sort by score and select top stocks
  scoredStocks.sort((a, b) => b.score - a.score);
  
  // Determine number of positions based on investment amount
  let numberOfPositions: number;
  if (investmentAmount < 5000) {
    numberOfPositions = 5;
  } else if (investmentAmount < 15000) {
    numberOfPositions = 8;
  } else if (investmentAmount < 30000) {
    numberOfPositions = 10;
  } else {
    numberOfPositions = 12;
  }
  
  const selectedStocks = scoredStocks.slice(0, numberOfPositions);

  // Calculate weights based on investor type
  let weights: number[];
  
  if (investorType === "conservative") {
    // More equal weighting for conservative
    weights = selectedStocks.map(() => 100 / numberOfPositions);
  } else {
    // Exponential decay for balanced/dynamic (favor top performers)
    weights = selectedStocks.map((_, i) => Math.exp(-i * 0.15));
    const sumWeights = weights.reduce((a, b) => a + b, 0);
    weights = weights.map(w => (w / sumWeights) * 100);
  }

  // Calculate shares for each stock
  const portfolioStocks = selectedStocks.map((stock, i) => {
    const allocation = (weights[i] / 100) * investmentAmount;
    const shares = Math.floor(allocation / stock.currentPrice);
    
    return {
      ticker: stock.ticker,
      companyName: stock.companyName,
      currentPrice: stock.currentPrice,
      portfolioWeight: weights[i],
      shares,
      value: shares * stock.currentPrice,
      dividendYield: stock.dividendYield,
      ytdPerformance: stock.ytdPerformance,
      peRatio: stock.peRatio,
    };
  });

  // Calculate portfolio metrics
  const totalValue = portfolioStocks.reduce((sum, s) => sum + s.value, 0);
  const avgDividendYield = portfolioStocks.reduce((sum, s) => 
    sum + s.dividendYield * (s.portfolioWeight / 100), 0
  );
  const expectedReturn = portfolioStocks.reduce((sum, s) => 
    sum + s.ytdPerformance * (s.portfolioWeight / 100), 0
  );

  // Save portfolio to database
  const portfolioName = `${investorType.charAt(0).toUpperCase() + investorType.slice(1)} Portfolio (${new Date().toLocaleDateString('de-CH')})`;
  const portfolioDescription = `Automatisch generiertes ${investorType} Portfolio mit CHF ${investmentAmount.toLocaleString('de-CH')} Investitionssumme`;
  
  const portfolioData = {
    stocks: portfolioStocks,
    metrics: {
      totalValue,
      avgDividendYield,
      expectedReturn,
      numberOfPositions,
      investorType,
    },
  };

  const [insertResult] = await db.insert(savedPortfolios).values({
    userId,
    name: portfolioName,
    description: portfolioDescription,
    portfolioData: JSON.stringify(portfolioData),
  });

  return {
    portfolioId: insertResult.insertId,
    stocks: portfolioStocks,
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
    }),

  /**
   * Generate smart portfolio based on investment amount and investor type
   */
  generateSmartPortfolio: protectedProcedure
    .input(z.object({
      investmentAmount: z.number().min(1000),
      investorType: z.enum(["conservative", "balanced", "dynamic"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await generateSmartPortfolio(
        input.investmentAmount,
        input.investorType,
        ctx.user.id
      );
      return result;
    }),
});
