import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { savedPortfolios } from "../../drizzle/schema";

// OPT-4 (Audit 2026-07): Der frühere `optimize`-Endpoint war ein Pseudo-
// Optimizer («Volatilität» = gewichteter |YTD|, «expectedReturn» = YTD-
// Vergangenheit, «Sharpe» = Durchschnitt der Titel-Sharpes) und wurde von
// keiner Client-Seite aufgerufen — entfernt. Echte Optimierung läuft über
// analytics.optimize (server/analytics/engine.ts).

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

  // OPT-4 (Audit 2026-07): Die CHF-Allokation wurde vorher durch den
  // LOKALWÄHRUNGS-Kurs geteilt (USD/GBp als CHF behandelt) — Stückzahlen und
  // Positionswerte waren für Fremdwährungstitel systematisch falsch. Jetzt:
  // Kurs per convertToCHF in CHF umrechnen; Titel ohne verfügbaren Wechselkurs
  // werden übersprungen (kein 1:1-Fallback, R-10).
  const { convertToCHF } = await import("../fxHelper");
  const todayStr = new Date().toISOString().split("T")[0];
  const selectedStocks: Array<(typeof scoredStocks)[number] & { priceChf: number }> = [];
  for (const stock of scoredStocks) {
    if (selectedStocks.length >= numberOfPositions) break;
    const priceChf = await convertToCHF(stock.currentPrice, stock.currency || "CHF", todayStr);
    if (!(priceChf > 0)) {
      console.warn(`[generateSmartPortfolio] ${stock.ticker}: kein ${stock.currency}/CHF-Kurs — übersprungen`);
      continue;
    }
    selectedStocks.push(Object.assign(stock, { priceChf }));
  }
  if (selectedStocks.length < 2) {
    throw new Error("Zu wenige Titel mit gültigem CHF-Kurs für ein Portfolio gefunden.");
  }

  // Calculate weights based on investor type
  let weights: number[];

  if (investorType === "conservative") {
    // More equal weighting for conservative
    weights = selectedStocks.map(() => 100 / selectedStocks.length);
  } else {
    // Exponential decay for balanced/dynamic (favor top performers)
    weights = selectedStocks.map((_, i) => Math.exp(-i * 0.15));
    const sumWeights = weights.reduce((a, b) => a + b, 0);
    weights = weights.map(w => (w / sumWeights) * 100);
  }

  // Calculate shares for each stock (CHF-Allokation ÷ CHF-Kurs; value in CHF)
  const portfolioStocks = selectedStocks.map((stock, i) => {
    const allocation = (weights[i] / 100) * investmentAmount;
    const shares = Math.floor(allocation / stock.priceChf);

    return {
      ticker: stock.ticker,
      companyName: stock.companyName,
      currentPrice: stock.currentPrice,
      currency: stock.currency || "CHF",
      priceChf: stock.priceChf,
      portfolioWeight: weights[i],
      shares,
      value: shares * stock.priceChf,
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
      numberOfPositions: portfolioStocks.length,
      investorType,
    },
  };

  const [insertResult] = await db.insert(savedPortfolios).values({
    userId,
    name: portfolioName,
    description: portfolioDescription,
    portfolioData: JSON.stringify(portfolioData),
    investmentAmount: String(investmentAmount),
    portfolioType: "demo",
    status: "planned",
    isLive: 0,
  });

  return {
    portfolioId: insertResult.insertId,
    stocks: portfolioStocks,
  };
}

export const portfolioOptimizerRouter = router({
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
