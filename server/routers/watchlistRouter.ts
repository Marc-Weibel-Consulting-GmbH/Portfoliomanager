import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
// Universum-Merge Phase 2: die kuratierte Watchlist lebt jetzt in der vereinten
// `stocks`-Tabelle (Alias watchlistStocks minimiert die Umstellung). `curated()`
// grenzt auf listType != NULL ein — reine Portfolio-Stammdaten bleiben aussen vor.
import { stocks as watchlistStocks } from "../../drizzle/schema";
import { getWikifolioPortfolio, getWikifolioDetails, clearWikifolioSession, searchWikifolios, getWikifolioTrades, getWikifolioKeyFigures } from '../lib/wikifolioService';
import { resolveIsinToTicker, isLikelyIsin } from '../lib/isinResolver';
import { getUniverseListTypeFilter } from '../lib/watchlistUniverse';
import { curated } from '../lib/stockUniverse';
import { eq, like, or, and, desc, asc, sql, count } from "drizzle-orm";
import YahooFinanceClass from "yahoo-finance2";
import { getActiveWeights, type WeightConfig } from "../analytics/optimizerWorker";
import { fetchEODHDFundamentals } from '../_core/eodhdApi';
import { fetchDividendYieldWithFallback } from '../_core/dividendYieldHelper';

const yahooFinance: any = new (YahooFinanceClass as any)();

/**
 * Calculate signal score using the same logic as the central Signal-Engine.
 * This ensures Watchlist scores match what users see in "Signale & Scores".
 */
function calculateSignalScore(
  data: { peRatio: number | null; pegRatio: number | null; dividendYield: number; rsi14: number | null; priceVs52w: number },
  weights: WeightConfig
): { score: number; signalType: "buy" | "sell" | "hold" } {
  const WEIGHT_SCALE = 12;
  let score = 0;

  // P/E
  if (data.peRatio !== null && data.peRatio > 0) {
    const w = weights.pe * WEIGHT_SCALE;
    if (data.peRatio < 12) score += 3 * w;
    else if (data.peRatio < 18) score += 1 * w;
    else if (data.peRatio > 35) score -= 2 * w;
    else if (data.peRatio > 25) score -= 1 * w;
  }

  // PEG
  if (data.pegRatio !== null && data.pegRatio > 0) {
    const w = weights.peg * WEIGHT_SCALE;
    if (data.pegRatio < 0.8) score += 2 * w;
    else if (data.pegRatio < 1.2) score += 1 * w;
    else if (data.pegRatio > 2.5) score -= 2 * w;
    else if (data.pegRatio > 1.8) score -= 1 * w;
  }

  // Dividend
  {
    const w = weights.dividend * WEIGHT_SCALE;
    if (data.dividendYield > 5) score += 2 * w;
    else if (data.dividendYield > 3) score += 1 * w;
  }

  // 52-Week Range
  {
    const w = weights.week52 * WEIGHT_SCALE;
    if (data.priceVs52w < 0.2) score += 2 * w;
    else if (data.priceVs52w < 0.35) score += 1 * w;
    else if (data.priceVs52w > 0.95) score -= 1 * w;
  }

  // RSI
  if (data.rsi14 !== null) {
    const w = weights.rsi * WEIGHT_SCALE;
    if (data.rsi14 < 30) score += 2 * w;
    else if (data.rsi14 < 40) score += 1 * w;
    else if (data.rsi14 > 75) score -= 2 * w;
    else if (data.rsi14 > 65) score -= 1 * w;
  }

  // Normalize to 0-100 scale (score range is roughly -20 to +20)
  const normalizedScore = Math.max(0, Math.min(100, 50 + score * 2.5));
  const signalType = normalizedScore >= 65 ? "buy" : normalizedScore <= 35 ? "sell" : "hold";

  return { score: Math.round(normalizedScore), signalType };
}

// Normalize ticker for Yahoo Finance (remove .US suffix)
function normalizeTicker(ticker: string): string {
  if (ticker.endsWith(".US")) return ticker.slice(0, -3);
  return ticker;
}

export const watchlistRouter = router({
  // Get all watchlist stocks with optional filters
  list: protectedProcedure
    .input(z.object({
      source: z.enum(["manual", "ai_recommended", "wikifolio", "all"]).optional().default("all"),
      listType: z.enum(["empfehlung", "watchlist", "alle"]).optional().default("alle"),
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

      // Nur das kuratierte Universum (nicht die reinen Portfolio-Stammdaten).
      const conditions: any[] = [curated()];

      if (input.source && input.source !== "all") {
        conditions.push(eq(watchlistStocks.source, input.source as "manual" | "ai_recommended" | "wikifolio"));
      }
      if (input.listType && input.listType !== "alle") {
        conditions.push(eq(watchlistStocks.listType, input.listType));
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
        : watchlistStocks.createdAt; // stocks-Tabelle: createdAt statt addedAt

      const orderFn = input.sortOrder === "asc" ? asc : desc;

      const query = db.select().from(watchlistStocks).where(and(...conditions)).orderBy(orderFn(orderCol)).limit(input.limit);

      const results = await query;
      const totalCount = await db.select({ count: count() }).from(watchlistStocks).where(curated());

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

    const total = await db.select({ count: count() }).from(watchlistStocks).where(curated());
    const manual = await db.select({ count: count() }).from(watchlistStocks).where(and(curated(), eq(watchlistStocks.source, "manual")));
    const aiRecommended = await db.select({ count: count() }).from(watchlistStocks).where(and(curated(), eq(watchlistStocks.source, "ai_recommended")));
    const buySignals = await db.select({ count: count() }).from(watchlistStocks).where(and(curated(), eq(watchlistStocks.signalType, "buy")));
    const sellSignals = await db.select({ count: count() }).from(watchlistStocks).where(and(curated(), eq(watchlistStocks.signalType, "sell")));
    // F-13: counts per listType for the merged Empfehlungen/Watchlist view
    const empfehlung = await db.select({ count: count() }).from(watchlistStocks).where(eq(watchlistStocks.listType, "empfehlung"));
    const watchlistOnly = await db.select({ count: count() }).from(watchlistStocks).where(eq(watchlistStocks.listType, "watchlist"));

    return {
      total: total[0]?.count || 0,
      manual: manual[0]?.count || 0,
      aiRecommended: aiRecommended[0]?.count || 0,
      buySignals: buySignals[0]?.count || 0,
      sellSignals: sellSignals[0]?.count || 0,
      empfehlung: empfehlung[0]?.count || 0,
      watchlistOnly: watchlistOnly[0]?.count || 0,
      maxAllowed: 200,
    };
  }),

  // F-13: move a title between Empfehlungen and Watchlist
  setListType: adminProcedure
    .input(z.object({
      id: z.number(),
      listType: z.enum(["empfehlung", "watchlist"]),
    }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await db.update(watchlistStocks).set({ listType: input.listType }).where(eq(watchlistStocks.id, input.id));
      return { success: true };
    }),

  // F-13: one-click migration — mark all active titles as Empfehlung
  // Accepts optional signalType filter so the UI can restrict to buy/sell/hold signals
  markAllActiveAsEmpfehlung: adminProcedure
    .input(z.object({ signalType: z.enum(["buy", "sell", "hold"]).optional() }).optional())
    .mutation(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const conditions = [
        eq(watchlistStocks.isActive, 1),
        eq(watchlistStocks.listType, "watchlist"),
      ];
      if (input?.signalType) {
        conditions.push(eq(watchlistStocks.signalType, input.signalType as "buy" | "sell" | "hold"));
      }
      await db.update(watchlistStocks)
        .set({ listType: "empfehlung" })
        .where(and(...conditions));
      const empfehlung = await db.select({ count: count() }).from(watchlistStocks).where(eq(watchlistStocks.listType, "empfehlung"));
      return {
        success: true,
        empfehlungCount: empfehlung[0]?.count || 0,
        message: `Alle aktiven Titel als Empfehlung markiert (${empfehlung[0]?.count || 0} Empfehlungen)`,
      };
    }),

  /**
   * L-16: Alt-Watchlist-Zeilen bereinigen, die eine ISIN statt eines Yahoo-Tickers tragen
   * (Wikifolio-Importe vor dem F-15-ISIN-Fix). Jede ISIN wird per Yahoo-Suche in einen
   * Ticker aufgelöst und die Zeile umgeschrieben; existiert der Ziel-Ticker bereits, wird die
   * ISIN-Dublette gelöscht (ticker ist UNIQUE). Nicht auflösbare Zeilen bleiben zur manuellen
   * Prüfung bestehen und werden im Ergebnis gemeldet. Idempotent — mehrfach ausführbar.
   */
  cleanupIsinTickers: adminProcedure
    .mutation(async () => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const rows = await db.select({ id: watchlistStocks.id, ticker: watchlistStocks.ticker }).from(watchlistStocks).where(curated());
      const isinRows = rows.filter((r: any) => isLikelyIsin(r.ticker));

      let resolved = 0;
      let deduped = 0;
      const unresolved: Array<{ isin: string }> = [];

      for (const row of isinRows) {
        try {
          const ticker = await resolveIsinToTicker(
            (q: string) => yahooFinance.search(q, { quotesCount: 5, newsCount: 0 }, { validateResult: false }),
            row.ticker
          );
          if (!ticker) { unresolved.push({ isin: row.ticker }); continue; }

          const existing = await db.select({ id: watchlistStocks.id }).from(watchlistStocks)
            .where(eq(watchlistStocks.ticker, ticker)).limit(1);

          if (existing.length > 0) {
            // Ziel-Ticker existiert bereits → ISIN-Dublette entfernen
            await db.delete(watchlistStocks).where(eq(watchlistStocks.id, row.id));
            deduped++;
          } else {
            await db.update(watchlistStocks).set({ ticker }).where(eq(watchlistStocks.id, row.id));
            resolved++;
          }
        } catch (err: any) {
          unresolved.push({ isin: row.ticker });
        }
      }

      return {
        success: true,
        scanned: isinRows.length,
        resolved,
        deduped,
        unresolvedCount: unresolved.length,
        unresolved: unresolved.slice(0, 50),
        message: `${isinRows.length} ISIN-Zeilen geprüft: ${resolved} aufgelöst, ${deduped} Dubletten entfernt, ${unresolved.length} offen.`,
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

      // Check max 200 limit (nur kuratierte Titel zählen)
      const currentCount = await db.select({ count: count() }).from(watchlistStocks).where(curated());
      if ((currentCount[0]?.count || 0) >= 200) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Maximale Anzahl von 200 Titeln erreicht" });
      }

      // Existiert der Ticker bereits in der stocks-Tabelle?
      const existing = await db.select().from(watchlistStocks).where(eq(watchlistStocks.ticker, input.ticker)).limit(1);
      // Bereits im kuratierten Universum → Konflikt.
      if (existing.length > 0 && existing[0].listType != null) {
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

      const curationValues = {
        companyName: input.companyName,
        sector: input.sector || null,
        industry: input.industry || null,
        category: input.category || null,
        country: input.country || null,
        currency: input.currency || metrics.currency || null,
        notes: input.notes || null,
        source: "manual" as const,
        listType: "watchlist" as const, // neue Titel landen im Staging
        currentPrice: metrics.currentPrice || null,
        marketCap: metrics.marketCap || null,
        peRatio: metrics.peRatio || null,
        pegRatio: metrics.pegRatio || null,
        dividendYield: metrics.dividendYield || null,
        beta: metrics.beta || null,
        week52High: metrics.week52High || null,
        week52Low: metrics.week52Low || null,
        lastMetricsUpdate: new Date(),
      };

      if (existing.length > 0) {
        // Portfolio-Stammdatum (listType = NULL) existiert bereits → ins Universum aufnehmen.
        await db.update(watchlistStocks).set(curationValues).where(eq(watchlistStocks.id, existing[0].id));
      } else {
        await db.insert(watchlistStocks).values({ ticker: input.ticker, ...curationValues });
      }

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

      // Universum-Merge: NICHT löschen — die Zeile kann Portfolio-Stammdatum sein.
      // Stattdessen aus dem Universum entfernen (Kuratierung zurücksetzen).
      await db.update(watchlistStocks)
        .set({ listType: null, source: null })
        .where(eq(watchlistStocks.id, input.id));
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
        stocksToRefresh = await db.select().from(watchlistStocks).where(curated());
      }

      let updated = 0;
      let failed = 0;

      // Get active optimizer weights for consistent signal scoring
      const weights = await getActiveWeights();

      for (const stock of stocksToRefresh) {
        try {
          const normalizedTicker = normalizeTicker(stock.ticker);
          const quote: any = await yahooFinance.quoteSummary(normalizedTicker, { modules: ["price", "summaryDetail", "defaultKeyStatistics"] });
          const price = quote.price;
          const summary = quote.summaryDetail;
          const keyStats = quote.defaultKeyStatistics;

          const currentPrice = price?.regularMarketPrice || 0;
          const high52 = summary?.fiftyTwoWeekHigh || 0;
          const low52 = summary?.fiftyTwoWeekLow || 0;
          const range52 = high52 - low52;
          const priceVs52w = range52 > 0 ? (currentPrice - low52) / range52 : 0.5;
          const peRatio = summary?.trailingPE ?? null;
          const pegRatio = keyStats?.pegRatio ?? null;
          const dividendYield = summary?.dividendYield ? summary.dividendYield * 100 : 0;

          // Calculate RSI from recent chart data
          let rsi14: number | null = null;
          try {
            const chartEnd = new Date();
            const chartStart = new Date(chartEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
            const chartResult = await yahooFinance.chart(normalizedTicker, {
              period1: chartStart.toISOString().split("T")[0],
              period2: chartEnd.toISOString().split("T")[0],
              interval: "1d",
            }) as any;
            const closes = (chartResult.quotes || []).map((q: any) => q.close).filter((c: any) => c != null);
            if (closes.length >= 15) {
              // Simple RSI calculation
              let avgGain = 0, avgLoss = 0;
              for (let i = 1; i <= 14; i++) {
                const change = closes[i] - closes[i - 1];
                if (change > 0) avgGain += change; else avgLoss += Math.abs(change);
              }
              avgGain /= 14; avgLoss /= 14;
              const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
              rsi14 = 100 - 100 / (1 + rs);
            }
          } catch { /* RSI calculation failed, use null */ }

          // Calculate signal score using central engine weights
          const { score: signalScore, signalType } = calculateSignalScore(
            { peRatio, pegRatio, dividendYield, rsi14, priceVs52w },
            weights
          );

          await db.update(watchlistStocks).set({
            currentPrice: currentPrice?.toString() || stock.currentPrice,
            marketCap: price?.marketCap?.toString() || stock.marketCap,
            currency: price?.currency || stock.currency,
            peRatio: peRatio?.toString() || stock.peRatio,
            pegRatio: pegRatio?.toString() || stock.pegRatio,
            dividendYield: dividendYield > 0 ? dividendYield.toString() : stock.dividendYield,
            beta: summary?.beta?.toString() || stock.beta,
            week52High: high52?.toString() || stock.week52High,
            week52Low: low52?.toString() || stock.week52Low,
            signalScore,
            signalType,
            lastMetricsUpdate: new Date(),
          }).where(eq(watchlistStocks.id, stock.id));
          updated++;
        } catch (err) {
          console.warn(`[Watchlist] Refresh failed for ${stock.ticker}:`, err);
          failed++;
        }
        // Rate limiting
        await new Promise(r => setTimeout(r, 400));
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

      // Check how many slots are available (nur kuratierte Titel zählen)
      const currentCount = await db.select({ count: count() }).from(watchlistStocks).where(curated());
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

      // Get active optimizer weights for consistent scoring
      const weights = await getActiveWeights();

      for (const ticker of newCandidates.slice(0, maxNew)) {
        try {
          const quote: any = await yahooFinance.quoteSummary(ticker, { modules: ["price", "summaryDetail", "defaultKeyStatistics", "assetProfile"] });
          const price = quote.price;
          const summary = quote.summaryDetail;
          const keyStats = quote.defaultKeyStatistics;
          const profile = quote.assetProfile;

          const pe = summary?.trailingPE ?? null;
          const peg = keyStats?.pegRatio ?? null;
          const divYield = summary?.dividendYield ? summary.dividendYield * 100 : 0;
          const high = summary?.fiftyTwoWeekHigh;
          const low = summary?.fiftyTwoWeekLow;
          const current = price?.regularMarketPrice;
          const range52 = (high && low) ? high - low : 0;
          const priceVs52w = range52 > 0 && current ? (current - low) / range52 : 0.5;

          // Use central signal engine for consistent scoring
          const { score: signalScore, signalType } = calculateSignalScore(
            { peRatio: pe, pegRatio: peg, dividendYield: divYield, rsi14: null, priceVs52w },
            weights
          );

          const reasons: string[] = [];
          if (pe && pe < 15) reasons.push(`Niedriges P/E (${pe.toFixed(1)})`);
          if (peg && peg < 1) reasons.push(`PEG < 1 (${peg.toFixed(2)})`);
          if (divYield > 3) reasons.push(`Dividende ${divYield.toFixed(1)}%`);
          if (priceVs52w < 0.3) reasons.push("Nahe 52W-Tief");

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
            listType: "watchlist", // KI-Vorschläge landen im Staging
            aiReason: reasons.join("; "),
            currentPrice: current?.toString() || null,
            peRatio: pe?.toString() || null,
            pegRatio: peg?.toString() || null,
            dividendYield: divYield > 0 ? divYield.toString() : null,
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

    const categories = await db.selectDistinct({ category: watchlistStocks.category }).from(watchlistStocks).where(and(curated(), sql`${watchlistStocks.category} IS NOT NULL`));
    const sectors = await db.selectDistinct({ sector: watchlistStocks.sector }).from(watchlistStocks).where(and(curated(), sql`${watchlistStocks.sector} IS NOT NULL`));

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

      const conditions: any[] = [eq(watchlistStocks.isActive, 1), curated()];

      // F-13: universe = Empfehlungen (fallback to all active rows while none are marked yet)
      const universeType = await getUniverseListTypeFilter(db);
      if (universeType) conditions.push(eq(watchlistStocks.listType, universeType));

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

  // ─── Wikifolio Integration ───────────────────────────────────────────────

  /**
   * Fetch portfolio positions of a Wikifolio (e.g. wfglobalnt)
   */
  getWikifolioPortfolio: protectedProcedure
    .input(z.object({
      symbol: z.string().min(1).default('wfglobalnt'),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
      }
      try {
        const portfolio = await getWikifolioPortfolio(input.symbol);
        return { success: true, portfolio };
      } catch (err: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err?.message || 'Wikifolio-Daten konnten nicht abgerufen werden',
        });
      }
    }),

  /**
   * Fetch basic details of a Wikifolio
   */
  getWikifolioDetails: protectedProcedure
    .input(z.object({
      symbol: z.string().min(1).default('wfglobalnt'),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
      }
      try {
        const details = await getWikifolioDetails(input.symbol);
        return { success: true, details };
      } catch (err: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err?.message || 'Wikifolio-Details konnten nicht abgerufen werden',
        });
      }
    }),

  /**
   * Transaktionshistorie eines Wikifolios (welcher Titel wann gekauft/verkauft/
   * erhöht/reduziert). Wikifolio führt gewichtsbasiert — es gibt keine Stückzahlen;
   * wir zeigen Datum · Titel · Aktion · Gewicht. ISIN → Ticker wird DB-seitig
   * aufgelöst (stocks.isin, kein Yahoo/EODHD-Call), damit die Titel bei Bedarf
   * auf /aktien/:ticker verlinken.
   */
  getWikifolioTrades: protectedProcedure
    .input(z.object({
      symbol: z.string().min(1).default('wfglobalnt'),
      pageSize: z.number().min(1).max(200).default(100),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
      }
      try {
        const trades = await getWikifolioTrades(input.symbol, input.pageSize);

        // ISIN → eigenes Ticker-Universum aus bereits aufgelösten Wikifolio-Trades
        // (wikifolio_trades.resolvedTicker; kein externer Call, prod-sicher).
        const { getDb } = await import('../db');
        const { wikifolioTrades } = await import('../../drizzle/schema');
        const db = await getDb();
        const isinToTicker: Record<string, string> = {};
        if (db) {
          const isins = Array.from(new Set(trades.map(t => t.isin).filter((x): x is string => !!x)));
          if (isins.length > 0) {
            const { inArray, isNotNull, and: and2 } = await import('drizzle-orm');
            const rows = await db
              .select({ ticker: wikifolioTrades.resolvedTicker, isin: wikifolioTrades.isin })
              .from(wikifolioTrades)
              .where(and2(inArray(wikifolioTrades.isin, isins), isNotNull(wikifolioTrades.resolvedTicker)));
            rows.forEach((r: any) => { if (r.isin && r.ticker) isinToTicker[r.isin] = r.ticker; });
          }
        }

        // Aktion je Trade ableiten: chronologisch je ISIN ersten Kauf = «Kauf»,
        // spätere Käufe = «Erhöht»; Verkäufe = «Reduziert», letzter Verkauf ohne
        // späteren Kauf = «Verkauf» (Ausstieg). Ohne Post-Trade-Gewicht ist die
        // Teil-/Voll-Unterscheidung eine Näherung.
        const asc2 = [...trades].sort((a, b) =>
          String(a.executedAt ?? '').localeCompare(String(b.executedAt ?? '')));
        const lastEventIdxByIsin: Record<string, number> = {};
        asc2.forEach((t, i) => { if (t.isin) lastEventIdxByIsin[t.isin] = i; });
        const seen = new Set<string>();
        const withAction = asc2.map((t, i) => {
          let action: 'buy' | 'increase' | 'reduce' | 'sell' | 'other' = 'other';
          const key = t.isin ?? t.name ?? '';
          if (t.side === 'buy') {
            action = seen.has(key) ? 'increase' : 'buy';
            seen.add(key);
          } else if (t.side === 'sell') {
            action = (t.isin && lastEventIdxByIsin[t.isin] === i) ? 'sell' : 'reduce';
          }
          return {
            ...t,
            action,
            ticker: t.isin ? isinToTicker[t.isin] ?? null : null,
          };
        });

        // Neueste zuerst für die Anzeige
        withAction.reverse();
        return { success: true, trades: withAction };
      } catch (err: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err?.message || 'Wikifolio-Transaktionshistorie konnte nicht abgerufen werden',
        });
      }
    }),

  /**
   * F-15: search successful Wikifolio traders by performance criterion
   */
  searchWikifolios: adminProcedure
    .input(z.object({
      sortBy: z.enum(['perf12m', 'sharperatio', 'sharpe36m', 'sharpe60m', 'aum', 'perfever', 'perf36m', 'perf60m', 'topwikis']).default('sharperatio'),
      query: z.string().optional(),
      limit: z.number().min(1).max(50).optional().default(25),
    }))
    .query(async ({ input }) => {
      try {
        const traders = await searchWikifolios({
          sortBy: input.sortBy,
          query: input.query,
          limit: input.limit,
        });

        // Note: The new search-api.wikifolio.com no longer returns performance metrics
        // (sharpeRatio, performance, maxDrawdown). These are only available via the
        // authenticated basicdata endpoint. We return the search results immediately
        // without enrichment to avoid slow/failing API calls.
        return { success: true, traders };
      } catch (err: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err?.message || 'Wikifolio-Suche fehlgeschlagen',
        });
      }
    }),

  /**
   * Clear Wikifolio session (force re-login)
   */
  clearWikifolioSession: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
      }
      clearWikifolioSession();
      return { success: true, message: 'Wikifolio-Session zurückgesetzt' };
    }),

  /**
   * Import Wikifolio positions into the local watchlist
   */
  importWikifolioToWatchlist: protectedProcedure
    .input(z.object({
      symbol: z.string().min(1).default('wfglobalnt'),
      overwriteExisting: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
      }
      const { getDb } = await import('../db');
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      const portfolio = await getWikifolioPortfolio(input.symbol);
      const equityItems = portfolio.items.filter(item =>
        item.groupName === 'equities' || item.groupName === 'etfs'
      );

      let imported = 0;
      const skipped: Array<{ isin: string; name: string; reason: string }> = [];

      // Helper: derive category from EODHD fundamentals
      const inferCategory = (sector: string | null, dividendYield: number | null): string | null => {
        if (dividendYield !== null && dividendYield > 2.5) return 'Dividendenaktien';
        if (sector) {
          const s = sector.toLowerCase();
          if (s.includes('technology') || s.includes('communication')) return 'Wachstumsaktien';
          if (s.includes('financial') || s.includes('real estate')) return 'Value';
          if (s.includes('consumer') || s.includes('health') || s.includes('utilities')) return 'Dividendenaktien';
        }
        return 'Wachstumsaktien'; // default
      };

      for (const item of equityItems) {
        try {
          // F-15: resolve ISIN → Yahoo ticker (ISINs as tickers produced junk rows)
          const ticker = await resolveIsinToTicker(
            (q: string) => yahooFinance.search(q, { quotesCount: 5, newsCount: 0 }, { validateResult: false }),
            item.isin
          );
          if (!ticker) {
            skipped.push({ isin: item.isin || '—', name: item.name, reason: 'Kein Yahoo-Ticker zur ISIN gefunden' });
            continue;
          }

          // Fetch EODHD fundamentals for enrichment (sector, P/E, Div.%, PEG)
          let fundamentals = null;
          try {
            fundamentals = await fetchEODHDFundamentals(ticker);
          } catch (_e) {
            // Non-fatal: import proceeds without enrichment
          }

          // Dividend yield with 3-tier fallback
          let dividendYield: number | null = null;
          try {
            dividendYield = await fetchDividendYieldWithFallback(ticker, fundamentals?.dividendYield ?? null);
          } catch (_e) { /* ignore */ }

          const sector = fundamentals?.sector ?? null;
          const industry = fundamentals?.industry ?? null;
          const peRatio = (fundamentals?.peRatio != null && !isNaN(fundamentals.peRatio)) ? fundamentals.peRatio.toFixed(2) : null;
          const pegRatio = (fundamentals?.pegRatio != null && !isNaN(fundamentals.pegRatio) && fundamentals.pegRatio > 0) ? fundamentals.pegRatio.toFixed(2) : null;
          const divYieldStr = (dividendYield != null) ? dividendYield.toFixed(2) : null;
          const category = inferCategory(sector, dividendYield);
          const companyName = fundamentals?.companyName || item.name;
          const notes = `Importiert aus Wikifolio ${input.symbol} | ISIN: ${item.isin} | Anteil: ${item.percentage?.toFixed(2)}%`;

          const existing = await db.select().from(watchlistStocks)
            .where(eq(watchlistStocks.ticker, ticker)).limit(1);

          if (existing.length > 0 && !input.overwriteExisting) {
            skipped.push({ isin: item.isin || '—', name: item.name, reason: `Bereits in der Watchlist (${ticker})` });
            continue;
          }

          if (existing.length > 0 && input.overwriteExisting) {
            // Overwrite: update all enrichable fields + ins Universum aufnehmen
            // (falls die Zeile bisher reines Portfolio-Stammdatum war).
            await db.update(watchlistStocks).set({
              companyName,
              source: 'wikifolio',
              listType: 'watchlist',
              currentPrice: item.close?.toString() || null,
              notes,
              ...(sector ? { sector } : {}),
              ...(industry ? { industry } : {}),
              ...(category ? { category } : {}),
              ...(peRatio ? { peRatio } : {}),
              ...(pegRatio ? { pegRatio } : {}),
              ...(divYieldStr ? { dividendYield: divYieldStr } : {}),
              lastMetricsUpdate: new Date(),
            }).where(eq(watchlistStocks.ticker, ticker));
            imported++;
            continue;
          }

          // New insert with full enrichment
          await db.insert(watchlistStocks).values({
            ticker,
            companyName,
            source: 'wikifolio',
            listType: 'watchlist',
            currentPrice: item.close?.toString() || null,
            notes,
            ...(sector ? { sector } : {}),
            ...(industry ? { industry } : {}),
            ...(category ? { category } : {}),
            ...(peRatio ? { peRatio } : {}),
            ...(pegRatio ? { pegRatio } : {}),
            ...(divYieldStr ? { dividendYield: divYieldStr } : {}),
            lastMetricsUpdate: new Date(),
          });
          imported++;
        } catch (err: any) {
          skipped.push({ isin: item.isin || '—', name: item.name, reason: err?.message || 'Unbekannter Fehler' });
        }
        // Rate limiting: Yahoo search + EODHD call
        await new Promise(r => setTimeout(r, 500));
      }

      return {
        success: true,
        imported,
        skipped,
        total: equityItems.length,
        message: `${imported} Positionen importiert, ${skipped.length} übersprungen`,
      };
    }),

  // Enrich ALL stocks missing sector/category — uses EODHD first, Yahoo Finance as fallback
  enrichWikifolioStocks: protectedProcedure
    .input(z.object({ onlyMissing: z.boolean().optional().default(true) }).optional())
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
      }
      const { getDb } = await import('../db');
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      // Get all stocks (or only those missing sector/category)
      const allStocks = await db.select().from(watchlistStocks);
      const stocks = (input?.onlyMissing !== false)
        ? allStocks.filter((s: any) => !s.sector || !s.category)
        : allStocks;

      const inferCategory = (sector: string | null, dividendYield: number | null): string | null => {
        if (dividendYield !== null && dividendYield > 2.5) return 'Dividendenaktien';
        if (sector) {
          const s = sector.toLowerCase();
          if (s.includes('technology') || s.includes('communication') || s.includes('semiconductor')) return 'Wachstumsaktien';
          if (s.includes('financial') || s.includes('real estate') || s.includes('bank')) return 'Value';
          if (s.includes('consumer') || s.includes('health') || s.includes('utilities') || s.includes('pharma')) return 'Dividendenaktien';
          if (s.includes('industrial') || s.includes('material') || s.includes('energy')) return 'Value';
        }
        return 'Wachstumsaktien';
      };

      let enriched = 0;
      let failed = 0;

      for (const stock of stocks) {
        try {
          const updateData: Record<string, any> = { lastMetricsUpdate: new Date() };
          let sector = stock.sector || null;
          let dividendYield: number | null = null;

          // 1. Try EODHD first
          try {
            const fundamentals = await fetchEODHDFundamentals(stock.ticker);
            if (fundamentals.sector && !sector) {
              sector = fundamentals.sector;
              updateData.sector = sector;
            }
            if (fundamentals.industry && !stock.industry) updateData.industry = fundamentals.industry;
            if (fundamentals.companyName && stock.companyName === stock.ticker) updateData.companyName = fundamentals.companyName;
            if (fundamentals.peRatio != null && !isNaN(fundamentals.peRatio) && !stock.peRatio) {
              updateData.peRatio = fundamentals.peRatio.toFixed(2);
            }
            if (fundamentals.pegRatio != null && !isNaN(fundamentals.pegRatio) && fundamentals.pegRatio > 0 && !stock.pegRatio) {
              updateData.pegRatio = fundamentals.pegRatio.toFixed(2);
            }
            dividendYield = await fetchDividendYieldWithFallback(stock.ticker, fundamentals?.dividendYield ?? null);
            if (dividendYield != null && !stock.dividendYield) {
              updateData.dividendYield = dividendYield.toFixed(2);
            }
          } catch (_e) { /* EODHD failed, try Yahoo */ }

          // 2. Yahoo Finance fallback for sector if still missing
          if (!sector || !stock.peRatio) {
            try {
              const normalizedT = normalizeTicker(stock.ticker);
              const quote: any = await yahooFinance.quoteSummary(normalizedT, {
                modules: ['assetProfile', 'summaryDetail', 'defaultKeyStatistics'],
              }, { validateResult: false });
              const profile = quote?.assetProfile;
              const summary = quote?.summaryDetail;
              const keyStats = quote?.defaultKeyStatistics;
              if (profile?.sector && !sector) {
                sector = profile.sector;
                updateData.sector = sector;
              }
              if (profile?.industry && !stock.industry) updateData.industry = profile.industry;
              if (profile?.longName && (!stock.companyName || stock.companyName === stock.ticker)) {
                updateData.companyName = profile.longName;
              }
              if (!stock.peRatio) {
                const pe = summary?.trailingPE || keyStats?.trailingEps;
                if (pe && !isNaN(pe) && pe > 0) updateData.peRatio = pe.toFixed(2);
              }
              if (!stock.dividendYield && summary?.dividendYield) {
                const dy = summary.dividendYield * 100;
                updateData.dividendYield = dy.toFixed(2);
                dividendYield = dy;
              }
            } catch (_e) { /* Yahoo also failed */ }
          }

          // 3. Infer category from sector
          if (!stock.category) {
            const cat = inferCategory(sector, dividendYield);
            if (cat) updateData.category = cat;
          }

          if (Object.keys(updateData).length > 1) {
            await db.update(watchlistStocks).set(updateData).where(eq(watchlistStocks.ticker, stock.ticker));
            enriched++;
          }
        } catch (_e) {
          failed++;
        }
        await new Promise(r => setTimeout(r, 300));
      }

      return {
        success: true,
        enriched,
        failed,
        total: stocks.length,
        message: `${enriched} Titel angereichert, ${failed} fehlgeschlagen (von ${stocks.length} Titeln ohne Sektor/Kategorie)`,
      };
    }),
});
// end of watchlistRouter
