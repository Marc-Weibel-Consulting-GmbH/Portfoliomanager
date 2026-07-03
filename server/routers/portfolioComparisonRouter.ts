import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
// D-01: unified holdings replay (buy/entry/sell, chronological, DESC-safe)
import { buildHoldings } from "../lib/holdings";

export const portfolioComparisonRouter = router({
    compare: protectedProcedure
      .input(z.object({ portfolioIds: z.array(z.number()) }))
      .query(async ({ input, ctx }) => {
        const { getSavedPortfolioById, getPortfolioTransactions, getDb } = await import("../db");
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }

        const { stocks: stocksTable } = await import("../../drizzle/schema");
        const { inArray } = await import("drizzle-orm");

        // Fetch all selected portfolios
        const portfolios = await Promise.all(
          input.portfolioIds.map((id) => getSavedPortfolioById(id, ctx.user.id))
        );

        // Filter out null portfolios (not found or no access)
        const validPortfolios = portfolios.filter((p) => p !== null);

        if (validPortfolios.length < 2) {
          throw new Error("At least 2 valid portfolios required for comparison");
        }

        // Calculate metrics for each portfolio
        const comparisonResults = await Promise.all(
          validPortfolios.map(async (portfolio) => {
            const portfolioData = JSON.parse(portfolio.portfolioData);
            const stocks = portfolioData.stocks || [];

            // Get transactions for live portfolios
            let currentValue = 0;
            let totalInvested = 0;
            let performance = 0;

            if (portfolio.isLive) {
              const transactions = await getPortfolioTransactions(portfolio.id);

              // Calculate holdings (D-01: unified replay; shares x pricePerShare
              // cost basis == buildHoldings.totalCostLocal, moving average with
              // clamped oversell instead of the previous NaN on sell-before-buy)
              const holdings = buildHoldings(transactions);

              // Calculate current value
              const tickers = Array.from(holdings.entries())
                .filter(([, h]) => h.shares > 0)
                .map(([ticker]) => ticker);
              if (tickers.length > 0) {
                const stockData = await db.select().from(stocksTable).where(inArray(stocksTable.ticker, tickers));

                tickers.forEach((ticker) => {
                  const stock = stockData.find((s) => s.ticker === ticker);
                  const currentPrice = stock?.currentPrice ? parseFloat(stock.currentPrice) : 0;
                  const holding = holdings.get(ticker)!;
                  currentValue += holding.shares * currentPrice;
                  totalInvested += holding.totalCostLocal;
                });
              }

              performance = totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : 0;
            } else {
              // Test portfolio - use saved data
              currentValue = stocks.reduce((sum: number, s: any) => sum + (s.currentValue || 0), 0);
              totalInvested = stocks.reduce((sum: number, s: any) => sum + (s.totalInvested || 0), 0);
              performance = totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : 0;
            }

            // Get metrics from portfolio data
            const metrics = portfolioData.metrics || {};

            // Calculate sector allocation
            const sectorAllocation: Record<string, number> = {};
            const tickers = stocks.map((s: any) => s.ticker).filter(Boolean);
            if (tickers.length > 0) {
              const stockData = await db.select().from(stocksTable).where(inArray(stocksTable.ticker, tickers));
              
              stocks.forEach((stock: any) => {
                const dbStock = stockData.find((s) => s.ticker === stock.ticker);
                const sector = dbStock?.sector || 'Other';
                const weight = parseFloat(stock.weight || stock.portfolioWeight || '0');
                sectorAllocation[sector] = (sectorAllocation[sector] || 0) + weight;
              });
            }

            return {
              id: portfolio.id,
              name: portfolio.name,
              performance,
              volatility: metrics.volatility || 0,
              sharpeRatio: metrics.sharpeRatio || 0,
              maxDrawdown: metrics.maxDrawdown || 0,
              avgDividendYield: metrics.avgDividendYield || 0,
              currentValue,
              totalInvested,
              sectorAllocation: Object.entries(sectorAllocation).map(([name, value]) => ({
                name,
                value,
              })),
            };
          })
        );

        // Generate performance history (simplified - using current data)
        const performanceHistory = comparisonResults.map((p) => ({
          id: p.id,
          name: p.name,
          history: [
            { date: '30 days ago', performance: p.performance * 0.7 },
            { date: '15 days ago', performance: p.performance * 0.85 },
            { date: 'Today', performance: p.performance },
          ],
        }));

        return {
          portfolios: comparisonResults,
          performanceHistory,
        };
      }),
});
