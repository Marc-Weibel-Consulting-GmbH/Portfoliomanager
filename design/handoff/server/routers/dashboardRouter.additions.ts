// ─────────────────────────────────────────────────────────────────────────
// New tRPC endpoints required by the redesigned Dashboard.
//
// HOW TO MERGE THIS FILE:
//
// 1) Open server/routers/dashboardRouter.ts
// 2) Append the seven procedures below into the `router({ ... })` object.
//    All imports already exist in that file (protectedProcedure, z, db, …).
// 3) Extend the EXISTING `dashboard.getAggregatedMetrics` return object to
//    also include: dayChange, dayChangePercent, totalReturnPercent,
//    benchmarkSmiYtd, benchmarkMsciYtd.
// 4) Delete this file.
//
// Each procedure below is a thin wrapper around logic that LIKELY ALREADY
// EXISTS elsewhere in the codebase. Pointers:
//   - getPerformanceTimeseries → server/routers/dashboardPerformanceRouter.ts
//     and server/routers/portfolioPerformanceRouter.ts
//   - getAggregatedHoldings   → server/db.ts: getSavedPortfolios + stocks
//   - getRiskMetrics          → server/performanceCalculations.ts
//   - getBubbleIndicator      → server/routers/marketRegimeRouter.ts and
//                               client/src/components/LiveLpplCheck.tsx
//   - getCopilotInsights      → server/routers/copilotRouter.ts and
//                               server/routers/aiInsightsRouter.ts
//
// The point of this file is to lock the API SHAPE — the client treats these
// as the contract. Once these are real, the matching `?? MOCK_*` fallbacks
// in client/src/components/dashboard/useDashboardData.ts can be removed.
// ─────────────────────────────────────────────────────────────────────────

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

const scopeInput = z.object({
  scope: z.union([z.literal("aggregate"), z.number()]).default("aggregate"),
});

const scopeRangeInput = scopeInput.extend({
  range: z.enum(["1T", "1M", "YTD", "1J", "3J", "5J", "Max"]).default("YTD"),
});

// Drop these into the existing dashboardRouter
export const dashboardRouterAdditions = {

  // ──────────────────────────────────────────────────────────────────────
  // Performance time series — portfolio vs SMI vs MSCI World
  // ──────────────────────────────────────────────────────────────────────
  getPerformanceTimeseries: protectedProcedure
    .input(scopeRangeInput)
    .query(async ({ ctx, input }) => {
      // TODO: pull from chartDataUpdater / historicalPrices
      // Suggested approach:
      //  1. Resolve which portfolios are in scope (aggregate = all live)
      //  2. Compute a daily value series; reindex to % return from base
      //  3. Pull benchmark series for SSMI and IWDA.AS (or URTH for MSCI World)
      //     for the same date range and reindex the same way
      //  4. Downsample to ~12-60 points depending on range
      //
      // Return shape:
      //   { range, scope, points: [{ label, portfolio, smi, msci }, ...] }

      return {
        range: input.range,
        scope: input.scope,
        points: [] as Array<{
          label: string;
          portfolio: number;
          smi: number;
          msci: number;
        }>,
      };
    }),

  // ──────────────────────────────────────────────────────────────────────
  // Flat holdings list across all live portfolios in the chosen scope
  // ──────────────────────────────────────────────────────────────────────
  getAggregatedHoldings: protectedProcedure
    .input(scopeInput)
    .query(async ({ ctx, input }) => {
      // TODO: very similar to dashboard.getAggregatedMetrics — re-use
      // calculatePortfolioValueFromData() pattern but emit per-holding
      // entries instead of summing.
      //
      // For each unique ticker across in-scope portfolios:
      //  - Sum shares × currentPriceCHF → value
      //  - Compute weight = value / totalValue
      //  - Look up sector / region from the stocks table
      //  - Compute ytd: (currentPrice - ytdStartPrice) / ytdStartPrice
      //  - Compute change1d from previousClose if available
      //  - Add a synthetic CASH row from sum(cashBalance)
      //
      // Return shape: Holding[]   (see client types.ts)

      return [] as Array<{
        ticker: string;
        name: string;
        sector: string;
        region: "CH" | "US" | "EU" | "Other";
        weight: number;
        value: number;
        shares: number;
        currentPrice: number;
        currency: string;
        change1d: number;
        ytd: number;
        dividendYield?: number;
        color?: string;
      }>;
    }),

  // ──────────────────────────────────────────────────────────────────────
  // Sector allocation (rolled up from holdings, with weighted YTD)
  // ──────────────────────────────────────────────────────────────────────
  getSectorAllocation: protectedProcedure
    .input(scopeInput)
    .query(async ({ ctx, input }) => {
      // TODO: call getAggregatedHoldings, groupBy sector, sum weight,
      // weight-avg ytd. Attach color from a shared SECTOR_COLOR map (mirror
      // client/src/components/dashboard/format.ts).
      return [] as Array<{ name: string; weight: number; ytd: number; color: string }>;
    }),

  // ──────────────────────────────────────────────────────────────────────
  // Region allocation
  // ──────────────────────────────────────────────────────────────────────
  getRegionAllocation: protectedProcedure
    .input(scopeInput)
    .query(async ({ ctx, input }) => {
      // TODO: derive from holdings.region (CH/US/EU/Other) + Cash.
      return [] as Array<{ name: string; weight: number; color: string }>;
    }),

  // ──────────────────────────────────────────────────────────────────────
  // Risk metrics — volatility, drawdown, VaR, Sharpe, Beta, Concentration
  // ──────────────────────────────────────────────────────────────────────
  getRiskMetrics: protectedProcedure
    .input(scopeInput)
    .query(async ({ ctx, input }) => {
      // TODO: most of the math lives in server/performanceCalculations.ts.
      // Steps:
      //  1. Get daily return series of the in-scope portfolio
      //  2. annualized volatility = std(daily) * sqrt(252)
      //  3. max drawdown over the full series
      //  4. var95 = quantile(daily, 0.05)
      //  5. sharpe = (mean(daily) - rf) / std(daily) * sqrt(252)
      //  6. beta = cov(portfolio, SMI) / var(SMI)
      //  7. concentrationTop3 = sum top-3 weights from getAggregatedHoldings
      //  8. volBenchmark / drawdownBenchmark = same math on SSMI series

      return {
        volatility: 0,
        volBenchmark: 0,
        maxDrawdown: 0,
        drawdownBenchmark: 0,
        var95: 0,
        concentrationTop3: 0,
        sharpeRatio: 0,
        beta: 0,
      };
    }),

  // ──────────────────────────────────────────────────────────────────────
  // LPPL bubble indicator (single number 0..100 + 8-week trend)
  // ──────────────────────────────────────────────────────────────────────
  getBubbleIndicator: protectedProcedure
    .input(scopeInput)
    .query(async ({ ctx, input }) => {
      // TODO: the LPPL fit already exists in client/src/components/
      // LiveLpplCheck.tsx and server/routers/marketRegimeRouter.ts.
      // Run it on the in-scope portfolio's blended value series.
      //
      // history: store rolling weekly scores (e.g. in a new table
      // `lppl_scores(portfolioOrUserScope, weekIso, score)`) and return
      // the last 8.
      //
      // label thresholds: <33 = Niedrig, 33-66 = Mittel, >66 = Hoch
      // interpretation: short German sentence — could be templated.

      return {
        score: 0,
        label: "Niedrig" as "Niedrig" | "Mittel" | "Hoch",
        history: [] as number[],
        interpretation: "",
      };
    }),

  // ──────────────────────────────────────────────────────────────────────
  // Copilot insights — 3-5 highest-priority items for the dashboard card
  // ──────────────────────────────────────────────────────────────────────
  getCopilotInsights: protectedProcedure
    .input(scopeInput)
    .query(async ({ ctx, input }) => {
      // TODO: copilotRouter.ts already generates richer insights. Take
      // its output, prioritize by severity + recency, cap at 5, strip
      // anything that's not user-actionable.

      return [] as Array<{
        id: string;
        severity: "positive" | "watch" | "info";
        title: string;
        body: string;
        action: string;
        actionHref?: string;
      }>;
    }),
};
