import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { watchlistStocks } from "../../drizzle/schema";
import { eq, like, or, and, desc, count } from "drizzle-orm";
import YahooFinanceClass from "yahoo-finance2";

const yahooFinance: any = new (YahooFinanceClass as any)();

// Known Swiss tickers that need .SW suffix on Yahoo Finance
const SWISS_TICKERS = new Set([
  "ADEN", "ABBN", "NOVN", "NESN", "ROG", "UBSG", "ZURN", "SREN", "SLHN",
  "GEBN", "GIVN", "HOLN", "SIKA", "LOGN", "KNIN", "BAER", "SCMN", "HELN",
  "LISN", "STMN", "VONN", "CMBN", "SGKN", "SQN", "AUTN", "FHZN", "GF",
  "CSL", "BKW", "GALE", "GALD", "MESA", "MONC", "SOFI"
]);

function resolveYahooTicker(ticker: string): string {
  // If already has exchange suffix, normalize for Yahoo
  if (ticker.endsWith(".US")) return ticker.slice(0, -3);
  if (ticker.endsWith(".SW") || ticker.endsWith(".PA") || ticker.endsWith(".DE") || ticker.endsWith(".MI") || ticker.endsWith(".L")) return ticker;
  // Check if it's a known Swiss ticker
  if (SWISS_TICKERS.has(ticker.toUpperCase())) return `${ticker}.SW`;
  return ticker;
}

export const investRouter = router({
  // Search for stocks by name or ticker (Yahoo Finance live search)
  search: protectedProcedure
    .input(z.object({
      query: z.string().min(1).max(100),
    }))
    .query(async ({ input }) => {
      try {
        const results: any = await yahooFinance.search(input.query, { quotesCount: 15, newsCount: 0 }, { validateResult: false });
        
        const quotes = (results.quotes || [])
          .filter((q: any) => q.quoteType === "EQUITY" || q.quoteType === "ETF")
          .slice(0, 15)
          .map((q: any) => ({
            ticker: q.symbol,
            companyName: q.longname || q.shortname || q.symbol,
            exchange: q.exchange,
            quoteType: q.quoteType,
            sector: q.sector || null,
            industry: q.industry || null,
          }));

        return { results: quotes };
      } catch (err) {
        console.error("[Invest Search] Error:", err);
        return { results: [] };
      }
    }),

  // Get detailed stock analysis for a single ticker
  stockDetail: protectedProcedure
    .input(z.object({
      ticker: z.string().min(1),
    }))
    .query(async ({ input }) => {
      try {
        const resolvedTicker = resolveYahooTicker(input.ticker);
        // Fetch comprehensive data
        const [quoteSummary, chartData] = await Promise.all([
          (yahooFinance.quoteSummary(resolvedTicker, {
            modules: ["price", "summaryDetail", "summaryProfile", "defaultKeyStatistics", "financialData", "earningsHistory", "recommendationTrend"] as any,
          }) as any).catch(() => null),
          (yahooFinance.chart(resolvedTicker, {
            period1: new Date(Date.now() - 10 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            period2: new Date().toISOString().split("T")[0],
            interval: "1d" as any,
          }) as any).catch(() => null),
        ]);

        if (!quoteSummary) {
          throw new TRPCError({ code: "NOT_FOUND", message: `Keine Daten für ${input.ticker} gefunden` });
        }

        const price = quoteSummary.price || {};
        const summary = quoteSummary.summaryDetail || {};
        const profile = quoteSummary.summaryProfile || {};
        const keyStats = quoteSummary.defaultKeyStatistics || {};
        const financialData = quoteSummary.financialData || {};
        const recommendations = quoteSummary.recommendationTrend?.trend || [];

        // Process chart data
        const priceHistory: { date: string; close: number; volume: number }[] = [];
        if (chartData?.quotes) {
          for (const q of chartData.quotes) {
            if (q.date && q.close) {
              priceHistory.push({
                date: new Date(q.date).toISOString().split("T")[0],
                close: q.close,
                volume: q.volume || 0,
              });
            }
          }
        }

        // Calculate RSI (14)
        let rsi14: number | null = null;
        if (priceHistory.length >= 15) {
          const closes = priceHistory.map(p => p.close);
          const gains: number[] = [];
          const losses: number[] = [];
          for (let i = 1; i < closes.length; i++) {
            const diff = closes[i] - closes[i - 1];
            gains.push(diff > 0 ? diff : 0);
            losses.push(diff < 0 ? -diff : 0);
          }
          const period = 14;
          let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
          let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
          for (let i = period; i < gains.length; i++) {
            avgGain = (avgGain * (period - 1) + gains[i]) / period;
            avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
          }
          if (avgLoss === 0) rsi14 = 100;
          else {
            const rs = avgGain / avgLoss;
            rsi14 = 100 - (100 / (1 + rs));
          }
        }

        // Build recommendation
        let recommendation: { signal: string; strength: string; reasons: string[] } = {
          signal: "hold",
          strength: "neutral",
          reasons: [],
        };

        const pe = summary.trailingPE;
        const peg = keyStats.pegRatio;
        const divYield = summary.dividendYield;
        const currentPrice = price.regularMarketPrice;
        const high52 = summary.fiftyTwoWeekHigh;
        const low52 = summary.fiftyTwoWeekLow;

        let score = 50;
        if (pe && pe < 15) { score += 10; recommendation.reasons.push(`Niedriges P/E (${pe.toFixed(1)})`); }
        else if (pe && pe > 35) { score -= 10; recommendation.reasons.push(`Hohes P/E (${pe.toFixed(1)})`); }
        if (peg && peg < 1) { score += 10; recommendation.reasons.push(`PEG < 1 (${peg.toFixed(2)})`); }
        if (divYield && divYield > 0.03) { score += 8; recommendation.reasons.push(`Hohe Dividende (${(divYield * 100).toFixed(1)}%)`); }
        if (rsi14 !== null) {
          if (rsi14 < 30) { score += 10; recommendation.reasons.push(`RSI überverkauft (${rsi14.toFixed(0)})`); }
          else if (rsi14 > 70) { score -= 10; recommendation.reasons.push(`RSI überkauft (${rsi14.toFixed(0)})`); }
        }
        if (high52 && low52 && currentPrice) {
          const pos = (currentPrice - low52) / (high52 - low52);
          if (pos < 0.3) { score += 8; recommendation.reasons.push("Nahe 52W-Tief"); }
          else if (pos > 0.9) { score -= 5; recommendation.reasons.push("Nahe 52W-Hoch"); }
        }

        recommendation.signal = score >= 65 ? "buy" : score <= 35 ? "sell" : "hold";
        recommendation.strength = score >= 75 ? "stark" : score >= 60 ? "moderat" : score <= 25 ? "stark" : score <= 40 ? "moderat" : "neutral";

        // Get analyst consensus
        let analystConsensus: { buy: number; hold: number; sell: number; targetPrice: number | null } = {
          buy: 0, hold: 0, sell: 0, targetPrice: null,
        };
        if (recommendations.length > 0) {
          const latest = recommendations[0];
          analystConsensus = {
            buy: (latest.strongBuy || 0) + (latest.buy || 0),
            hold: latest.hold || 0,
            sell: (latest.sell || 0) + (latest.strongSell || 0),
            targetPrice: financialData.targetMeanPrice || null,
          };
        }

        return {
          ticker: input.ticker,
          companyName: price.longName || price.shortName || input.ticker,
          exchange: price.exchangeName || null,
          currency: price.currency || null,
          sector: profile.sector || null,
          industry: profile.industry || null,
          country: profile.country || null,
          website: profile.website || null,
          description: profile.longBusinessSummary || null,
          employees: profile.fullTimeEmployees || null,

          // Price data
          currentPrice: currentPrice || null,
          previousClose: summary.previousClose || null,
          open: summary.open || null,
          dayHigh: summary.dayHigh || null,
          dayLow: summary.dayLow || null,
          volume: summary.volume || null,
          avgVolume: summary.averageVolume || null,
          marketCap: price.marketCap || null,

          // Key metrics
          peRatio: pe || null,
          pegRatio: peg || null,
          eps: keyStats.trailingEps || null,
          dividendYield: divYield ? divYield * 100 : null,
          dividendRate: summary.dividendRate || null,
          beta: summary.beta || null,
          week52High: high52 || null,
          week52Low: low52 || null,
          fiftyDayAvg: summary.fiftyDayAverage || null,
          twoHundredDayAvg: summary.twoHundredDayAverage || null,
          priceToBook: keyStats.priceToBook || null,
          debtToEquity: financialData.debtToEquity || null,
          returnOnEquity: financialData.returnOnEquity ? financialData.returnOnEquity * 100 : null,
          revenueGrowth: financialData.revenueGrowth ? financialData.revenueGrowth * 100 : null,
          profitMargin: financialData.profitMargins ? financialData.profitMargins * 100 : null,

          // Technical
          rsi14,

          // Chart data (last 365 days)
          priceHistory,

          // Recommendation
          recommendation,
          analystConsensus,
          signalScore: score,
        };
      } catch (err: any) {
        if (err.code === "NOT_FOUND") throw err;
        console.error(`[Invest] stockDetail error for ${input.ticker}:`, err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Fehler beim Laden der Daten für ${input.ticker}` });
      }
    }),

  // Get stocks by filter (from watchlist universe)
  filter: protectedProcedure
    .input(z.object({
      category: z.string().optional(),
      sector: z.string().optional(),
      minDividendYield: z.number().optional(),
      maxPeRatio: z.number().optional(),
      signalType: z.enum(["buy", "sell", "hold"]).optional(),
      limit: z.number().min(1).max(50).optional().default(50),
    }))
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const conditions: any[] = [eq(watchlistStocks.isActive, 1)];

      if (input.category) conditions.push(eq(watchlistStocks.category, input.category));
      if (input.sector) conditions.push(eq(watchlistStocks.sector, input.sector));
      if (input.signalType) conditions.push(eq(watchlistStocks.signalType, input.signalType));

      let results = await db.select().from(watchlistStocks)
        .where(and(...conditions))
        .orderBy(desc(watchlistStocks.signalScore))
        .limit(input.limit);

      // Apply numeric filters in-memory (since they're stored as varchar)
      if (input.minDividendYield !== undefined) {
        results = results.filter(r => {
          const dy = parseFloat(r.dividendYield || "0");
          return dy >= (input.minDividendYield || 0);
        });
      }
      if (input.maxPeRatio !== undefined) {
        results = results.filter(r => {
          const pe = parseFloat(r.peRatio || "999");
          return pe <= (input.maxPeRatio || 999);
        });
      }

      return { results, total: results.length };
    }),

  // Get available filter options
  filterOptions: protectedProcedure.query(async () => {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const categories = await db.selectDistinct({ category: watchlistStocks.category })
      .from(watchlistStocks)
      .where(and(eq(watchlistStocks.isActive, 1)));
    const sectors = await db.selectDistinct({ sector: watchlistStocks.sector })
      .from(watchlistStocks)
      .where(and(eq(watchlistStocks.isActive, 1)));

    return {
      categories: categories.map(c => c.category).filter(Boolean) as string[],
      sectors: sectors.map(s => s.sector).filter(Boolean) as string[],
    };
  }),

  // Get stock news from Yahoo Finance
  stockNews: protectedProcedure
    .input(z.object({ ticker: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        const resolvedTicker = resolveYahooTicker(input.ticker);
        const searchResult: any = await yahooFinance.search(resolvedTicker, { quotesCount: 0, newsCount: 10 }, { validateResult: false });
        const news = (searchResult.news || []).slice(0, 8).map((n: any) => ({
          title: n.title,
          link: n.link,
          publisher: n.publisher,
          publishedAt: n.providerPublishTime ? new Date(n.providerPublishTime * 1000).toISOString() : null,
          thumbnail: n.thumbnail?.resolutions?.[0]?.url || null,
        }));
        return { news };
      } catch (err) {
        console.error(`[Invest] News error for ${input.ticker}:`, err);
        return { news: [] };
      }
    }),
});
