import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  activatePortfolio,
  calculatePortfolioMetrics,
  getBenchmarkData,
  upsertBenchmarkData,
  getSavedPortfolioById,
  getPortfolioTransactions,
} from "../db";

/**
 * Portfolio Management Router
 * Handles portfolio activation, metrics calculation, and benchmark data
 */
export const portfolioManagementRouter = router({
  /**
   * Get detailed portfolio information with holdings and metrics
   */
  getPortfolioDetails: protectedProcedure
    .input(
      z.object({
        portfolioId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const portfolio = await getSavedPortfolioById(input.portfolioId, ctx.user.id);
      
      if (!portfolio) {
        throw new Error("Portfolio not found");
      }

      // Get transactions
      const transactions = await getPortfolioTransactions(input.portfolioId);

      // Calculate metrics
      const metrics = await calculatePortfolioMetrics(input.portfolioId, ctx.user.id);

      // Parse portfolio data
      const portfolioData = JSON.parse(portfolio.portfolioData);

      return {
        portfolio,
        holdings: portfolioData.stocks || [],
        transactions,
        metrics,
      };
    }),

  /**
   * Activate a portfolio by setting it to live status and generating initial transactions
   */
  activatePortfolio: protectedProcedure
    .input(
      z.object({
        portfolioId: z.number(),
        startCapital: z.string(),
        benchmark: z.enum(["SMI", "SP500", "MSCI_WORLD"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await activatePortfolio(
        input.portfolioId,
        ctx.user.id,
        input.startCapital,
        input.benchmark
      );

      if (!result) {
        throw new Error("Failed to activate portfolio");
      }

      return result;
    }),

  /**
   * Calculate portfolio performance metrics
   */
  calculateMetrics: protectedProcedure
    .input(
      z.object({
        portfolioId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const metrics = await calculatePortfolioMetrics(input.portfolioId, ctx.user.id);
      
      if (!metrics) {
        throw new Error("Failed to calculate metrics");
      }

      return metrics;
    }),

  /**
   * Get benchmark historical data
   */
  getBenchmarkData: protectedProcedure
    .input(
      z.object({
        benchmark: z.enum(["SMI", "SP500", "MSCI_WORLD"]),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const data = await getBenchmarkData(
        input.benchmark,
        input.startDate,
        input.endDate
      );

      return data;
    }),

  /**
   * Upsert benchmark data (admin only - for data seeding)
   */
  upsertBenchmarkData: protectedProcedure
    .input(
      z.object({
        benchmark: z.enum(["SMI", "SP500", "MSCI_WORLD"]),
        date: z.string(),
        close: z.string(),
        source: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Only allow admin users to seed benchmark data
      if (ctx.user.role !== "admin") {
        throw new Error("Unauthorized: Admin access required");
      }

      const result = await upsertBenchmarkData(input);

      if (!result) {
        throw new Error("Failed to upsert benchmark data");
      }

      return result;
    }),
});
