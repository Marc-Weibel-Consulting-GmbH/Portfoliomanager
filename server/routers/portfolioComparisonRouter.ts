import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
// D-01: unified holdings replay (buy/entry/sell, chronological, DESC-safe)
import { buildHoldings } from "../lib/holdings";
import { convertToCHF, getFxRate } from "../fxHelper";
import { toChfPriceMap } from "../lib/performanceCore";
import { computeWeightedReturnSeries, type WeightedReturnInput } from "../lib/weightedReturnSeries";

/** Zeitraum der echten Verlaufskurve (FIN-2): 90 Tage, auf max. 30 Punkte gesampelt. */
const HISTORY_DAYS = 90;
const HISTORY_MAX_POINTS = 30;

export const portfolioComparisonRouter = router({
    compare: protectedProcedure
      .input(z.object({ portfolioIds: z.array(z.number()) }))
      .query(async ({ input, ctx }) => {
        const { getSavedPortfolioById, getPortfolioTransactions, getDb } = await import("../db");
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }

        const { stocks: stocksTable, historicalPrices } = await import("../../drizzle/schema");
        const { inArray, gte, and, asc } = await import("drizzle-orm");
        const todayStr = new Date().toISOString().split("T")[0];

        // Fetch all selected portfolios
        const portfolios = await Promise.all(
          input.portfolioIds.map((id) => getSavedPortfolioById(id, ctx.user.id))
        );

        // Filter out null portfolios (not found or no access)
        const validPortfolios = portfolios.filter((p) => p !== null);

        if (validPortfolios.length < 2) {
          throw new Error("At least 2 valid portfolios required for comparison");
        }

        // Stammdaten (Währung, aktueller Kurs, Sektor) für ALLE beteiligten Ticker einmalig laden.
        const allTickers = Array.from(new Set(validPortfolios.flatMap((portfolio) => {
          const portfolioData = JSON.parse(portfolio.portfolioData);
          return (portfolioData.stocks || []).map((s: any) => s.ticker).filter(Boolean);
        })));
        const stockData = allTickers.length > 0
          ? await db.select().from(stocksTable).where(inArray(stocksTable.ticker, allTickers))
          : [];
        const stockByTicker = new Map(stockData.map((s: any) => [s.ticker, s]));

        // Kurshistorie (90 Tage + Puffer) für die echte Verlaufskurve.
        const historyFrom = new Date(Date.now() - (HISTORY_DAYS + 10) * 24 * 60 * 60 * 1000)
          .toISOString().split("T")[0];
        const priceRows = allTickers.length > 0
          ? await db
              .select({ ticker: historicalPrices.ticker, date: historicalPrices.date, close: historicalPrices.close, adj: historicalPrices.adjustedClose })
              .from(historicalPrices)
              .where(and(inArray(historicalPrices.ticker, allTickers), gte(historicalPrices.date, historyFrom)))
              .orderBy(asc(historicalPrices.date))
          : [];
        const priceMapByTicker: Record<string, Record<string, number>> = {};
        for (const r of priceRows as any[]) {
          const v = parseFloat((r.adj ?? r.close) as any);
          if (!Number.isFinite(v) || v <= 0) continue;
          const d = String(r.date).slice(0, 10);
          (priceMapByTicker[r.ticker] ||= {})[d] = v;
        }
        const allDates = Array.from(new Set((priceRows as any[]).map((r) => String(r.date).slice(0, 10)))).sort();
        const sampleInterval = Math.max(1, Math.floor(allDates.length / HISTORY_MAX_POINTS));
        const sampledDates = allDates.filter((_, i) => i % sampleInterval === 0 || i === allDates.length - 1);
        const historyStart = allDates[0] ?? historyFrom;

        // CHF-Preiskarten je Ticker (per-Datum-FX) — dieselbe Methodik wie der
        // Performance-Chart in portfoliosRouter (kein 1:1-Fallback, R-10).
        const chfPriceMapByTicker: Record<string, Record<string, number>> = {};
        for (const ticker of Object.keys(priceMapByTicker)) {
          const currency = (stockByTicker.get(ticker) as any)?.currency || "CHF";
          chfPriceMapByTicker[ticker] = await toChfPriceMap(priceMapByTicker[ticker], currency, getFxRate);
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

              // Calculate holdings (D-01: unified replay; CHF-Kostenbasis aus
              // totalAmountCHF, moving average with clamped oversell)
              const holdings = buildHoldings(transactions);

              // FIN-2 (Audit 2026-07): Bewertung in CHF — vorher wurden Kurse in
              // Lokalwährung roh summiert (USD + CHF 1:1) und wichen damit
              // systematisch von der CHF-korrekten Detailseite ab.
              for (const [ticker, holding] of holdings.entries()) {
                if (holding.shares <= 0) continue;
                const stock: any = stockByTicker.get(ticker);
                const currentPrice = stock?.currentPrice ? parseFloat(stock.currentPrice) : 0;
                const priceCHF = currentPrice > 0
                  ? await convertToCHF(currentPrice, stock?.currency || "CHF", todayStr)
                  : 0;
                currentValue += holding.shares * priceCHF;
                totalInvested += holding.totalCostChf;
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
            stocks.forEach((stock: any) => {
              const dbStock: any = stockByTicker.get(stock.ticker);
              const sector = dbStock?.sector || 'Other';
              const weight = parseFloat(stock.weight || stock.portfolioWeight || '0');
              sectorAllocation[sector] = (sectorAllocation[sector] || 0) + weight;
            });

            // FIN-2: ECHTE Verlaufskurve — gewichtete CHF-Renditeserie über 90 Tage
            // (identische Methodik wie der Performance-Chart der Detailseite) statt
            // der früheren fabrizierten ×0.7/×0.85-Punkte.
            const seriesInputs: WeightedReturnInput[] = stocks
              .filter((s: any) => s.ticker && s.ticker !== 'CASH')
              .map((s: any) => ({
                ticker: s.ticker,
                weight: parseFloat(s.weight || s.portfolioWeight || '0') || 0,
                prices: chfPriceMapByTicker[s.ticker] || {},
              }))
              .filter((inp: WeightedReturnInput) => Object.keys(inp.prices).length > 0);
            const history = seriesInputs.length > 0
              ? computeWeightedReturnSeries(seriesInputs, sampledDates, historyStart)
                  .map((p) => ({ date: p.date, performance: Math.round(p.portfolio * 100) / 100 }))
              : [];

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
              history,
            };
          })
        );

        const performanceHistory = comparisonResults.map((p) => ({
          id: p.id,
          name: p.name,
          history: p.history,
        }));

        return {
          portfolios: comparisonResults.map(({ history: _h, ...rest }) => rest),
          performanceHistory,
        };
      }),
});
