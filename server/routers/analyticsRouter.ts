/**
 * Analytics Router
 * ================
 * Uses the built-in Node.js analytics engine (server/analytics/engine.ts).
 * No external Python microservice required – works in Cloud deployment.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { calcRiskMetrics, calcDCF, optimizePortfolio, calcTechnicalAnalysis, calcRiskScoreHistory } from "../analytics/engine";

const HoldingSchema = z.object({
  ticker: z.string(),
  weight: z.number().min(0).max(1),
  currency: z.string().default("USD"),
});

export const analyticsRouter = router({
  /**
   * Health check – analytics engine is always available in Node.js
   */
  health: protectedProcedure.query(async () => {
    return { status: "online" };
  }),

  /**
   * Risk Metrics: VaR, Sharpe, Sortino, Beta, Max Drawdown, Volatility
   */
  riskMetrics: protectedProcedure
    .input(
      z.object({
        holdings: z.array(HoldingSchema).min(1),
        benchmark: z.string().default("SPY"),
        riskFreeRate: z.number().default(0.02),
        confidenceLevel: z.number().default(0.95),
        lookbackDays: z.number().default(252),
      })
    )
    .query(async ({ input }) => {
      try {
        return await calcRiskMetrics({
          holdings: input.holdings,
          benchmark: input.benchmark,
          riskFreeRate: input.riskFreeRate,
          confidenceLevel: input.confidenceLevel,
          lookbackDays: input.lookbackDays,
        });
      } catch (err: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message ?? "Risk metrics calculation failed",
        });
      }
    }),

  /**
   * DCF Valuation: Intrinsic value per share with upside/downside
   */
  dcfValuation: protectedProcedure
    .input(
      z.object({
        ticker: z.string(),
        riskFreeRate: z.number().default(0.02),
        marketRiskPremium: z.number().default(0.055),
        terminalGrowthRate: z.number().default(0.025),
        projectionYears: z.number().default(5),
      })
    )
    .query(async ({ input }) => {
      try {
        return await calcDCF({
          ticker: input.ticker,
          riskFreeRate: input.riskFreeRate,
          marketRiskPremium: input.marketRiskPremium,
          terminalGrowthRate: input.terminalGrowthRate,
          projectionYears: input.projectionYears,
        });
      } catch (err: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message ?? "DCF valuation failed",
        });
      }
    }),

  /**
   * Portfolio Optimization: Efficient Frontier, Max Sharpe, Min Variance
   */
  optimize: protectedProcedure
    .input(
      z.object({
        tickers: z.array(z.string()).min(2),
        lookbackDays: z.number().default(252),
        riskFreeRate: z.number().default(0.02),
        method: z.enum(["max_sharpe", "min_variance", "equal_weight", "max_dividend"]).default("max_sharpe"),
      })
    )
    .query(async ({ input }) => {
      try {
        return await optimizePortfolio({
          tickers: input.tickers,
          lookbackDays: input.lookbackDays,
          riskFreeRate: input.riskFreeRate,
          method: input.method,
        });
      } catch (err: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message ?? "Portfolio optimization failed",
        });
      }
    }),

  /**
   * Historical Risk Score Timeline: Weekly risk scores over the past year
   */
  riskScoreHistory: protectedProcedure
    .input(
      z.object({
        holdings: z.array(HoldingSchema).min(1),
        benchmark: z.string().default("SPY"),
        riskFreeRate: z.number().default(0.02),
        confidenceLevel: z.number().default(0.95),
        weeks: z.number().default(52),
        windowDays: z.number().default(63),
      })
    )
    .query(async ({ input }) => {
      try {
        return await calcRiskScoreHistory({
          holdings: input.holdings,
          benchmark: input.benchmark,
          riskFreeRate: input.riskFreeRate,
          confidenceLevel: input.confidenceLevel,
          weeks: input.weeks,
          windowDays: input.windowDays,
        });
      } catch (err: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message ?? "Risk score history calculation failed",
        });
      }
    }),

  /**
   * Technical Analysis: RSI, MACD, Bollinger Bands for a single ticker
   */
  technicalAnalysis: protectedProcedure
    .input(
      z.object({
        ticker: z.string(),
        lookbackDays: z.number().default(180),
      })
    )
    .query(async ({ input }) => {
      try {
        return await calcTechnicalAnalysis({
          ticker: input.ticker,
          lookbackDays: input.lookbackDays,
        });
      } catch (err: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message ?? "Technical analysis failed",
        });
      }
    }),
});
