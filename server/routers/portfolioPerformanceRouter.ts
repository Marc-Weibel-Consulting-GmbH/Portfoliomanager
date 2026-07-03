import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { calculateHoldingsPerformance } from "../performanceCalculations";
import { calculatePortfolioPerformance } from "../lib/performanceService";
import { extractPortfolioCashFlows } from "../lib/performanceEngine";
import { getGrossAmountCHF, getFeesCHF, getSignedFlowCHF } from "../lib/transactionSemantics";
import type { PortfolioTransaction } from "../../drizzle/schema";

/**
 * Portfolio Performance Router
 * Provides accurate performance calculations using TWR, MWR/IRR, and comprehensive metrics
 *
 * R-04: TWR/MWR and the value history come from the historical-price pipeline
 * (lib/performanceService.calculatePortfolioPerformance). The legacy engine
 * (performanceCalculations.buildValuePoints/calculatePerformanceMetrics) valued
 * PAST dates with CURRENT prices and is retired here — only its point-in-time
 * pieces (calculateHoldingsPerformance cost basis, fee/dividend/flow sums via
 * transactionSemantics) remain in use.
 */

/** First transaction date (YYYY-MM-DD) — start of the measurement period. */
function firstTransactionDate(transactions: PortfolioTransaction[]): string {
  let min: string | null = null;
  for (const tx of transactions) {
    const d = new Date(tx.transactionDate).toISOString().split("T")[0];
    if (min === null || d < min) min = d;
  }
  return min ?? new Date().toISOString().split("T")[0];
}

/**
 * Comprehensive metrics in the legacy response shape (see PERFORMANCE_API.md).
 * Point-in-time fields use the same formulas as the retired
 * calculatePerformanceMetrics; timeWeightedReturn/moneyWeightedReturn now come
 * from the historical-price pipeline (R-04) instead of a flat current-price
 * series. Both are percentages; TWR annualized only for periods > 1 year,
 * MWR always annualized — matching the legacy field semantics.
 */
async function computePortfolioMetrics(
  portfolioId: number,
  transactions: PortfolioTransaction[],
  currentPrices: Map<string, number>,
  totalRealizedGains: number
) {
  const holdings = calculateHoldingsPerformance(transactions, currentPrices);
  const currentValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const unrealizedGains = holdings.reduce((sum, h) => sum + h.unrealizedGain, 0);
  const totalInvestedInHoldings = holdings.reduce((sum, h) => sum + h.totalInvested, 0);

  let totalDeposits = 0;
  let totalWithdrawals = 0;
  let dividendsReceived = 0;
  let feesPaid = 0;

  for (const tx of transactions) {
    if (tx.transactionType === "deposit") {
      totalDeposits += getSignedFlowCHF(tx); // immer positiv
    } else if (tx.transactionType === "withdrawal") {
      // R-01: getSignedFlowCHF normalisiert beide Speicher-Konventionen.
      totalWithdrawals += -getSignedFlowCHF(tx);
    } else if (tx.transactionType === "dividend") {
      dividendsReceived += getGrossAmountCHF(tx);
    }
    feesPaid += getFeesCHF(tx);
  }

  const totalInvested = totalDeposits - totalWithdrawals;
  const totalReturn = currentValue + totalRealizedGains + dividendsReceived - totalInvested - feesPaid;
  const totalReturnPercent = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;
  const unrealizedGainsPercent = totalInvestedInHoldings > 0
    ? (unrealizedGains / totalInvestedInHoldings) * 100
    : 0;

  // R-04: TWR/MWR aus der historisch korrekten Pipeline (statt buildValuePoints,
  // das vergangene Stichtage mit HEUTIGEN Kursen bewertete).
  const perf = await calculatePortfolioPerformance({
    portfolioId,
    startDate: firstTransactionDate(transactions),
    endDate: new Date().toISOString().split("T")[0],
  });

  return {
    totalReturn,
    totalReturnPercent,
    timeWeightedReturn: perf.ttwror.annualizedReturn * 100,
    moneyWeightedReturn: perf.irr.annualizedIRR * 100,
    unrealizedGains,
    unrealizedGainsPercent,
    realizedGains: totalRealizedGains,
    totalInvested,
    currentValue,
    dividendsReceived,
    feesPaid,
  };
}

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

      // Calculate comprehensive metrics (TWR/MWR via historical pipeline, R-04)
      return computePortfolioMetrics(portfolioId, transactions, currentPrices, totalRealizedGains);
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

      // Calculate holdings performance (point-in-time cost basis — no history
      // involved, so the legacy function stays; R-04)
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
   *
   * R-04: previously built from buildValuePoints, which valued every PAST date
   * with TODAY's prices (a flat series). Now each point is the portfolio's
   * market value (stocks + cash, CHF) on that date using HISTORICAL prices.
   * Response shape is unchanged: Array<{ date, value, cashFlows }>, where
   * cashFlows is the net EXTERNAL flow (deposits positive, withdrawals
   * negative) on that date — buys/sells no longer appear as flows.
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

      // Verify portfolio ownership
      const portfolio = await getSavedPortfolioById(input.portfolioId, ctx.user.id);
      if (!portfolio) {
        throw new Error("Portfolio not found");
      }

      const transactions = await getPortfolioTransactions(input.portfolioId);
      if (transactions.length === 0) {
        return [];
      }

      const startDate = input.startDate ?? firstTransactionDate(transactions);
      const endDate = input.endDate ?? new Date().toISOString().split("T")[0];

      const perf = await calculatePortfolioPerformance({
        portfolioId: input.portfolioId,
        startDate,
        endDate,
      });

      // Net external flows per date (sign-normalized, R-01)
      const flowsByDate = new Map<string, number>();
      for (const cf of extractPortfolioCashFlows(transactions as any)) {
        if (cf.date < startDate || cf.date > endDate) continue;
        flowsByDate.set(cf.date, (flowsByDate.get(cf.date) || 0) + cf.amount);
      }

      return perf.dailyValuations.map((v) => ({
        date: v.date,
        value: v.marketValue,
        cashFlows: flowsByDate.get(v.date) || 0,
      }));
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

        // Calculate metrics (TWR/MWR via historical pipeline, R-04)
        const metrics = await computePortfolioMetrics(
          portfolioId,
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

      // Calculate components (kanonische Semantik, lib/transactionSemantics.ts:
      // Vorzeichen via Transaktionstyp normalisiert, R-01/R-15)
      let dividends = 0;
      let fees = 0;
      let deposits = 0;
      let withdrawals = 0;

      transactions.forEach((tx) => {
        if (tx.transactionType === "dividend") {
          dividends += getGrossAmountCHF(tx);
        } else if (tx.transactionType === "deposit") {
          deposits += getSignedFlowCHF(tx); // immer positiv
        } else if (tx.transactionType === "withdrawal") {
          withdrawals += -getSignedFlowCHF(tx); // immer positiver Entnahmebetrag
        }

        fees += getFeesCHF(tx);
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
