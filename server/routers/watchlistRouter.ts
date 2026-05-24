import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { watchlistStocks } from "../../drizzle/schema";
import { eq, like, or, and, desc, asc, sql, count } from "drizzle-orm";
import YahooFinanceClass from "yahoo-finance2";

const yahooFinance: any = new (YahooFinanceClass as any)();

// Normalize ticker for Yahoo Finance (remove .US suffix)
function normalizeTicker(ticker: string): string {
  if (ticker.endsWith(".US")) return ticker.slice(0, -3);
  return ticker;
}

export const watchlistRouter = router({
  // Get all watchlist stocks with optional filters
  list: protectedProcedure
    .input(z.object({
      source: z.enum(["manual", "ai_recommended", "all"]).optional().default("all"),
      category: z.string().optional(),
      sector: z.string().optional(),
      signalType: z.enum(["buy", "sell", "hold", "all"]).optional().default("all"),
      search: z.string().optional(),
      sortBy: z.enum(["ticker", "companyName", "signalScore", "addedAt", "peRatio", "dividendYield"]).optional().default("addedAt"),
      sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
      limit: z.number().min(1).max(200).optional().default(200),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const conditions: any[] = [];

      if (input.source && input.source !== "all") {
        conditions.push(eq(watchlistStocks.source, input.source as "manual" | "ai_recommended"));
      }
      if (input.category) {
        conditions.push(eq(watchlistStocks.category, input.category));
      }
      if (input.sector) {
        conditions.push(eq(watchlistStocks.sector, input.sector));
      }
      if (input.signalType && input.signalType !== "all") {
        conditions.push(eq(watchlistStocks.signalType, input.signalType as "buy" | "sell" | "hold"));
      }
      if (input.search) {
        conditions.push(
          or(
            like(watchlistStocks.ticker, `%${input.search}%`),
            like(watchlistStocks.companyName, `%${input.search}%`)
          )
        );
      }

      const orderCol = input.sortBy === "ticker" ? watchlistStocks.ticker
        : input.sortBy === "companyName" ? watchlistStocks.companyName
        : input.sortBy === "signalScore" ? watchlistStocks.signalScore
        : input.sortBy === "peRatio" ? watchlistStocks.peRatio
        : input.sortBy === "dividendYield" ? watchlistStocks.dividendYield
        : watchlistStocks.addedAt;

      const orderFn = input.sortOrder === "asc" ? asc : desc;

      const query = conditions.length > 0
        ? db.select().from(watchlistStocks).where(and(...conditions)).orderBy(orderFn(orderCol)).limit(input.limit)
        : db.select().from(watchlistStocks).orderBy(orderFn(orderCol)).limit(input.limit);

      const results = await query;
      const totalCount = await db.select({ count: count() }).from(watchlistStocks);

      return {
        stocks: results,
        total: totalCount[0]?.count || 0,
        maxAllowed: 200,
      };
    }),

  // Get watchlist stats
  stats: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const total = await db.select({ count: count() }).from(watchlistStocks);
    const manual = await db.select({ count: count() }).from(watchlistStocks).where(eq(watchlistStocks.source, "manual"));
    const aiRecommended = await db.select({ count: count() }).from(watchlistStocks).where(eq(watchlistStocks.source, "ai_recommended"));
    const buySignals = await db.select({ count: count() }).from(watchlistStocks).where(eq(watchlistStocks.signalType, "buy"));
    const sellSignals = await db.select({ count: count() }).from(watchlistStocks).where(eq(watchlistStocks.signalType, "sell"));

    return {
      total: total[0]?.count || 0,
      manual: manual[0]?.count || 0,
      aiRecommended: aiRecommended[0]?.count || 0,
      buySignals: buySignals[0]?.count || 0,
      sellSignals: sellSignals[0]?.count || 0,
      maxAllowed: 200,
    };
  }),

  // Add a stock to watchlist (manual)
  add: protectedProcedure
    .input(z.object({
      ticker: z.string().min(1),
      companyName: z.string().min(1),
      sector: z.string().optional(),
      industry: z.string().optional(),
      category: z.string().optional(),
      country: z.string().optional(),
      currency: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Check max 200 limit
      const currentCount = await db.select({ count: count() }).from(watchlistStocks);
      if ((currentCount[0]?.count || 0) >= 200) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Maximale Anzahl von 200 Titeln erreicht" });
      }

      // Check if ticker already exists
      const existing = await db.select().from(watchlistStocks).where(eq(watchlistStocks.ticker, input.ticker)).limit(1);
      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: `${input.ticker} ist bereits in der Watchlist` });
      }

      // Fetch live metrics from Yahoo Finance
      let metrics: any = {};
      try {
        const quote: any = await yahooFinance.quoteSummary(input.ticker, { modules: ["price", "summaryDetail", "defaultKeyStatistics"] });
        const price = quote.price;
        const summary = quote.summaryDetail;
        const keyStats = quote.defaultKeyStatistics;

        metrics = {
          currentPrice: price?.regularMarketPrice?.toString(),
          marketCap: price?.marketCap?.toString(),
          currency: price?.currency,
          peRatio: summary?.trailingPE?.toString() || keyStats?.trailingEps ? undefined : undefined,
          pegRatio: keyStats?.pegRatio?.toString(),
          dividendYield: summary?.dividendYield ? (summary.dividendYield * 100).toString() : undefined,
          beta: summary?.beta?.toString(),
          week52High: summary?.fiftyTwoWeekHigh?.toString(),
          week52Low: summary?.fiftyTwoWeekLow?.toString(),
        };
        // Get PE from trailingPE
        if (summary?.trailingPE) {
          metrics.peRatio = summary.trailingPE.toString();
        }
      } catch (err) {
        console.warn(`[Watchlist] Failed to fetch metrics for ${input.ticker}:`, err);
      }

      await db.insert(watchlistStocks).values({
        ticker: input.ticker,
        companyName: input.companyName,
        sector: input.sector || null,
        industry: input.industry || null,
        category: input.category || null,
        country: input.country || null,
        currency: input.currency || metrics.currency || null,
        notes: input.notes || null,
        source: "manual",
        currentPrice: metrics.currentPrice || null,
        marketCap: metrics.marketCap || null,
        peRatio: metrics.peRatio || null,
        pegRatio: metrics.pegRatio || null,
        dividendYield: metrics.dividendYield || null,
        beta: metrics.beta || null,
        week52High: metrics.week52High || null,
        week52Low: metrics.week52Low || null,
        lastMetricsUpdate: new Date(),
      });

      return { success: true, message: `${input.ticker} zur Watchlist hinzugefügt` };
    }),

  // Remove a stock from watchlist
  remove: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await db.delete(watchlistStocks).where(eq(watchlistStocks.id, input.id));
      return { success: true };
    }),

  // Update a watchlist stock
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      category: z.string().optional(),
      sector: z.string().optional(),
      notes: z.string().optional(),
      isActive: z.number().min(0).max(1).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const updateData: any = {};
      if (input.category !== undefined) updateData.category = input.category;
      if (input.sector !== undefined) updateData.sector = input.sector;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      await db.update(watchlistStocks).set(updateData).where(eq(watchlistStocks.id, input.id));
      return { success: true };
    }),

  // Refresh metrics for all watchlist stocks (or specific one)
  refreshMetrics: protectedProcedure
    .input(z.object({ tickerId: z.number().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      let stocksToRefresh;
      if (input?.tickerId) {
        stocksToRefresh = await db.select().from(watchlistStocks).where(eq(watchlistStocks.id, input.tickerId));
      } else {
        stocksToRefresh = await db.select().from(watchlistStocks);
      }

      let updated = 0;
      let failed = 0;

      for (const stock of stocksToRefresh) {
        try {
          const normalizedTicker = normalizeTicker(stock.ticker);
          const quote: any = await yahooFinance.quoteSummary(normalizedTicker, { modules: ["price", "summaryDetail", "defaultKeyStatistics"] });
          const price = quote.price;
          const summary = quote.summaryDetail;
          const keyStats = quote.defaultKeyStatistics;

          await db.update(watchlistStocks).set({
            currentPrice: price?.regularMarketPrice?.toString() || stock.currentPrice,
            marketCap: price?.marketCap?.toString() || stock.marketCap,
            currency: price?.currency || stock.currency,
            peRatio: summary?.trailingPE?.toString() || stock.peRatio,
            pegRatio: keyStats?.pegRatio?.toString() || stock.pegRatio,
            dividendYield: summary?.dividendYield ? (summary.dividendYield * 100).toString() : stock.dividendYield,
            beta: summary?.beta?.toString() || stock.beta,
            week52High: summary?.fiftyTwoWeekHigh?.toString() || stock.week52High,
            week52Low: summary?.fiftyTwoWeekLow?.toString() || stock.week52Low,
            lastMetricsUpdate: new Date(),
          }).where(eq(watchlistStocks.id, stock.id));
          updated++;
        } catch (err) {
          console.warn(`[Watchlist] Refresh failed for ${stock.ticker}:`, err);
          failed++;
        }
        // Rate limiting
        await new Promise(r => setTimeout(r, 300));
      }

      return { updated, failed, total: stocksToRefresh.length };
    }),

  // AI-powered stock recommendations based on good signals
  generateRecommendations: protectedProcedure
    .input(z.object({
      maxNew: z.number().min(1).max(50).optional().default(10),
      criteria: z.enum(["value", "growth", "dividend", "momentum", "balanced"]).optional().default("balanced"),
      currency: z.enum(["CHF", "EUR", "USD"]).optional(),
    }).optional())
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Check how many slots are available
      const currentCount = await db.select({ count: count() }).from(watchlistStocks);
      const available = 200 - (currentCount[0]?.count || 0);
      const maxNew = Math.min(input?.maxNew || 10, available);

      if (maxNew <= 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Watchlist ist voll (200 Titel Maximum)" });
      }

      // Get existing tickers to avoid duplicates
      const existing = await db.select({ ticker: watchlistStocks.ticker }).from(watchlistStocks);
      const existingTickers = new Set(existing.map(e => e.ticker));

      // Define candidate pools based on criteria
      const candidatePools: Record<string, string[]> = {
        value: [
          "BRK-B", "JNJ", "PG", "KO", "PEP", "WMT", "UNH", "JPM", "V", "MA",
          "ABBV", "MRK", "LLY", "BMY", "AMGN", "MDT", "HON", "MMM", "CAT", "DE",
          "TXN", "INTC", "CSCO", "IBM", "ORCL", "VZ", "T", "CMCSA", "DIS", "NKE"
        ],
        growth: [
          "NVDA", "MSFT", "AAPL", "GOOGL", "AMZN", "META", "TSLA", "AMD", "AVGO", "CRM",
          "NOW", "ADBE", "SHOP", "SQ", "SNOW", "PLTR", "NET", "DDOG", "ZS", "CRWD",
          "PANW", "FTNT", "MELI", "SE", "UBER", "ABNB", "COIN", "RBLX", "U", "TTD"
        ],
        dividend: [
          "O", "SCHD", "VYM", "JEPI", "NOBL", "T", "VZ", "MO", "PM", "BTI",
          "ENB", "EPD", "MAIN", "STAG", "NNN", "WPC", "ADC", "STOR", "SPG", "AMT",
          "NESN.SW", "NOVN.SW", "ROG.SW", "ZURN.SW", "SCMN.SW", "SREN.SW", "ABBN.SW", "GIVN.SW", "LONN.SW", "GEBN.SW"
        ],
        momentum: [
          "NVDA", "META", "AVGO", "LLY", "GE", "ORCL", "NOW", "ISRG", "PANW", "ANET",
          "VST", "CEG", "TRGP", "HWM", "DECK", "APP", "AXON", "GDDY", "FI", "CTAS"
        ],
        balanced: [
          "MSFT", "AAPL", "GOOGL", "AMZN", "NVDA", "META", "JNJ", "UNH", "V", "PG",
          "HD", "MRK", "ABBV", "LLY", "AVGO", "JPM", "MA", "COST", "NESN.SW", "NOVN.SW",
          "ROG.SW", "ASML", "LVMH.PA", "SAP.DE", "SIE.DE", "MC.PA", "OR.PA", "AIR.PA", "BN.PA", "DTE.DE"
        ],
      };

      const criteria = input?.criteria || "balanced";
      const requestedCurrency = input?.currency;
      let candidates = candidatePools[criteria] || candidatePools.balanced;

      // Filter by currency/exchange if specified
      if (requestedCurrency) {
        const currencyExchangeMap: Record<string, (t: string) => boolean> = {
          CHF: (t) => t.endsWith(".SW"),
          EUR: (t) => t.endsWith(".PA") || t.endsWith(".DE") || t.endsWith(".AS") || t.endsWith(".MI"),
          USD: (t) => !t.includes("."),
        };
        const filter = currencyExchangeMap[requestedCurrency];
        if (filter) {
          const filtered = candidates.filter(filter);
          // If we have enough filtered candidates, use them; otherwise expand from all pools
          if (filtered.length >= 3) {
            candidates = filtered;
          } else {
            // Expand: search all pools for matching currency
            const allCandidates = Object.values(candidatePools).flat();
            candidates = [...new Set(allCandidates.filter(filter))];
          }
        }
      }

      const newCandidates = candidates.filter(t => !existingTickers.has(t));

      const added: string[] = [];
      const failed: string[] = [];

      for (const ticker of newCandidates.slice(0, maxNew)) {
        try {
          const quote: any = await yahooFinance.quoteSummary(ticker, { modules: ["price", "summaryDetail", "defaultKeyStatistics", "assetProfile"] });
          const price = quote.price;
          const summary = quote.summaryDetail;
          const keyStats = quote.defaultKeyStatistics;
          const profile = quote.assetProfile;

          // Calculate a simple signal score
          let signalScore = 50;
          let reasons: string[] = [];

          // P/E scoring
          const pe = summary?.trailingPE;
          if (pe && pe < 15) { signalScore += 10; reasons.push(`Niedriges P/E (${pe.toFixed(1)})`); }
          else if (pe && pe < 25) { signalScore += 5; reasons.push(`Moderates P/E (${pe.toFixed(1)})`); }
          else if (pe && pe > 40) { signalScore -= 5; reasons.push(`Hohes P/E (${pe.toFixed(1)})`); }

          // Dividend scoring
          const divYield = summary?.dividendYield;
          if (divYield && divYield > 0.03) { signalScore += 10; reasons.push(`Hohe Dividende (${(divYield * 100).toFixed(1)}%)`); }
          else if (divYield && divYield > 0.015) { signalScore += 5; reasons.push(`Moderate Dividende (${(divYield * 100).toFixed(1)}%)`); }

          // 52W position scoring
          const high = summary?.fiftyTwoWeekHigh;
          const low = summary?.fiftyTwoWeekLow;
          const current = price?.regularMarketPrice;
          if (high && low && current && high !== low) {
            const position = (current - low) / (high - low);
            if (position < 0.3) { signalScore += 10; reasons.push("Nahe 52W-Tief (Kaufgelegenheit)"); }
            else if (position > 0.9) { signalScore -= 5; reasons.push("Nahe 52W-Hoch"); }
          }

          // PEG scoring
          const peg = keyStats?.pegRatio;
          if (peg && peg < 1) { signalScore += 10; reasons.push(`PEG < 1 (${peg.toFixed(2)})`); }
          else if (peg && peg < 1.5) { signalScore += 5; reasons.push(`PEG moderat (${peg.toFixed(2)})`); }

          signalScore = Math.max(0, Math.min(100, signalScore));
          const signalType = signalScore >= 65 ? "buy" : signalScore <= 35 ? "sell" : "hold";

          await db.insert(watchlistStocks).values({
            ticker,
            companyName: price?.longName || price?.shortName || ticker,
            sector: profile?.sector || null,
            industry: profile?.industry || null,
            category: criteria === "dividend" ? "Dividendenaktien" : criteria === "growth" ? "Wachstumsaktien" : criteria === "value" ? "Value" : "Balanced",
            country: profile?.country || null,
            currency: price?.currency || null,
            marketCap: price?.marketCap?.toString() || null,
            source: "ai_recommended",
            aiReason: reasons.join("; "),
            currentPrice: current?.toString() || null,
            peRatio: pe?.toString() || null,
            pegRatio: peg?.toString() || null,
            dividendYield: divYield ? (divYield * 100).toString() : null,
            beta: summary?.beta?.toString() || null,
            week52High: high?.toString() || null,
            week52Low: low?.toString() || null,
            signalScore,
            signalType,
            lastMetricsUpdate: new Date(),
          });
          added.push(ticker);
        } catch (err) {
          console.warn(`[Watchlist AI] Failed to add ${ticker}:`, err);
          failed.push(ticker);
        }
        // Rate limiting
        await new Promise(r => setTimeout(r, 500));
      }

      return {
        added,
        failed,
        criteria,
        message: `${added.length} neue Titel als KI-Empfehlung hinzugefügt`,
      };
    }),

  // Get unique categories and sectors for filter dropdowns
  getFilters: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const categories = await db.selectDistinct({ category: watchlistStocks.category }).from(watchlistStocks).where(sql`${watchlistStocks.category} IS NOT NULL`);
    const sectors = await db.selectDistinct({ sector: watchlistStocks.sector }).from(watchlistStocks).where(sql`${watchlistStocks.sector} IS NOT NULL`);

    return {
      categories: categories.map(c => c.category).filter(Boolean) as string[],
      sectors: sectors.map(s => s.sector).filter(Boolean) as string[],
    };
  }),

  // Public endpoint: get watchlist stocks for portfolio creation (non-admin users)
  getUniverse: protectedProcedure
    .input(z.object({
      category: z.string().optional(),
      sector: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(50).optional().default(50),
    }))
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const conditions: any[] = [eq(watchlistStocks.isActive, 1)];

      if (input.category) conditions.push(eq(watchlistStocks.category, input.category));
      if (input.sector) conditions.push(eq(watchlistStocks.sector, input.sector));
      if (input.search) {
        conditions.push(
          or(
            like(watchlistStocks.ticker, `%${input.search}%`),
            like(watchlistStocks.companyName, `%${input.search}%`)
          )
        );
      }

      const results = await db.select({
        ticker: watchlistStocks.ticker,
        companyName: watchlistStocks.companyName,
        sector: watchlistStocks.sector,
        category: watchlistStocks.category,
        currency: watchlistStocks.currency,
        currentPrice: watchlistStocks.currentPrice,
        dividendYield: watchlistStocks.dividendYield,
        peRatio: watchlistStocks.peRatio,
        signalScore: watchlistStocks.signalScore,
        signalType: watchlistStocks.signalType,
      }).from(watchlistStocks)
        .where(and(...conditions))
        .orderBy(desc(watchlistStocks.signalScore))
        .limit(input.limit);

      return results;
    }),
});
