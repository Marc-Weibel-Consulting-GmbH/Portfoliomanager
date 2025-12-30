import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import {
  calculatePerformanceMetrics,
  calculateHoldingsPerformance,
  buildValuePoints,
  calculateTimeWeightedReturn,
  calculateMoneyWeightedReturn,
} from "../performanceCalculations";

/**
 * Portfolio Performance Router
 * Provides accurate performance calculations using TWR, MWR/IRR, and comprehensive metrics
 */
export const portfolioMetricsRouter = router({
  /**
   * Get comprehensive performance metrics for a portfolio
   */
  getMetrics: protectedProcedure
    .input(z.number().int().positive())
    .query(async ({ input: portfolioId, ctx }) => {
      const { getSavedPortfolioById } = await import("../db");
      const { getPortfolioTransactions } = await import("../db");
      const { getRealizedGainsByPortfolio } = await import("../db-realizedGains");
      const { getStockByTicker } = await import("../db");

      // Verify portfolio ownership
      const portfolio = await getSavedPortfolioById(portfolioId, ctx.user.id);
      if (!portfolio) {
        throw new Error("Portfolio not found");
      }

      // Get all transactions
      const transactions = await getPortfolioTransactions(portfolioId);
      if (transactions.length === 0) {
        return {
          totalReturn: 0,
          totalReturnPercent: 0,
          timeWeightedReturn: 0,
          moneyWeightedReturn: 0,
          unrealizedGains: 0,
          unrealizedGainsPercent: 0,
          realizedGains: 0,
          totalInvested: 0,
          currentValue: 0,
          dividendsReceived: 0,
          feesPaid: 0,
        };
      }

      // Get current prices for all holdings
      const tickers = new Set<string>();
      transactions.forEach((tx) => {
        if (tx.ticker) tickers.add(tx.ticker);
      });

      const currentPrices = new Map<string, number>();
      for (const ticker of Array.from(tickers)) {
        const stock = await getStockByTicker(ticker);
        if (stock && stock.currentPrice) {
          currentPrices.set(ticker, parseFloat(stock.currentPrice));
        }
      }

      // Get realized gains
      const realizedGains = await getRealizedGainsByPortfolio(portfolioId);
      const totalRealizedGains = realizedGains.reduce(
        (sum, rg) => sum + parseFloat(rg.realizedGain || "0"),
        0
      );

      // Calculate comprehensive metrics
      const metrics = calculatePerformanceMetrics(
        transactions,
        currentPrices,
        totalRealizedGains
      );

      return metrics;
    }),

  /**
   * Get holdings with performance data
   */
  getHoldings: protectedProcedure
    .input(z.number().int().positive())
    .query(async ({ input: portfolioId, ctx }) => {
      const { getSavedPortfolioById } = await import("../db");
      const { getPortfolioTransactions } = await import("../db");
      const { getStockByTicker } = await import("../db");

      // Verify portfolio ownership
      const portfolio = await getSavedPortfolioById(portfolioId, ctx.user.id);
      if (!portfolio) {
        throw new Error("Portfolio not found");
      }

      // Get all transactions
      const transactions = await getPortfolioTransactions(portfolioId);
      if (transactions.length === 0) {
        return [];
      }

      // Get current prices for all holdings
      const tickers = new Set<string>();
      transactions.forEach((tx) => {
        if (tx.ticker) tickers.add(tx.ticker);
      });

      const currentPrices = new Map<string, number>();
      const stockDetails = new Map<string, any>();
      
      for (const ticker of Array.from(tickers)) {
        const stock = await getStockByTicker(ticker);
        if (stock) {
          if (stock.currentPrice) {
            currentPrices.set(ticker, parseFloat(stock.currentPrice));
          }
          stockDetails.set(ticker, stock);
        }
      }

      // Calculate holdings performance
      const holdings = calculateHoldingsPerformance(transactions, currentPrices);

      // Enrich with stock details
      const enrichedHoldings = holdings.map((holding) => {
        const stock = stockDetails.get(holding.ticker);
        return {
          ...holding,
          companyName: stock?.companyName || holding.ticker,
          currency: stock?.currency || "CHF",
          sector: stock?.sector || "Other",
          logoUrl: stock?.logoUrl || null,
          dividendYield: stock?.dividendYield || "0",
        };
      });

      return enrichedHoldings;
    }),

  /**
   * Get portfolio value over time for charting
   */
  getValueHistory: protectedProcedure
    .input(
      z.object({
        portfolioId: z.number().int().positive(),
        startDate: z.string().optional(), // YYYY-MM-DD
        endDate: z.string().optional(), // YYYY-MM-DD
      })
    )
    .query(async ({ input, ctx }) => {
      const { getSavedPortfolioById } = await import("../db");
      const { getPortfolioTransactions } = await import("../db");
      const { getStockByTicker } = await import("../db");

      // Verify portfolio ownership
      const portfolio = await getSavedPortfolioById(input.portfolioId, ctx.user.id);
      if (!portfolio) {
        throw new Error("Portfolio not found");
      }

      // Get all transactions
      let transactions = await getPortfolioTransactions(input.portfolioId);
      
      // Filter by date range if provided
      if (input.startDate) {
        const startDate = new Date(input.startDate);
        transactions = transactions.filter((tx) => tx.transactionDate >= startDate);
      }
      if (input.endDate) {
        const endDate = new Date(input.endDate);
        transactions = transactions.filter((tx) => tx.transactionDate <= endDate);
      }

      if (transactions.length === 0) {
        return [];
      }

      // Get current prices for all holdings
      const tickers = new Set<string>();
      transactions.forEach((tx) => {
        if (tx.ticker) tickers.add(tx.ticker);
      });

      const currentPrices = new Map<string, number>();
      for (const ticker of Array.from(tickers)) {
        const stock = await getStockByTicker(ticker);
        if (stock && stock.currentPrice) {
          currentPrices.set(ticker, parseFloat(stock.currentPrice));
        }
      }

      // Build value points
      const valuePoints = buildValuePoints(transactions, currentPrices);

      return valuePoints;
    }),

  /**
   * Get performance comparison between portfolios
   */
  comparePortfolios: protectedProcedure
    .input(z.array(z.number().int().positive()).min(2).max(5))
    .query(async ({ input: portfolioIds, ctx }) => {
      const { getSavedPortfolioById } = await import("../db");
      const { getPortfolioTransactions } = await import("../db");
      const { getRealizedGainsByPortfolio } = await import("../db-realizedGains");
      const { getStockByTicker } = await import("../db");

      const comparisons = [];

      for (const portfolioId of portfolioIds) {
        // Verify portfolio ownership
        const portfolio = await getSavedPortfolioById(portfolioId, ctx.user.id);
        if (!portfolio) {
          continue; // Skip portfolios that don't exist or don't belong to user
        }

        // Get all transactions
        const transactions = await getPortfolioTransactions(portfolioId);
        if (transactions.length === 0) {
          comparisons.push({
            portfolioId,
            portfolioName: portfolio.name,
            totalReturn: 0,
            totalReturnPercent: 0,
            timeWeightedReturn: 0,
            moneyWeightedReturn: 0,
            currentValue: 0,
            totalInvested: 0,
          });
          continue;
        }

        // Get current prices
        const tickers = new Set<string>();
        transactions.forEach((tx) => {
          if (tx.ticker) tickers.add(tx.ticker);
        });

        const currentPrices = new Map<string, number>();
        for (const ticker of Array.from(tickers)) {
          const stock = await getStockByTicker(ticker);
          if (stock && stock.currentPrice) {
            currentPrices.set(ticker, parseFloat(stock.currentPrice));
          }
        }

        // Get realized gains
        const realizedGains = await getRealizedGainsByPortfolio(portfolioId);
        const totalRealizedGains = realizedGains.reduce(
          (sum, rg) => sum + parseFloat(rg.realizedGain || "0"),
          0
        );

        // Calculate metrics
        const metrics = calculatePerformanceMetrics(
          transactions,
          currentPrices,
          totalRealizedGains
        );

        comparisons.push({
          portfolioId,
          portfolioName: portfolio.name,
          ...metrics,
        });
      }

      return comparisons;
    }),

  /**
   * Get detailed breakdown of returns (capital gains, dividends, fees)
   */
  getReturnBreakdown: protectedProcedure
    .input(z.number().int().positive())
    .query(async ({ input: portfolioId, ctx }) => {
      const { getSavedPortfolioById } = await import("../db");
      const { getPortfolioTransactions } = await import("../db");
      const { getRealizedGainsByPortfolio } = await import("../db-realizedGains");
      const { getStockByTicker } = await import("../db");

      // Verify portfolio ownership
      const portfolio = await getSavedPortfolioById(portfolioId, ctx.user.id);
      if (!portfolio) {
        throw new Error("Portfolio not found");
      }

      // Get all transactions
      const transactions = await getPortfolioTransactions(portfolioId);
      
      // Calculate components
      let dividends = 0;
      let fees = 0;
      let deposits = 0;
      let withdrawals = 0;

      transactions.forEach((tx) => {
        const amount = parseFloat(tx.totalAmountCHF || tx.totalAmount || "0");
        const txFees = parseFloat(tx.fees || "0");

        if (tx.transactionType === "dividend") {
          dividends += amount;
        } else if (tx.transactionType === "deposit") {
          deposits += amount;
        } else if (tx.transactionType === "withdrawal") {
          withdrawals += amount;
        }

        fees += txFees;
      });

      // Get realized gains
      const realizedGains = await getRealizedGainsByPortfolio(portfolioId);
      const totalRealizedGains = realizedGains.reduce(
        (sum, rg) => sum + parseFloat(rg.realizedGain || "0"),
        0
      );

      // Get current prices and calculate unrealized gains
      const tickers = new Set<string>();
      transactions.forEach((tx) => {
        if (tx.ticker) tickers.add(tx.ticker);
      });

      const currentPrices = new Map<string, number>();
      for (const ticker of Array.from(tickers)) {
        const stock = await getStockByTicker(ticker);
        if (stock && stock.currentPrice) {
          currentPrices.set(ticker, parseFloat(stock.currentPrice));
        }
      }

      const holdings = calculateHoldingsPerformance(transactions, currentPrices);
      const unrealizedGains = holdings.reduce((sum, h) => sum + h.unrealizedGain, 0);
      const currentValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);

      return {
        currentValue,
        totalInvested: deposits - withdrawals,
        unrealizedGains,
        realizedGains: totalRealizedGains,
        dividends,
        fees,
        netReturn: unrealizedGains + totalRealizedGains + dividends - fees,
      };
    }),
});
