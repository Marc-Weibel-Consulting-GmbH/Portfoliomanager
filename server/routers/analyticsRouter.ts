/**
 * Analytics Router
 * ================
 * Proxies requests to the Fincept Analytics Python microservice.
 * Provides tRPC procedures for risk metrics, DCF valuation, and portfolio optimization.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

const ANALYTICS_BASE_URL = process.env.ANALYTICS_SERVICE_URL || "http://localhost:8001";

async function callAnalyticsService(path: string, body: unknown) {
  try {
    const response = await fetch(`${ANALYTICS_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000), // 60s timeout for heavy computations
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Analytics service error (${response.status}): ${errorText}`,
      });
    }

    return response.json();
  } catch (err: any) {
    if (err instanceof TRPCError) throw err;
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Analytics service unavailable: ${err.message}`,
    });
  }
}

const HoldingSchema = z.object({
  ticker: z.string(),
  weight: z.number().min(0).max(1),
  currency: z.string().default("USD"),
});

export const analyticsRouter = router({
  /**
   * Health check – is the Python microservice running?
   */
  health: protectedProcedure.query(async () => {
    try {
      const res = await fetch(`${ANALYTICS_BASE_URL}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok ? { status: "online" } : { status: "offline" };
    } catch {
      return { status: "offline" };
    }
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
      return callAnalyticsService("/analytics/risk-metrics", {
        holdings: input.holdings,
        benchmark: input.benchmark,
        risk_free_rate: input.riskFreeRate,
        confidence_level: input.confidenceLevel,
        lookback_days: input.lookbackDays,
      });
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
      return callAnalyticsService("/analytics/dcf", {
        ticker: input.ticker,
        risk_free_rate: input.riskFreeRate,
        market_risk_premium: input.marketRiskPremium,
        terminal_growth_rate: input.terminalGrowthRate,
        projection_years: input.projectionYears,
      });
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
        method: z.enum(["max_sharpe", "min_variance", "equal_weight"]).default("max_sharpe"),
      })
    )
    .query(async ({ input }) => {
      return callAnalyticsService("/analytics/optimize", {
        tickers: input.tickers,
        lookback_days: input.lookbackDays,
        risk_free_rate: input.riskFreeRate,
        method: input.method,
      });
    }),
});
