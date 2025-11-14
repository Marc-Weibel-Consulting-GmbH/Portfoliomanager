import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { ENV } from "./_core/env";
import { fxRouter } from "./routers/fxRouter";
import { stocksRouter } from "./routers/stocksRouter";
import { portfoliosRouter } from "./routers/portfoliosRouter";
import { dividendCalendarRouter } from "./routers/dividendCalendarRouter";
import { annualPerformanceRouter } from "./routers/annualPerformanceRouter";
import { portfolioTransactionsRouter } from "./routers/portfolioTransactionsRouter";
import { realizedGainsHistoryRouter } from "./routers/realizedGainsHistoryRouter";
import { secretsRouter } from "./routers/secretsRouter";
import { testSecretsRouter } from "./routers/testSecretsRouter";
import { logsRouter } from "./routers/logsRouter";
import { notificationSettingsRouter } from "./routers/notificationSettingsRouter";
import { z } from "zod";
import { fetchStockMetrics } from "./_core/stockDataApi";
import { fetchEODHDFundamentals } from "./_core/eodhdApi";
import { callDataApi } from "./_core/dataApi";
import { historicalPrices } from "../drizzle/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";

/**
 * Fetch dividend yield with 3-tier fallback: EODHD → Finnhub → Yahoo Finance
 * @param ticker Stock ticker symbol
 * @param eodhDividendYield Dividend yield from EODHD (may be null)
 * @returns Dividend yield as percentage or null if not available
 */
async function fetchDividendYieldWithFallback(ticker: string, eodhDividendYield: number | null): Promise<number | null> {
  let dividendYield = eodhDividendYield;
  
  // Fallback 1: Finnhub
  if (dividendYield === null || isNaN(dividendYield)) {
    try {
      const { getFinnhubApiKey } = await import("./_core/env");
      const finnhubKey = await getFinnhubApiKey();
      if (finnhubKey) {
        const finnhubUrl = `https://finnhub.io/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${finnhubKey}`;
        const finnhubRes = await fetch(finnhubUrl);
        if (finnhubRes.ok) {
          const finnhubData = await finnhubRes.json();
          if (finnhubData.metric?.dividendYieldIndicatedAnnual) {
            dividendYield = finnhubData.metric.dividendYieldIndicatedAnnual;
            console.log(`[DividendYield] Finnhub: ${ticker} = ${dividendYield}%`);
          }
        }
      }
    } catch (finnhubError) {
      console.warn(`[DividendYield] Finnhub failed for ${ticker}:`, finnhubError);
    }
  }
  
  // Fallback 2: Yahoo Finance
  if (dividendYield === null || isNaN(dividendYield)) {
    try {
      const yahooUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=summaryDetail`;
      const yahooRes = await fetch(yahooUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (yahooRes.ok) {
        const yahooData = await yahooRes.json();
        const summaryDetail = yahooData.quoteSummary?.result?.[0]?.summaryDetail;
        if (summaryDetail?.dividendYield?.raw) {
          dividendYield = summaryDetail.dividendYield.raw * 100;
          console.log(`[DividendYield] Yahoo Finance: ${ticker} = ${dividendYield}%`);
        }
      }
    } catch (yahooError) {
      console.warn(`[DividendYield] Yahoo Finance failed for ${ticker}:`, yahooError);
    }
  }
  
  if (dividendYield !== null && !isNaN(dividendYield)) {
    console.log(`[DividendYield] Final: ${ticker} = ${dividendYield.toFixed(2)}%`);
    return dividendYield;
  }
  
  console.warn(`[DividendYield] No data available for ${ticker} from any source`);
  return null;
}

/**
 * Portfolio weighting logic with manual weight preservation:
 * - Manual weights (isManualWeight = 1) are NEVER changed automatically
 * - Only automatic weights (isManualWeight = 0) are redistributed
 * - When adding/updating: mark as manual, redistribute only automatic stocks
 * - When deleting: redistribute only automatic stocks to fill the gap
 */
async function recalculateWeights(changedTicker?: string, isDelete: boolean = false) {
  const { getAllStocks, updateStock } = await import("./db");
  const allStocks = await getAllStocks();
  
  console.log(`[RecalculateWeights] Called with changedTicker=${changedTicker}, isDelete=${isDelete}, totalStocks=${allStocks.length}`);
  
  if (allStocks.length === 0) return;
  
  // Special case: If adding a new stock AND no manual weights exist, redistribute all equally
  if (changedTicker && !isDelete) {
    const changedStock = allStocks.find(s => s.ticker === changedTicker);
    if (changedStock) {
      const totalWeight = allStocks.reduce((sum, s) => sum + parseFloat(s.portfolioWeight || "0"), 0);
      const isNewStock = parseFloat(changedStock.portfolioWeight || "0") === 0 || totalWeight > 100;
      
      console.log(`[RecalculateWeights] Changed stock: ${changedTicker}, weight=${changedStock.portfolioWeight}, isManualWeight=${changedStock.isManualWeight}, totalWeight=${totalWeight}, isNewStock=${isNewStock}`);
      
      // Only redistribute all stocks if NO manual weights exist
      const hasManualWeights = allStocks.some(s => s.isManualWeight === 1);
      const manualStocksList = allStocks.filter(s => s.isManualWeight === 1).map(s => `${s.ticker}(${s.portfolioWeight}%)`);
      
      console.log(`[RecalculateWeights] hasManualWeights=${hasManualWeights}, manualStocks=[${manualStocksList.join(', ')}]`);
      
      if (isNewStock && !hasManualWeights) {
        // Redistribute all stocks equally to 100%
        const equalWeight = 100 / allStocks.length;
        console.log(`[RecalculateWeights] New stock detected (no manual weights), redistributing ${allStocks.length} stocks to ${equalWeight.toFixed(2)}% each`);
        for (const stock of allStocks) {
          await updateStock(stock.ticker, {
            portfolioWeight: equalWeight.toFixed(4),
            isManualWeight: 0,
          });
        }
        return;
      }
      // If manual weights exist, fall through to normal Add/Update logic below
    }
  }
  
  if (isDelete) {
    // Delete: redistribute only AUTOMATIC stocks equally to 100%
    const manualStocks = allStocks.filter(s => s.isManualWeight === 1);
    const autoStocks = allStocks.filter(s => s.isManualWeight === 0);
    
    if (autoStocks.length === 0) return; // All stocks are manual, can't redistribute
    
    // Calculate total manual weight
    const totalManualWeight = manualStocks.reduce((sum, s) => {
      return sum + parseFloat(s.portfolioWeight || "0");
    }, 0);
    
    // Distribute remaining weight equally among automatic stocks
    const remainingWeight = 100 - totalManualWeight;
    const equalWeight = remainingWeight / autoStocks.length;
    
    for (const stock of autoStocks) {
      await updateStock(stock.ticker, {
        portfolioWeight: equalWeight.toFixed(4),
      });
    }
  } else if (changedTicker) {
    // Add or Update: mark as manual, redistribute only OTHER automatic stocks
    const changedStock = allStocks.find(s => s.ticker === changedTicker);
    if (!changedStock) return;
    
    // Mark the changed stock as manual
    await updateStock(changedTicker, {
      isManualWeight: 1,
    });
    
    const changedWeight = parseFloat(changedStock.portfolioWeight || "0");
    
    // Get all manual stocks (including the one just changed)
    const manualStocks = allStocks.filter(s => 
      s.ticker === changedTicker || s.isManualWeight === 1
    );
    const autoStocks = allStocks.filter(s => 
      s.ticker !== changedTicker && s.isManualWeight === 0
    );
    
    if (autoStocks.length === 0) return; // All stocks are manual, can't redistribute
    
    // Calculate total manual weight
    const totalManualWeight = manualStocks.reduce((sum, s) => {
      const weight = s.ticker === changedTicker ? changedWeight : parseFloat(s.portfolioWeight || "0");
      return sum + weight;
    }, 0);
    
    // Distribute remaining weight equally among automatic stocks
    const remainingWeight = 100 - totalManualWeight;
    const equalWeight = remainingWeight / autoStocks.length;
    
    for (const stock of autoStocks) {
      await updateStock(stock.ticker, {
        portfolioWeight: equalWeight.toFixed(4),
      });
    }
  }
}

export const appRouter = router({
  system: systemRouter,

  // DEBUG: Endpoint to inspect production environment variables
  debug: router({
    envKeys: publicProcedure.query(() => {
      const keys = Object.keys(process.env).sort();
      const secretKeys = keys.filter(k => 
        k.includes('STRIPE') || 
        k.includes('FINNHUB') || 
        k.includes('RESEND') || 
        k.includes('TWILIO') ||
        k.includes('SECRET') ||
        k.includes('KEY') ||
        k.includes('TOKEN')
      );
      return {
        totalKeys: keys.length,
        allKeys: keys,
        secretRelatedKeys: secretKeys,
        nodeEnv: process.env.NODE_ENV,
        sampleValues: {
          STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? `SET(len:${process.env.STRIPE_SECRET_KEY.length})` : 'UNDEFINED',
          FINNHUB_API_KEY: process.env.FINNHUB_API_KEY ? `SET(len:${process.env.FINNHUB_API_KEY.length})` : 'UNDEFINED',
          RESEND_API_KEY: process.env.RESEND_API_KEY ? `SET(len:${process.env.RESEND_API_KEY.length})` : 'UNDEFINED',
          DATABASE_URL: process.env.DATABASE_URL ? `SET(len:${process.env.DATABASE_URL.length})` : 'UNDEFINED',
          JWT_SECRET: process.env.JWT_SECRET ? `SET(len:${process.env.JWT_SECRET.length})` : 'UNDEFINED',
        }
      };
    }),
  }),

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    register: publicProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null) return val;
        throw new Error("Invalid input");
      })
      .mutation(async ({ input, ctx }) => {
        const { getDb } = await import("./db");
        const { users, newsletter } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        
        const data = input as any;
        const db = await getDb();
        
        if (!db) {
          throw new Error("Database not available");
        }
        
        // Check if email already exists
        const existingUser = await db
          .select()
          .from(users)
          .where(eq(users.email, data.email))
          .limit(1);
        
        if (existingUser.length > 0) {
          throw new Error("Diese E-Mail-Adresse ist bereits registriert");
        }
        
        // Generate unique openId
        const openId = `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        
        // Hash password
        const bcrypt = await import("bcryptjs");
        const hashedPassword = await bcrypt.default.hash(data.password, 10);
        
        // Create new user
        await db.insert(users).values({
          openId,
          firstName: data.firstName,
          lastName: data.lastName,
          name: `${data.firstName} ${data.lastName}`,
          email: data.email,
          password: hashedPassword,
          mobile: data.mobile || null,
          loginMethod: "email",
          role: "user",
          hasPaid: 0,
        });
        
        // Add to newsletter
        try {
          await db.insert(newsletter).values({
            email: data.email,
            isActive: 1,
          });
        } catch (error) {
          console.error("Failed to add to newsletter:", error);
        }
        
        // Auto-login: Create session token and set cookie
        const { sdk } = await import("./_core/sdk");
        const sessionToken = await sdk.createSessionToken(openId, {
          name: `${data.firstName} ${data.lastName}`,
          expiresInMs: 30 * 24 * 60 * 60 * 1000, // 30 days
        });
        
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        });
        
        return { success: true };
      }),
    login: publicProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null) return val;
        throw new Error("Invalid input");
      })
      .mutation(async ({ input, ctx }) => {
        const { getDb } = await import("./db");
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        
        const data = input as any;
        const db = await getDb();
        
        if (!db) {
          throw new Error("Database not available");
        }
        
        // Find user by email
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, data.email))
          .limit(1);
        
        if (!user) {
          throw new Error("E-Mail oder Passwort falsch");
        }
        
        // Verify password
        const bcrypt = await import("bcryptjs");
        const isValid = await bcrypt.default.compare(data.password, user.password || "");
        
        if (!isValid) {
          throw new Error("E-Mail oder Passwort falsch");
        }
        
        // Create session token and set cookie
        const { sdk } = await import("./_core/sdk");
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || `${user.firstName} ${user.lastName}`,
          expiresInMs: 30 * 24 * 60 * 60 * 1000, // 30 days
        });
        
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        });
        
        return { success: true };
      }),
  }),

  stocks: router({
    getAll: publicProcedure.query(async () => {
      const { getAllStocks } = await import("./db");
      return await getAllStocks();
    }),

    getDailyPerformance: publicProcedure.query(async () => {
      const { getAllStocks, getDb } = await import("./db");
      const stocks = await getAllStocks();
      
      if (stocks.length === 0) {
        return { performance: 0, performanceAbsolute: 0 };
      }
      
      const db = await getDb();
      if (!db) {
        return { performance: 0, performanceAbsolute: 0 };
      }
      
      const { historicalPrices } = await import("../drizzle/schema");
      const { eq, and, lte } = await import("drizzle-orm");
      const { getStockCurrency, convertToCHF } = await import("./fxHelper");
      
      // Get yesterday's date (for closing prices)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const todayStr = new Date().toISOString().split('T')[0];
      
      let totalCurrentValueCHF = 0;
      let totalYesterdayValueCHF = 0;
      
      for (const stock of stocks) {
        const weight = parseFloat(stock.portfolioWeight || '0');
        if (weight === 0) continue;
        
        const currentPrice = parseFloat(stock.currentPrice || '0');
        if (currentPrice === 0) continue;
        
        // Get yesterday's closing price
        const { desc } = await import("drizzle-orm");
        const historicalPrice = await db
          .select()
          .from(historicalPrices)
          .where(
            and(
              eq(historicalPrices.ticker, stock.ticker),
              lte(historicalPrices.date, yesterdayStr)
            )
          )
          .orderBy(desc(historicalPrices.date))
          .limit(1);
        
        const yesterdayPrice = historicalPrice[0]?.close 
          ? parseFloat(historicalPrice[0].close)
          : currentPrice; // Fallback to current price if no historical data
        
        // Get currency for this stock
        const currency = await getStockCurrency(stock.ticker);
        
        // Convert to CHF using appropriate FX rates
        const currentValueCHF = await convertToCHF(currentPrice * weight, currency, todayStr);
        const yesterdayValueCHF = await convertToCHF(yesterdayPrice * weight, currency, yesterdayStr);
        
        totalCurrentValueCHF += currentValueCHF;
        totalYesterdayValueCHF += yesterdayValueCHF;
      }
      
      // Calculate performance
      const performance = totalYesterdayValueCHF > 0
        ? ((totalCurrentValueCHF - totalYesterdayValueCHF) / totalYesterdayValueCHF) * 100
        : 0;
      
      const performanceAbsolute = totalCurrentValueCHF - totalYesterdayValueCHF;
      
      return { 
        performance: parseFloat(performance.toFixed(2)), 
        performanceAbsolute: parseFloat(performanceAbsolute.toFixed(2))
      };
    }),

    getByTicker: publicProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "ticker" in val && typeof val.ticker === "string") {
          return { ticker: val.ticker };
        }
        throw new Error("Invalid ticker");
      })
      .query(async ({ input }) => {
        const { getStockByTicker } = await import("./db");
        return await getStockByTicker(input.ticker);
      }),

    getHistoricalPE: publicProcedure
      .input((val: unknown) => {
        if (typeof val !== 'object' || val === null) throw new Error('Invalid input');
        const input = val as any;
        if (typeof input.ticker !== 'string') throw new Error('Invalid ticker');
        return {
          ticker: input.ticker,
          years: typeof input.years === 'number' ? input.years : 5,
        };
      })
      .query(async ({ input }) => {
        const { calculateHistoricalPE } = await import("./historical-pe");
        return await calculateHistoricalPE(input.ticker, input.years);
      }),

    getHistoricalMetrics: publicProcedure
      .input((val: unknown) => {
        if (typeof val !== 'object' || val === null) throw new Error('Invalid input');
        const input = val as any;
        if (typeof input.ticker !== 'string') throw new Error('Invalid ticker');
        return {
          ticker: input.ticker,
          days: typeof input.days === 'number' ? input.days : 30,
        };
      })
      .query(async ({ input }) => {
        const { getHistoricalMetrics, getTrendSummary } = await import("./_core/historicalMetricsRecorder");
        const history = await getHistoricalMetrics(input.ticker, input.days);
        const trend = await getTrendSummary(input.ticker, input.days);
        
        return {
          history,
          trend,
        };
      }),
    refreshStock: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "string") return val;
        throw new Error("Invalid ticker");
      })
      .mutation(async ({ input: ticker }) => {
        const { fetchCompleteStockData } = await import("./_core/multiApiDataMerger");
        const { getDb } = await import("./db");
        const { stocks } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");

        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Fetch fresh data
        const completeData = await fetchCompleteStockData(ticker);

        // Prepare update data
        const updateData: any = {
          lastDataRefresh: new Date(),
        };

        if (completeData.currentPrice !== null) {
          updateData.currentPrice = completeData.currentPrice.toString();
        }
        if (completeData.currency) {
          updateData.currency = completeData.currency;
        }
        if (completeData.sharpe !== null && completeData.sharpe !== undefined) {
          updateData.sharpeRatio = completeData.sharpe.toString();
        }
        if (completeData.pe !== null) updateData.peRatio = completeData.pe.toString();
        if (completeData.peg !== null) updateData.pegRatio = completeData.peg.toString();
        if (completeData.dividendYield !== null) updateData.dividendYield = completeData.dividendYield.toString();
        if (completeData.beta !== null) updateData.beta = completeData.beta.toString();
        if (completeData.volatility !== null) updateData.volatility = completeData.volatility.toString();

        // Update in database
        await db.update(stocks)
          .set(updateData)
          .where(eq(stocks.ticker, ticker));

        // Get old values for alert checking
        const oldStock = await db.select().from(stocks).where(eq(stocks.ticker, ticker)).limit(1);
        const oldValues = oldStock[0];

        // Record historical snapshot
        const { recordMetricsSnapshot } = await import("./_core/historicalMetricsRecorder");
        await recordMetricsSnapshot({
          ticker,
          sharpeRatio: updateData.sharpeRatio,
          peRatio: updateData.peRatio,
          pegRatio: updateData.pegRatio,
          dividendYield: updateData.dividendYield,
          beta: updateData.beta,
          volatility: updateData.volatility,
          currentPrice: updateData.currentPrice,
        });

        // Check for alert triggers
        const { checkAlerts } = await import("./_core/alertSystem");
        const changes = [];
        if (updateData.sharpeRatio) changes.push({ ticker, metricName: 'sharpeRatio', oldValue: oldValues?.sharpeRatio || null, newValue: updateData.sharpeRatio });
        if (updateData.peRatio) changes.push({ ticker, metricName: 'peRatio', oldValue: oldValues?.peRatio || null, newValue: updateData.peRatio });
        if (updateData.dividendYield) changes.push({ ticker, metricName: 'dividendYield', oldValue: oldValues?.dividendYield || null, newValue: updateData.dividendYield });
        await checkAlerts(changes);

        // Return updated stock
        const updatedStock = await db.select().from(stocks).where(eq(stocks.ticker, ticker)).limit(1);
        return updatedStock[0] || null;
      }),
    getByTickers: publicProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "tickers" in val) {
          const input = val as any;
          if (Array.isArray(input.tickers)) return { tickers: input.tickers as string[] };
        }
        throw new Error("Invalid input: tickers array required");
      })
      .query(async ({ input }) => {
        const { getDb } = await import("./db");
        const { stocks } = await import("../drizzle/schema");
        const { inArray } = await import("drizzle-orm");
        
        const db = await getDb();
        if (!db) return [];
        
        if (input.tickers.length === 0) return [];
        
        const result = await db.select().from(stocks).where(inArray(stocks.ticker, input.tickers));
        return result;
      }),
    searchTicker: publicProcedure
      .input((val: unknown) => {
        if (typeof val === "string") return val;
        throw new Error("Invalid search query");
      })
      .query(async ({ input }) => {
        try {
          const apiKey = process.env.EODHD_API_KEY;
          if (!apiKey) return [];
          
          const searchUrl = `https://eodhd.com/api/search/${encodeURIComponent(input)}?api_token=${apiKey}&limit=10`;
          const response = await fetch(searchUrl);
          if (!response.ok) return [];
          
          const results = await response.json();
          return results.map((r: any) => ({
            symbol: r.Code,
            shortname: r.Name,
            exchange: r.Exchange,
            displaySymbol: `${r.Code} • ${r.Exchange}`,
          }));
        } catch (error) {
          console.error("[Ticker Search] Failed:", error);
          return [];
        }
      }),
    fetchStockData: publicProcedure
      .input((val: unknown) => {
        if (typeof val === "string") return val;
        throw new Error("Invalid ticker");
      })
      .mutation(async ({ input: ticker }) => {
        try {
          const { fetchCompleteStockData } = await import("./_core/multiApiDataMerger");
          
          // Special ticker mappings for API calls (UI ticker -> API ticker)
          const TICKER_API_MAP: Record<string, string> = {
            'ABBN': 'ABBN.SW', // Keep ABBN in UI for chart, use ABBN.SW for API
          };
          
          // Clean ticker: replace " • " with "." (e.g., "NOVN • SW" -> "NOVN.SW")
          let cleanTicker = ticker.replace(/ • /g, ".").trim();
          
          // Apply special mapping if exists
          if (TICKER_API_MAP[cleanTicker]) {
            cleanTicker = TICKER_API_MAP[cleanTicker];
          }
          // Add .US suffix for US tickers without exchange (e.g., "PINS" -> "PINS.US")
          else if (!cleanTicker.includes('.')) {
            cleanTicker = `${cleanTicker}.US`;
          }

          // Use multi-API data merger for complete stock data (correct currency + Sharpe Ratio)
          const completeData = await fetchCompleteStockData(cleanTicker);
          
          // Fetch YTD data from EODHD (not available in multiApiDataMerger)
          let ytdStartPrice = null;
          let ytdPerformance = null;
          try {
            const apiKey = process.env.EODHD_API_KEY;
            if (apiKey) {
              const historicalUrl = `https://eodhd.com/api/eod/${cleanTicker}?api_token=${apiKey}&from=2024-12-27&to=2024-12-31&fmt=json`;
              const historicalRes = await fetch(historicalUrl);
              if (historicalRes.ok) {
                const historicalData = await historicalRes.json();
                if (historicalData && historicalData.length > 0) {
                  ytdStartPrice = historicalData[historicalData.length - 1].close;
                  if (ytdStartPrice && completeData.currentPrice) {
                    ytdPerformance = ((completeData.currentPrice - ytdStartPrice) / ytdStartPrice) * 100;
                  }
                }
              }
            }
          } catch (err) {
            console.warn('[fetchStockData] Failed to fetch YTD data:', err);
          }

          return {
            ticker: cleanTicker,
            companyName: completeData.companyName || cleanTicker,
            currentPrice: completeData.currentPrice || 0,
            ytdStartPrice: ytdStartPrice,
            ytdPerformance: ytdPerformance,
            peRatio: completeData.pe,
            pegRatio: completeData.peg,
            dividendYield: completeData.dividendYield,
            sharpeRatio: completeData.sharpe,
            volatility: completeData.volatility,
            beta: completeData.beta,
            currency: completeData.currency || 'USD',
          };
        } catch (error: any) {
          console.error("[fetchStockData] Error:", error);
          throw new Error(error.message || "Failed to fetch stock data");
        }
      }),
    list: publicProcedure.query(async () => {
      const { getAllStocks } = await import("./db");
      return await getAllStocks();
    }),
    getFxRates: publicProcedure.query(async () => {
      const db = await (await import("./db")).getDb();
      if (!db) return { USDCHF: 0.88, EURCHF: 0.93, GBPCHF: 1.12 };
      
      const { exchangeRates } = await import("../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");
      
      // Get latest rates for each currency pair
      const rates = await db.select().from(exchangeRates)
        .orderBy(desc(exchangeRates.date))
        .limit(10);
      
      const ratesMap: Record<string, number> = {};
      for (const rate of rates) {
        if (!ratesMap[rate.currencyPair]) {
          ratesMap[rate.currencyPair] = parseFloat(rate.rate);
        }
      }
      
      return {
        USDCHF: ratesMap.USDCHF || 0.88,
        EURCHF: ratesMap.EURCHF || 0.93,
        GBPCHF: ratesMap.GBPCHF || 1.12
      };
    }),
    byCategory: publicProcedure
      .input((val: unknown) => {
        if (typeof val === "string") return val;
        throw new Error("Invalid category");
      })
      .query(async ({ input }) => {
        const { getStocksByCategory } = await import("./db");
        return await getStocksByCategory(input);
      }),
    byTicker: publicProcedure
      .input((val: unknown) => {
        if (typeof val === "string") return val;
        throw new Error("Invalid ticker");
      })
      .query(async ({ input }) => {
        const { getStockByTicker } = await import("./db");
        return await getStockByTicker(input);
      }),
    stats: publicProcedure.query(async () => {
      const { getAllStocks } = await import("./db");
      const stocks = await getAllStocks();
      
      const categories = stocks.reduce((acc, stock) => {
        const cat = stock.category || "Andere";
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Calculate total portfolio weight (ALL stocks)
      const totalPortfolioWeight = stocks.reduce((sum, s) => {
        return sum + parseFloat(s.portfolioWeight || "0");
      }, 0);

      // Calculate weighted dividend yield based on portfolio weight
      const dividendStocks = stocks.filter(s => s.dividendYield && s.portfolioWeight);
      let totalDividendWeight = 0;
      let weightedYield = 0;

      dividendStocks.forEach(s => {
        const weight = parseFloat(s.portfolioWeight || "0");
        const yield_ = parseFloat(s.dividendYield || "0");
        totalDividendWeight += weight;
        weightedYield += (weight * yield_) / 100;
      });

      const avgDividendYield = totalDividendWeight > 0 ? weightedYield : 0;

      return {
        totalStocks: stocks.length,
        categories,
        avgDividendYield: avgDividendYield.toFixed(2),
        totalPortfolioWeight: totalPortfolioWeight.toFixed(2),
        categoryCounts: Object.entries(categories).map(([name, count]) => ({ name, count })),
      };
    }),
    add: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null) return val;
        throw new Error("Invalid input");
      })
      .mutation(async ({ input, ctx }) => {
        const { insertStock, getAllStocks, logTransaction, updateStock } = await import("./db");
        const { notifyTransaction } = await import("./services/whatsapp");
        const { invokeLLM } = await import("./_core/llm");
        const { fetchCompleteStockData } = await import("./_core/multiApiDataMerger");
        const stockData = input as any;
        
        // Fetch complete data using multi-API fallback
        console.log(`[AddStock] Fetching complete data for ${stockData.ticker}...`);
        const completeData = await fetchCompleteStockData(stockData.ticker);
        
        // Use validated ticker from multi-API result
        if (completeData.ticker !== stockData.ticker) {
          console.log(`[AddStock] Using ${completeData.ticker} instead of ${stockData.ticker}`);
          stockData.ticker = completeData.ticker;
        }
        
        // Auto-fill missing data from multi-API result
        if (!stockData.currentPrice && completeData.currentPrice) {
          stockData.currentPrice = completeData.currentPrice.toString();
          console.log(`[AddStock] Auto-filled currentPrice: ${stockData.currentPrice} (from ${completeData.dataSources.currentPrice})`);
        }
        if (!stockData.peRatio && completeData.pe) {
          stockData.peRatio = completeData.pe.toString();
          console.log(`[AddStock] Auto-filled peRatio: ${stockData.peRatio} (from ${completeData.dataSources.pe})`);
        }
        if (!stockData.pegRatio && completeData.peg) {
          stockData.pegRatio = completeData.peg.toString();
          console.log(`[AddStock] Auto-filled pegRatio: ${stockData.pegRatio} (from ${completeData.dataSources.peg})`);
        }
        if (!stockData.dividendYield && completeData.dividendYield) {
          stockData.dividendYield = completeData.dividendYield.toString();
          console.log(`[AddStock] Auto-filled dividendYield: ${stockData.dividendYield} (from ${completeData.dataSources.dividendYield})`);
        }
        if (!stockData.currency && completeData.currency) {
          stockData.currency = completeData.currency;
          console.log(`[AddStock] Auto-filled currency: ${stockData.currency}`);
        }
        if (!stockData.companyName && completeData.companyName) {
          stockData.companyName = completeData.companyName;
          console.log(`[AddStock] Auto-filled companyName: ${stockData.companyName}`);
        }
        
        // Set default values for required fields
        stockData.currency = stockData.currency || "USD";
        stockData.dividendYield = stockData.dividendYield || "0";
        stockData.pegRatio = stockData.pegRatio || "0";
        stockData.peRatio = stockData.peRatio || "0";
        stockData.portfolioWeight = stockData.portfolioWeight || "0";
        
        // Mark as manual weight if user provided non-zero weight
        const weight = parseFloat(stockData.portfolioWeight);
        stockData.isManualWeight = (weight > 0) ? 1 : 0;
        console.log(`[AddStock] ${stockData.ticker}: portfolioWeight=${stockData.portfolioWeight}, isManualWeight=${stockData.isManualWeight}`);
        
        // Calculate YTD performance if both prices are provided
        if (stockData.ytdStartPrice && stockData.currentPrice) {
          const ytdStart = parseFloat(stockData.ytdStartPrice);
          const current = parseFloat(stockData.currentPrice);
          if (ytdStart > 0 && current > 0) {
            const ytdPerf = ((current - ytdStart) / ytdStart) * 100;
            stockData.ytdPerformance = ytdPerf.toFixed(2);
          }
        }
        
        // Generate AI moats if not provided (with timeout)
        if (!stockData.moat1 || !stockData.moat2 || !stockData.moat3) {
          try {
            const prompt = `Generate 3 concise investment reasons (moats/competitive advantages) for ${stockData.companyName} (${stockData.ticker}). Each reason should be 1-2 sentences explaining a key competitive advantage. Format as JSON: {"moat1": "...", "moat2": "...", "moat3": "..."}`;
            
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error("AI timeout")), 5000)
            );
            
            const llmPromise = invokeLLM({
              messages: [{ role: "user", content: prompt }],
              responseFormat: { type: "json_object" },
            });
            
            const response = await Promise.race([llmPromise, timeoutPromise]) as any;
            
            const content = response.choices[0]?.message?.content || "{}";
            const moats = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
            stockData.moat1 = moats.moat1 || "Competitive advantage 1";
            stockData.moat2 = moats.moat2 || "Competitive advantage 2";
            stockData.moat3 = moats.moat3 || "Competitive advantage 3";
          } catch (error) {
            console.error("[AI Moats] Failed to generate moats:", error);
            // Use default moats if generation fails
            stockData.moat1 = "Competitive advantage 1";
            stockData.moat2 = "Competitive advantage 2";
            stockData.moat3 = "Competitive advantage 3";
          }
        }
        
        await insertStock(stockData);
        
        // Log transaction with comment
        await logTransaction({
          action: "add",
          ticker: stockData.ticker,
          companyName: stockData.companyName,
          details: JSON.stringify({ category: stockData.category, price: stockData.currentPrice }),
          newValue: stockData.portfolioWeight || "0",
          comment: stockData.comment || null,
        });
        
        // Send WhatsApp notification if enabled
        if (ctx.user) {
          // Load fresh user data from DB
          const { getDb } = await import("./db");
          const { users } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          const db = await getDb();
          if (db) {
            const [freshUser] = await db.select().from(users).where(eq(users.openId, ctx.user.openId)).limit(1);
            if (freshUser) {
              await notifyTransaction(
                freshUser.mobile,
                freshUser.whatsappAlerts === 1,
                "add",
                stockData.ticker,
                stockData.companyName,
                {
                  newWeight: stockData.portfolioWeight,
                  comment: stockData.comment,
                }
              );
            }
          }
        }
        
        // Recalculate weights: redistribute other stocks
        await recalculateWeights(stockData.ticker, false);
        
        return { success: true };
      }),
    update: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "ticker" in val) return val;
        throw new Error("Invalid input");
      })
      .mutation(async ({ input, ctx }) => {
        const { updateStock, getStockByTicker, logTransaction } = await import("./db");
        const { notifyTransaction } = await import("./services/whatsapp");
        const { ticker, ...updates } = input as any;
        
        // Get old values before update
        const oldStock = await getStockByTicker(ticker);
        
        // Check if portfolioWeight is being updated
        const hasWeightUpdate = "portfolioWeight" in updates;
        
        // Calculate YTD performance if both prices are provided
        if (updates.ytdStartPrice && updates.currentPrice) {
          const ytdStart = parseFloat(updates.ytdStartPrice);
          const current = parseFloat(updates.currentPrice);
          if (ytdStart > 0 && current > 0) {
            const ytdPerf = ((current - ytdStart) / ytdStart) * 100;
            updates.ytdPerformance = ytdPerf.toFixed(2);
          }
        } else if (updates.ytdStartPrice && oldStock?.currentPrice) {
          const ytdStart = parseFloat(updates.ytdStartPrice);
          const current = parseFloat(oldStock.currentPrice);
          if (ytdStart > 0 && current > 0) {
            const ytdPerf = ((current - ytdStart) / ytdStart) * 100;
            updates.ytdPerformance = ytdPerf.toFixed(2);
          }
        } else if (updates.currentPrice && oldStock?.ytdStartPrice) {
          const ytdStart = parseFloat(oldStock.ytdStartPrice);
          const current = parseFloat(updates.currentPrice);
          if (ytdStart > 0 && current > 0) {
            const ytdPerf = ((current - ytdStart) / ytdStart) * 100;
            updates.ytdPerformance = ytdPerf.toFixed(2);
          }
        }
        
        await updateStock(ticker, updates);
        
        // Log transaction with comment
        if (hasWeightUpdate) {
          await logTransaction({
            action: "update_weight",
            ticker,
            companyName: oldStock?.companyName || ticker,
            details: "Portfolio weight updated",
            oldValue: oldStock?.portfolioWeight || "0",
            newValue: updates.portfolioWeight,
            comment: updates.comment || null,
          });
          
          // Send WhatsApp notification for weight update
          if (ctx.user) {
            // Load fresh user data from DB to get latest mobile/whatsappAlerts
            const { getDb } = await import("./db");
            const { users } = await import("../drizzle/schema");
            const { eq } = await import("drizzle-orm");
            const db = await getDb();
            if (db) {
              const [freshUser] = await db.select().from(users).where(eq(users.openId, ctx.user.openId)).limit(1);
              if (freshUser) {
                await notifyTransaction(
                  freshUser.mobile,
                  freshUser.whatsappAlerts === 1,
                  "update_weight",
                  ticker,
                  oldStock?.companyName || ticker,
                  {
                    oldWeight: oldStock?.portfolioWeight || undefined,
                    newWeight: updates.portfolioWeight,
                    comment: updates.comment || undefined,
                  }
                );
              }
            }
          }
        } else {
          await logTransaction({
            action: "update_data",
            ticker,
            companyName: oldStock?.companyName || ticker,
            details: JSON.stringify(updates),
            comment: updates.comment || null,
          });
        }
        
        // If weight was manually updated, recalculate other weights
        if (hasWeightUpdate) {
          await recalculateWeights(ticker, false);
        }
        
        return { success: true };
      }),
    delete: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "ticker" in val) return val;
        throw new Error("Invalid input");
      })
      .mutation(async ({ input, ctx }) => {
        const { deleteStock, getStockByTicker, logTransaction } = await import("./db");
        const { notifyTransaction } = await import("./services/whatsapp");
        const { ticker, comment } = input as { ticker: string; comment?: string };
        
        // Get stock data before deletion
        const stock = await getStockByTicker(ticker);
        
        await deleteStock(ticker);
        
        // Log transaction with comment
        if (stock) {
          await logTransaction({
            action: "delete",
            ticker,
            companyName: stock.companyName,
            details: JSON.stringify({ category: stock.category, weight: stock.portfolioWeight }),
            oldValue: stock.portfolioWeight || "0",
            comment: comment || null,
          });
          
          // Send WhatsApp notification
          if (ctx.user) {
            // Load fresh user data from DB
            const { getDb } = await import("./db");
            const { users } = await import("../drizzle/schema");
            const { eq } = await import("drizzle-orm");
            const db = await getDb();
            if (db) {
              const [freshUser] = await db.select().from(users).where(eq(users.openId, ctx.user.openId)).limit(1);
              if (freshUser) {
                await notifyTransaction(
                  freshUser.mobile,
                  freshUser.whatsappAlerts === 1,
                  "delete",
                  ticker,
                  stock.companyName,
                  {
                    comment: comment || undefined,
                  }
                );
              }
            }
          }
        }
        
        // Recalculate weights: redistribute all remaining stocks equally to 100%
        await recalculateWeights(undefined, true);
        
        return { success: true };
      }),
    refreshData: protectedProcedure.mutation(async () => {
      // Optimized refresh with parallel processing (Nov 13, 2025)
      console.log('[RefreshData] Starting refresh...');
      const { getAllStocks, updateStock } = await import("./db");
      
      const stocks = await getAllStocks();
      console.log(`[RefreshData] Found ${stocks.length} stocks to update`);
      
      // Start background refresh process
      const refreshPromise = (async () => {
        let updated = 0;
        let failed = 0;
        const errors: string[] = [];
        
        // Process stocks in batches of 10 with parallel execution
        const BATCH_SIZE = 10;
        const CONCURRENT_LIMIT = 5;
        
        for (let i = 0; i < stocks.length; i += BATCH_SIZE) {
          const batch = stocks.slice(i, i + BATCH_SIZE);
          console.log(`[RefreshData] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(stocks.length / BATCH_SIZE)}`);
          
          // Process batch with concurrency limit
          const batchPromises = [];
          for (let j = 0; j < batch.length; j += CONCURRENT_LIMIT) {
            const chunk = batch.slice(j, j + CONCURRENT_LIMIT);
            const chunkPromises = chunk.map(async (stock) => {
              try {
                const region = stock.ticker.endsWith(".SW") ? "CH" : "US";
                
                // Fetch price & risk metrics from Yahoo Finance
                const metrics = await fetchStockMetrics(stock.ticker, region);
                
                // Fetch fundamental data from EODHD
                const fundamentals = await fetchEODHDFundamentals(stock.ticker);
                
                const updateData: any = {
                  lastDataRefresh: new Date(),
                };
                
                // Update price data
                if (metrics.currentPrice !== null) {
                  updateData.currentPrice = metrics.currentPrice.toFixed(2);
                  
                  // Recalculate YTD performance
                  if (stock.ytdStartPrice) {
                    const ytdStart = parseFloat(stock.ytdStartPrice);
                    if (ytdStart > 0) {
                      const ytdPerf = ((metrics.currentPrice - ytdStart) / ytdStart) * 100;
                      updateData.ytdPerformance = ytdPerf.toFixed(2);
                    }
                  }
                }
                
                if (metrics.currency) updateData.currency = metrics.currency;
                
                // Update fundamentals from EODHD
                if (fundamentals.pegRatio !== null && !isNaN(fundamentals.pegRatio) && fundamentals.pegRatio > 0) {
                  updateData.pegRatio = fundamentals.pegRatio.toFixed(2);
                } else if (fundamentals.peRatio !== null && fundamentals.peRatio > 0) {
                  // Calculate PEG from P/E and earnings growth if EODHD doesn't provide it
                  try {
                    const earningsGrowth = fundamentals.earningsGrowth;
                    if (earningsGrowth && earningsGrowth > 0) {
                      const calculatedPEG = fundamentals.peRatio / (earningsGrowth * 100);
                      if (calculatedPEG > 0 && calculatedPEG < 10) { // Sanity check
                        updateData.pegRatio = calculatedPEG.toFixed(2);
                      }
                    }
                  } catch (error) {
                    // Silently fail PEG calculation
                  }
                }
                if (fundamentals.peRatio !== null && !isNaN(fundamentals.peRatio)) {
                  updateData.peRatio = fundamentals.peRatio.toFixed(2);
                }
                // Use helper function with 3-tier fallback
                const dividendYield = await fetchDividendYieldWithFallback(stock.ticker, fundamentals.dividendYield);
                if (dividendYield !== null) {
                  updateData.dividendYield = dividendYield.toFixed(2);
                }
                
                // Update risk metrics from Yahoo
                if (metrics.sharpeRatio !== null) updateData.sharpeRatio = metrics.sharpeRatio.toFixed(2);
                if (metrics.volatility !== null) updateData.volatility = metrics.volatility.toFixed(2);
                if (metrics.beta !== null || fundamentals.beta !== null) {
                  const beta = metrics.beta !== null ? metrics.beta : fundamentals.beta;
                  if (beta !== null) updateData.beta = beta.toFixed(2);
                }
                
                // Update 52-week range
                if (metrics.week52High !== null) updateData.week52High = metrics.week52High.toFixed(2);
                if (metrics.week52Low !== null) updateData.week52Low = metrics.week52Low.toFixed(2);
                
                // Update market cap
                const marketCap = metrics.marketCap !== null ? metrics.marketCap : fundamentals.marketCap;
                if (marketCap !== null) {
                  const marketCapB = marketCap / 1_000_000_000;
                  updateData.marketCap = marketCapB.toFixed(2);
                }
                
                await updateStock(stock.ticker, updateData);
                updated++;
                
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));
              } catch (error: any) {
                console.error(`[Refresh] Failed to update ${stock.ticker}:`, error);
                failed++;
                errors.push(`${stock.ticker}: ${error.message}`);
              }
            });
            
            await Promise.all(chunkPromises);
          }
          
          // Delay between batches to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log(`[RefreshData] Completed: ${updated} updated, ${failed} failed`);
        
        // Trigger news update in background
        try {
          const { updateNewsForAllStocks } = await import("./newsUpdater");
          updateNewsForAllStocks().catch((error: any) => {
            console.error("[Refresh] News update failed:", error);
          });
        } catch (error) {
          console.error("[Refresh] Failed to trigger news update:", error);
        }
        
        return { updated, failed, errors };
      })();
      
      // Don't wait for completion - return immediately
      refreshPromise.catch(error => {
        console.error('[RefreshData] Background refresh failed:', error);
      });
      
      return { 
        success: true, 
        message: `Aktualisierung von ${stocks.length} Aktien gestartet. Dies läuft im Hintergrund und dauert ca. ${Math.ceil(stocks.length / 5)} Minuten. Bitte Seite in einigen Minuten neu laden.`,
        total: stocks.length,
      };
    }),
    refreshStockData: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "string") return val;
        throw new Error("Invalid ticker");
      })
      .mutation(async ({ input: ticker }) => {
        console.log(`[RefreshStockData] Refreshing data for ${ticker}`);
        const { getStockByTicker, updateStock } = await import("./db");
        
        const stock = await getStockByTicker(ticker);
        if (!stock) {
          throw new Error(`Stock ${ticker} not found`);
        }
        
        try {
          const region = ticker.endsWith(".SW") ? "CH" : "US";
          
          // Fetch price & risk metrics from Yahoo Finance
          const metrics = await fetchStockMetrics(ticker, region);
          
          // Fetch fundamental data from EODHD
          const fundamentals = await fetchEODHDFundamentals(ticker);
          
          const updateData: any = {
            lastDataRefresh: new Date(),
          };
          
          // Update price data
          if (metrics.currentPrice !== null) {
            updateData.currentPrice = metrics.currentPrice.toFixed(2);
            
            // Recalculate YTD performance (do NOT set ytdStartPrice - only update via YTD cron job)
            if (stock.ytdStartPrice && stock.ytdStartPrice !== "0") {
              const ytdStart = parseFloat(stock.ytdStartPrice);
              if (ytdStart > 0) {
                const ytdPerf = ((metrics.currentPrice - ytdStart) / ytdStart) * 100;
                updateData.ytdPerformance = ytdPerf.toFixed(2);
              }
            }
          }
          
          if (metrics.currency) updateData.currency = metrics.currency;
          
          // Update fundamentals from EODHD
          if (fundamentals.pegRatio !== null && !isNaN(fundamentals.pegRatio) && fundamentals.pegRatio > 0) {
            updateData.pegRatio = fundamentals.pegRatio.toFixed(2);
          } else if (fundamentals.peRatio !== null && fundamentals.peRatio > 0) {
            // Calculate PEG from P/E and earnings growth if EODHD doesn't provide it
            try {
              const earningsGrowth = fundamentals.earningsGrowth;
              if (earningsGrowth && earningsGrowth > 0) {
                const calculatedPEG = fundamentals.peRatio / (earningsGrowth * 100);
                if (calculatedPEG > 0 && calculatedPEG < 10) { // Sanity check
                  updateData.pegRatio = calculatedPEG.toFixed(2);
                  console.log(`[Refresh] Calculated PEG for ${stock.ticker}: ${calculatedPEG.toFixed(2)}`);
                }
              }
            } catch (error) {
              console.warn(`[Refresh] Could not calculate PEG for ${stock.ticker}:`, error);
            }
          }
          if (fundamentals.peRatio !== null && !isNaN(fundamentals.peRatio)) {
            updateData.peRatio = fundamentals.peRatio.toFixed(2);
          }
          // Use helper function with 3-tier fallback
          const dividendYield = await fetchDividendYieldWithFallback(stock.ticker, fundamentals.dividendYield);
          if (dividendYield !== null) {
            updateData.dividendYield = dividendYield.toFixed(2);
          }
          
          // Update risk metrics from Yahoo
          if (metrics.sharpeRatio !== null) updateData.sharpeRatio = metrics.sharpeRatio.toFixed(2);
          if (metrics.volatility !== null) updateData.volatility = metrics.volatility.toFixed(2);
          if (metrics.beta !== null || fundamentals.beta !== null) {
            const beta = metrics.beta !== null ? metrics.beta : fundamentals.beta;
            if (beta !== null) updateData.beta = beta.toFixed(2);
          }
          
          // Update 52-week range
          if (metrics.week52High !== null) updateData.week52High = metrics.week52High.toFixed(2);
          if (metrics.week52Low !== null) updateData.week52Low = metrics.week52Low.toFixed(2);
          
          // Update market cap
          const marketCap = metrics.marketCap !== null ? metrics.marketCap : fundamentals.marketCap;
          if (marketCap !== null) {
            const marketCapB = marketCap / 1_000_000_000;
            updateData.marketCap = marketCapB.toFixed(2);
          }
          
          // Update sector and industry from EODHD
          if (fundamentals.sector) updateData.sector = fundamentals.sector;
          if (fundamentals.industry) updateData.industry = fundamentals.industry;
          if (fundamentals.companyName) updateData.companyName = fundamentals.companyName;
          
          // TODO: Calculate YTD Performance automatically from historical data
          // Currently YTD is calculated in fetchStockData and stored in ytdStartPrice/ytdPerformance
          // Uncomment when fetchEODHDHistorical is implemented
          /*
          if (metrics.currentPrice && metrics.currentPrice > 0) {
            try {
              const { fetchEODHDHistorical } = await import("./_core/eodhdApi");
              const lastYear = new Date().getFullYear() - 1;
              const ytdStartDate = `${lastYear}-12-31`;
              const historicalData = await fetchEODHDHistorical(ticker, ytdStartDate, ytdStartDate);
              
              if (historicalData && historicalData.length > 0) {
                const ytdStartPrice = historicalData[0].close;
                if (ytdStartPrice > 0) {
                  const ytdPerformance = ((metrics.currentPrice - ytdStartPrice) / ytdStartPrice) * 100;
                  updateData.ytdStartPrice = ytdStartPrice.toFixed(2);
                  updateData.ytdPerformance = ytdPerformance.toFixed(2);
                  console.log(`[RefreshStockData] YTD Performance calculated for ${ticker}: ${ytdPerformance.toFixed(2)}%`);
                }
              }
            } catch (ytdError) {
              console.warn(`[RefreshStockData] Could not calculate YTD for ${ticker}:`, ytdError);
            }
          }
          */
          
          await updateStock(ticker, updateData);
          
          console.log(`[RefreshStockData] Successfully updated ${ticker}`);
          return { success: true, message: `${ticker} erfolgreich aktualisiert` };
        } catch (error: any) {
          console.error(`[RefreshStockData] Failed to update ${ticker}:`, error);
          throw new Error(`Failed to refresh ${ticker}: ${error.message}`);
        }
      }),
    portfolioPerformance: publicProcedure.query(async () => {
      const { getAllStocks } = await import("./db");
      const { calculatePortfolioPerformance } = await import("./_core/stockDataApi");
      
      const stocks = await getAllStocks();
      
      if (stocks.length === 0) {
        return [];
      }
      
      // Map stocks to format expected by calculatePortfolioPerformance
      const stocksForPerformance = stocks.map(s => ({
        ticker: s.ticker,
        portfolioWeight: s.portfolioWeight || '0'
      }));
      
      const performance = await calculatePortfolioPerformance(stocksForPerformance);
      return performance;
    }),
    findCompetitors: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "ticker" in val && "name" in val && "category" in val) {
          return val as { ticker: string; name: string; category: string };
        }
        throw new Error("Invalid input: ticker, name, and category required");
      })
      .mutation(async ({ input }) => {
        const { findCompetitors } = await import("./_core/competitorAnalyzer");
        const { getAllStocks } = await import("./db");
        
        // Get all existing tickers to prevent duplicates
        const existingStocks = await getAllStocks();
        const existingTickers = existingStocks.map(s => s.ticker);
        
        console.log(`[FindCompetitors] Analyzing ${input.ticker}...`);
        const analysis = await findCompetitors(input.ticker, input.name, input.category, existingTickers);
        
        return analysis;
      }),
    dailyNews: publicProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "ticker" in val && "companyName" in val) {
          return val as { ticker: string; companyName: string };
        }
        throw new Error("Invalid input: ticker and companyName required");
      })
      .query(async ({ input }) => {
        const { generateDailyNews } = await import("./_core/aiDailyNews");
        return await generateDailyNews(input.ticker, input.companyName);
      }),
    importPrices: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null) return val;
        throw new Error("Invalid input");
      })
      .mutation(async ({ input }) => {
        const { getAllStocks, updateStock, getStockByTicker } = await import("./db");
        const data = input as any;
        
        // Parse Excel/CSV file from base64
        const base64Data = data.fileData.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        
        let parsedData: any[] = [];
        
        try {
          // Check if it's CSV or Excel
          if (data.fileName.endsWith('.csv')) {
            // Parse CSV
            const csvText = buffer.toString('utf-8');
            const lines = csvText.split('\n').filter(line => line.trim());
            const headers = lines[0].split(/[,;\t]/).map(h => h.trim().toLowerCase());
            
            const tickerIdx = headers.findIndex(h => h.includes('ticker') || h.includes('symbol'));
            const priceIdx = headers.findIndex(h => h.includes('price') || h.includes('kurs') || h.includes('close'));
            const companyIdx = headers.findIndex(h => h.includes('company') || h.includes('firma') || h.includes('name'));
            
            if (tickerIdx === -1 || priceIdx === -1) {
              throw new Error("CSV muss 'Ticker' und 'Price' Spalten enthalten");
            }
            
            for (let i = 1; i < lines.length; i++) {
              const values = lines[i].split(/[,;\t]/).map(v => v.trim());
              if (values.length > Math.max(tickerIdx, priceIdx)) {
                parsedData.push({
                  ticker: values[tickerIdx],
                  price: values[priceIdx],
                  company: companyIdx >= 0 ? values[companyIdx] : '',
                });
              }
            }
          } else {
            // Parse Excel using xlsx package
            const XLSX = await import('xlsx');
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet);
            
            // Find ticker and price columns (case-insensitive)
            parsedData = jsonData.map((row: any) => {
              const keys = Object.keys(row).map(k => k.toLowerCase());
              const tickerKey = Object.keys(row).find(k => 
                k.toLowerCase().includes('ticker') || k.toLowerCase().includes('symbol')
              );
              const priceKey = Object.keys(row).find(k => 
                k.toLowerCase().includes('price') || k.toLowerCase().includes('kurs') || k.toLowerCase().includes('close')
              );
              const companyKey = Object.keys(row).find(k => 
                k.toLowerCase().includes('company') || k.toLowerCase().includes('firma') || k.toLowerCase().includes('name')
              );
              
              return {
                ticker: tickerKey ? row[tickerKey] : '',
                price: priceKey ? row[priceKey] : '',
                company: companyKey ? row[companyKey] : '',
              };
            }).filter((item: any) => item.ticker && item.price);
          }
        } catch (error: any) {
          throw new Error(`Fehler beim Parsen der Datei: ${error.message}`);
        }
        
        const results: any[] = [];
        let successCount = 0;
        
        // Update stocks
        for (const item of parsedData) {
          try {
            const stock = await getStockByTicker(item.ticker);
            
            if (!stock) {
              results.push({
                ticker: item.ticker,
                companyName: item.company,
                status: 'not_found',
                message: 'Aktie nicht im Portfolio gefunden',
              });
              continue;
            }
            
            const newPrice = parseFloat(item.price.toString().replace(/[^0-9.-]/g, ''));
            if (isNaN(newPrice)) {
              results.push({
                ticker: item.ticker,
                companyName: stock.companyName,
                status: 'error',
                message: 'Ungültiger Preis',
              });
              continue;
            }
            
            // Update based on import type
            if (data.importType === 'ytd') {
              await updateStock(item.ticker, {
                ytdStartPrice: newPrice.toString(),
              });
              
              // Calculate YTD performance if current price exists
              if (stock.currentPrice) {
                const currentPrice = parseFloat(stock.currentPrice);
                const ytdPerf = ((currentPrice - newPrice) / newPrice) * 100;
                await updateStock(item.ticker, {
                  ytdPerformance: ytdPerf.toFixed(2),
                });
              }
            } else {
              await updateStock(item.ticker, {
                currentPrice: newPrice.toString(),
              });
              
              // Calculate YTD performance if ytdStartPrice exists
              if (stock.ytdStartPrice) {
                const ytdStart = parseFloat(stock.ytdStartPrice);
                const ytdPerf = ((newPrice - ytdStart) / ytdStart) * 100;
                await updateStock(item.ticker, {
                  ytdPerformance: ytdPerf.toFixed(2),
                });
              }
            }
            
            results.push({
              ticker: item.ticker,
              companyName: stock.companyName,
              status: 'success',
              message: `${data.importType === 'ytd' ? 'YTD Start-Preis' : 'Aktueller Kurs'} aktualisiert`,
              oldPrice: data.importType === 'ytd' ? stock.ytdStartPrice : stock.currentPrice,
              newPrice: newPrice.toString(),
            });
            successCount++;
          } catch (error: any) {
            results.push({
              ticker: item.ticker,
              companyName: item.company,
              status: 'error',
              message: error.message,
            });
          }
        }
        
        return {
          success: true,
          totalCount: parsedData.length,
          successCount,
          results,
        };
      }),
  }),

  news: router({
    getByTicker: publicProcedure
      .input((val: unknown) => {
        if (typeof val === "string") return val;
        throw new Error("Invalid ticker");
      })
      .query(async ({ input }) => {
        const { getNewsByTicker } = await import("./db");
        return await getNewsByTicker(input, 10);
      }),
    getAll: publicProcedure.query(async () => {
      const { getAllNews } = await import("./db");
      return await getAllNews(50);
    }),
  }),

  transactions: router({
    list: publicProcedure.query(async () => {
      const { getAllTransactions } = await import("./db");
      return await getAllTransactions();
    }),
    deleteAll: protectedProcedure.mutation(async () => {
      const { deleteAllTransactions } = await import("./db");
      await deleteAllTransactions();
      return { success: true };
    }),
  }),

  research: router({
    list: publicProcedure.query(async () => {
      const { getDb } = await import("./db");
      const { research } = await import("../drizzle/schema");
      const { desc } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];
      const results = await db.select().from(research).orderBy(desc(research.createdAt));
      return results;
    }),
    add: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null) return val;
        throw new Error("Invalid input");
      })
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const { research } = await import("../drizzle/schema");
        const { storagePut } = await import("./storage");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const data = input as any;
        
        let fileUrl = "";
        
        // If file data is provided, upload to S3
        if (data.fileUrl && data.fileUrl.startsWith("data:")) {
          try {
            // Extract base64 data
            const matches = data.fileUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              const contentType = matches[1];
              const base64Data = matches[2];
              const buffer = Buffer.from(base64Data, 'base64');
              
              // Generate unique filename
              const timestamp = Date.now();
              const ext = data.fileName.split('.').pop() || 'bin';
              const key = `research/${timestamp}-${data.fileName}`;
              
              // Upload to S3
              const result = await storagePut(key, buffer, contentType);
              fileUrl = result.url;
            }
          } catch (error: any) {
            console.error("[Research] File upload failed:", error);
            throw new Error(`Datei-Upload fehlgeschlagen: ${error.message}`);
          }
        }
        
        await db.insert(research).values({
          title: data.title,
          content: data.content || "",
          fileUrl: fileUrl,
          fileType: data.fileType || "text",
          fileName: data.fileName || "",
        });
        
        return { success: true };
      }),    delete: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "number") return val;
        throw new Error("Invalid input");
      })
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const { research } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.delete(research).where(eq(research.id, input));
        return { success: true };
      }),
  }),

  alerts: router({
    createRule: protectedProcedure
      .input((val: unknown) => {
        if (typeof val !== 'object' || val === null) throw new Error('Invalid input');
        const input = val as any;
        return {
          ticker: typeof input.ticker === 'string' ? input.ticker : undefined,
          metricName: input.metricName,
          condition: input.condition,
          threshold: input.threshold,
          notificationMethod: input.notificationMethod || 'email',
        };
      })
      .mutation(async ({ ctx, input }) => {
        const { createAlertRule } = await import("./_core/alertSystem");
        const ruleId = await createAlertRule({
          userId: ctx.user.id,
          ...input,
        });
        return { success: true, ruleId };
      }),
    
    getMyRules: protectedProcedure
      .query(async ({ ctx }) => {
        const { getUserAlertRules } = await import("./_core/alertSystem");
        return await getUserAlertRules(ctx.user.id);
      }),
    
    getMyHistory: protectedProcedure
      .input((val: unknown) => {
        if (typeof val !== 'object' || val === null) return { limit: 50 };
        const input = val as any;
        return {
          limit: typeof input.limit === 'number' ? input.limit : 50,
        };
      })
      .query(async ({ ctx, input }) => {
        const { getUserAlertHistory } = await import("./_core/alertSystem");
        return await getUserAlertHistory(ctx.user.id, input.limit);
      }),
  }),

  admin: router({
    exportData: protectedProcedure.query(async () => {
      const { getAllStocks, getDb } = await import("./db");
      const { research, transactions } = await import("../drizzle/schema");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const stocks = await getAllStocks();
      const researchData = await db.select().from(research);
      const transactionsData = await db.select().from(transactions);
      
      return {
        exportDate: new Date().toISOString(),
        version: "1.0",
        data: {
          stocks,
          research: researchData,
          transactions: transactionsData,
        },
      };
    }),
    importData: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null) return val;
        throw new Error("Invalid input");
      })
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const { stocks, research, transactions } = await import("../drizzle/schema");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const importData = input as any;
        const { stocks: stocksData, research: researchData, transactions: transactionsData } = importData.data;
        
        // Delete existing data
        await db.delete(transactions);
        await db.delete(research);
        await db.delete(stocks);
        
        // Import new data
        let importedStocks = 0;
        let importedResearch = 0;
        let importedTransactions = 0;
        
        if (stocksData && stocksData.length > 0) {
          const stocksToInsert = stocksData.map((s: any) => {
            const { id, createdAt, updatedAt, ...rest } = s;
            return rest;
          });
          await db.insert(stocks).values(stocksToInsert);
          importedStocks = stocksData.length;
        }
        
        if (researchData && researchData.length > 0) {
          const researchToInsert = researchData.map((r: any) => {
            const { id, createdAt, updatedAt, ...rest } = r;
            return rest;
          });
          await db.insert(research).values(researchToInsert);
          importedResearch = researchData.length;
        }
        
        if (transactionsData && transactionsData.length > 0) {
          const transactionsToInsert = transactionsData.map((t: any) => {
            const { id, createdAt, ...rest } = t;
            return rest;
          });
          await db.insert(transactions).values(transactionsToInsert);
          importedTransactions = transactionsData.length;
        }
        
        return {
          success: true,
          imported: {
            stocks: importedStocks,
            research: importedResearch,
            transactions: importedTransactions,
          },
        };
      }),
    bulkUpdateSwissStocks: protectedProcedure.mutation(async ({ ctx }) => {
      // Only admin can run bulk updates
      if (ctx.user?.role !== 'admin') {
        throw new Error('Unauthorized: Admin access required');
      }

      const { getDb } = await import("./db");
      const { stocks } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const { fetchCompleteStockData } = await import("./_core/multiApiDataMerger");
      
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get all Swiss stocks
      const allStocks = await db.select().from(stocks);
      const swissStocks = allStocks.filter(s => s.ticker.endsWith('.SW'));

      console.log(`[Bulk Update] Found ${swissStocks.length} Swiss stocks`);

      let updatedCount = 0;
      let failedCount = 0;
      const results: any[] = [];

      for (const stock of swissStocks) {
        try {
          console.log(`[${stock.ticker}] Fetching data...`);
          
          // Get complete data from multiApiDataMerger
          const completeData = await fetchCompleteStockData(stock.ticker);

          // Prepare update data
          const updateData: any = {};

          // Update price and currency
          if (completeData.currentPrice !== null) {
            updateData.currentPrice = completeData.currentPrice.toString();
          }
          if (completeData.currency) {
            updateData.currency = completeData.currency;
          }

          // Update Sharpe Ratio
          if (completeData.sharpe !== null && completeData.sharpe !== undefined) {
            updateData.sharpeRatio = completeData.sharpe.toString();
          }

          // Update other metrics
          if (completeData.pe !== null) updateData.peRatio = completeData.pe.toString();
          if (completeData.peg !== null) updateData.pegRatio = completeData.peg.toString();
          if (completeData.dividendYield !== null) updateData.dividendYield = completeData.dividendYield.toString();
          if (completeData.beta !== null) updateData.beta = completeData.beta.toString();
          if (completeData.volatility !== null) updateData.volatility = completeData.volatility.toString();

          // Update timestamp
          updateData.lastDataRefresh = new Date();

          // Execute update
          if (Object.keys(updateData).length > 1) {
            await db.update(stocks)
              .set(updateData)
              .where(eq(stocks.ticker, stock.ticker));
            
            console.log(`  ✅ Updated ${stock.ticker}`);
            updatedCount++;
            results.push({ ticker: stock.ticker, status: 'success', updates: updateData });
          }

          // Rate limiting: wait 500ms between requests
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error: any) {
          console.error(`  ❌ Failed ${stock.ticker}:`, error.message);
          failedCount++;
          results.push({ ticker: stock.ticker, status: 'failed', error: error.message });
        }
      }

      return {
        success: true,
        total: swissStocks.length,
        updated: updatedCount,
        failed: failedCount,
        results,
      };
    }),
    triggerDailyRefresh: protectedProcedure.mutation(async ({ ctx }) => {
      // Only admin can trigger daily refresh
      if (ctx.user?.role !== 'admin') {
        throw new Error('Unauthorized: Admin access required');
      }

      const { refreshAllStocks } = await import("./_core/dailyRefreshCron");
      const result = await refreshAllStocks();
      
      return result;
    }),
    getDataQualityMetrics: protectedProcedure.query(async ({ ctx }) => {
      // Only admin can view data quality metrics
      if (ctx.user?.role !== 'admin') {
        throw new Error('Unauthorized: Admin access required');
      }

      const { calculateDataQualityMetrics } = await import("./_core/dataQualityMetrics");
      const metrics = await calculateDataQualityMetrics();
      
      return metrics;
    }),
    
    triggerYTDUpdate: protectedProcedure.mutation(async ({ ctx }) => {
      // Only admin can trigger YTD update
      if (ctx.user?.role !== 'admin') {
        throw new Error('Unauthorized: Admin access required');
      }

      const { manualYTDUpdate } = await import("./cron/ytdUpdater");
      await manualYTDUpdate();
      
      return { success: true, message: "YTD update completed" };
    }),
    
    refreshPrices: protectedProcedure.query(async ({ ctx }) => {
      // Only admin can refresh prices
      if (ctx.user?.role !== 'admin') {
        throw new Error('Unauthorized: Admin access required');
      }

      const { refreshAllStocks } = await import("./_core/dailyRefreshCron");
      await refreshAllStocks();
      
      return { success: true, message: "Prices refreshed successfully" };
    }),
    
    refreshCharts: protectedProcedure.query(async ({ ctx }) => {
      // Only admin can refresh charts
      if (ctx.user?.role !== 'admin') {
        throw new Error('Unauthorized: Admin access required');
      }

      // Charts are updated via refreshAllStocks
      const { refreshAllStocks } = await import("./_core/dailyRefreshCron");
      await refreshAllStocks();
      
      return { success: true, message: "Charts refreshed successfully" };
    }),
    
    refreshNews: protectedProcedure.query(async ({ ctx }) => {
      // Only admin can refresh news
      if (ctx.user?.role !== 'admin') {
        throw new Error('Unauthorized: Admin access required');
      }

      // News updates are disabled (memory optimization)
      return { success: true, message: "News updates are currently disabled for memory optimization" };
    }),
  }),

  newsletter: router({
    subscribe: publicProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "email" in val) {
          return val as { email: string };
        }
        throw new Error("Invalid email");
      })
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const { newsletter } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { email } = input;
        
        try {
          // Check if already subscribed
          const existing = await db.select().from(newsletter).where(eq(newsletter.email, email)).limit(1);
          
          if (existing.length > 0) {
            if (existing[0].isActive) {
              return { success: false, message: "Diese Email ist bereits registriert." };
            } else {
              // Reactivate subscription
              await db.update(newsletter)
                .set({ isActive: 1, subscribedAt: new Date() })
                .where(eq(newsletter.email, email));
              return { success: true, message: "Newsletter-Abonnement reaktiviert!" };
            }
          }
          
          // Insert new subscriber
          await db.insert(newsletter).values({ email });
          return { success: true, message: "Erfolgreich für den Newsletter registriert!" };
        } catch (error) {
          console.error("Newsletter subscription error:", error);
          return { success: false, message: "Fehler bei der Registrierung. Bitte versuchen Sie es später erneut." };
        }
      }),
    
    exportList: protectedProcedure
      .query(async () => {
        const { getDb } = await import("./db");
        const { newsletter } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const subscribers = await db.select().from(newsletter).where(eq(newsletter.isActive, 1));
        return { subscribers };
      }),
  }),

  payment: router({
    createCheckout: protectedProcedure
      .mutation(async ({ ctx }) => {
        const user = ctx.user;
        
        // Check if user has already paid
        if (user.hasPaid) {
          throw new Error("Sie haben bereits bezahlt.");
        }
        
        try {
          const Stripe = (await import("stripe")).default;
          const { getStripeSecretKey } = await import("./_core/env");
          
          const stripeKey = await getStripeSecretKey();
          if (!stripeKey) {
            throw new Error(`STRIPE_SECRET_KEY is not configured. Please add it via Admin > API Secrets or configure platform secrets.`);
          }
          
          const stripe = new Stripe(stripeKey, {
            apiVersion: "2024-11-20.acacia",
          });
          
          // Create Stripe checkout session
          const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [
              {
                price_data: {
                  currency: "chf",
                  product_data: {
                    name: "Portfolio BIG Vollzugriff",
                    description: "Einmaliger Zugriff auf alle Aktien und Analysen",
                  },
                  unit_amount: 1000, // CHF 10.00 in cents
                },
                quantity: 1,
              },
            ],
            mode: "payment",
            success_url: `${process.env.VITE_APP_URL || "http://localhost:3000"}?payment=success`,
            cancel_url: `${process.env.VITE_APP_URL || "http://localhost:3000"}?payment=cancelled`,
            client_reference_id: user.openId,
            metadata: {
              userId: user.openId,
              userEmail: user.email || "",
            },
          });
          
          return {
            success: true,
            message: "Checkout-Sitzung erstellt",
            checkoutUrl: session.url,
          };
        } catch (error: any) {
          console.error("Stripe checkout error:", error);
          throw new Error(`Fehler beim Erstellen der Zahlungssitzung: ${error.message}`);
        }
      }),
    
    verifyPayment: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "paymentId" in val) {
          return val as { paymentId: string };
        }
        throw new Error("Invalid payment ID");
      })
      .mutation(async ({ input, ctx }) => {
        // TODO: Verify payment with Stripe
        // For now, return placeholder
        return {
          success: false,
          message: "Payment verification not yet implemented",
        };
      }),
  }),

  contact: router({
    send: publicProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "name" in val && "email" in val && "message" in val) {
          return val as { name: string; email: string; message: string };
        }
        throw new Error("Invalid contact form data");
      })
      .mutation(async ({ input }) => {
        // TODO: Implement email sending logic here
        // For now, just log the contact form submission
        console.log("Contact form submission:", input);
        
        // You can integrate with an email service like SendGrid, Mailgun, or AWS SES
        // Example:
        // await sendEmail({
        //   to: "your-email@example.com",
        //   from: input.email,
        //   subject: `Contact from ${input.name}`,
        //   text: input.message,
        // });
        
        return {
          success: true,
          message: "Thank you for your message!",
        };
      }),
  }),

  savedPortfolios: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getSavedPortfolios, getPortfolioTransactions, getStockByTicker, getDb } = await import("./db");
      const portfolios = await getSavedPortfolios(ctx.user.id);
      
      // Batch load all stocks and historical prices for performance optimization
      const db = await getDb();
      if (!db) return portfolios;
      
      const { stocks: stocksTable, historicalPrices } = await import("../drizzle/schema");
      const { inArray, and, eq } = await import("drizzle-orm");
      
      // Get all unique tickers from all live portfolios
      const livePortfolios = portfolios.filter(p => p.isLive && p.liveStartDate);
      const allTickers = new Set<string>();
      const liveStartDates = new Set<string>();
      
      for (const portfolio of livePortfolios) {
        const transactions = await getPortfolioTransactions(portfolio.id);
        transactions.forEach((tx: any) => allTickers.add(tx.ticker));
        if (portfolio.liveStartDate) {
          liveStartDates.add(new Date(portfolio.liveStartDate).toISOString().split('T')[0]);
        }
      }
      
      // Batch load all stocks
      const allStocksData = allTickers.size > 0
        ? await db.select().from(stocksTable).where(inArray(stocksTable.ticker, Array.from(allTickers)))
        : [];
      const stocksMap = new Map(allStocksData.map(s => [s.ticker, s]));
      
      // Batch load all historical prices
      const allHistoricalPrices = (allTickers.size > 0 && liveStartDates.size > 0)
        ? await db.select().from(historicalPrices).where(
            and(
              inArray(historicalPrices.ticker, Array.from(allTickers)),
              inArray(historicalPrices.date, Array.from(liveStartDates))
            )
          )
        : [];
      const historicalPricesMap = new Map(
        allHistoricalPrices.map(hp => [`${hp.ticker}_${hp.date}`, hp])
      );
      
      // Calculate live performance for each live portfolio
      const portfoliosWithPerformance = await Promise.all(
        portfolios.map(async (portfolio) => {
          if (!portfolio.isLive || !portfolio.liveStartDate) {
            return portfolio;
          }
          
          try {
            const transactions = await getPortfolioTransactions(portfolio.id);
            if (transactions.length === 0) {
              return { ...portfolio, livePerformance: 0 };
            }
            
            // Calculate holdings and total invested from transactions
            const holdings: Record<string, number> = {};
            const costBasis: Record<string, { totalCost: number; totalShares: number }> = {};
            let totalDeposits = 0;  // Net capital from user (deposits - withdrawals)
            let totalInvestedInStocks = 0;  // Cost basis of current stock positions
            let totalBuyAmounts = 0;  // Total spent on buys
            let totalSellProceeds = 0;  // Total received from sells
            let totalDividends = 0;  // Total dividends received
            
            transactions.forEach((tx: any) => {
              const shares = parseFloat(tx.shares || '0');
              const price = parseFloat(tx.pricePerShare || '0');
              const amount = parseFloat(tx.totalAmountCHF || tx.totalAmount || '0');
              
              // Treat initial transactions as implicit deposits
              const isInitialTransaction = tx.notes && tx.notes.includes('Initial position');
              
              if (tx.transactionType === 'buy') {
                if (isInitialTransaction) {
                  totalDeposits += amount;  // Initial transactions are implicit deposits
                }
                holdings[tx.ticker] = (holdings[tx.ticker] || 0) + shares;
                totalBuyAmounts += amount;
                totalInvestedInStocks += amount;
                // Track cost basis
                if (!costBasis[tx.ticker]) {
                  costBasis[tx.ticker] = { totalCost: 0, totalShares: 0 };
                }
                costBasis[tx.ticker].totalCost += amount;
                costBasis[tx.ticker].totalShares += shares;
              } else if (tx.transactionType === 'sell') {
                holdings[tx.ticker] = (holdings[tx.ticker] || 0) - shares;
                totalSellProceeds += amount;
                // Reduce invested in stocks by cost basis of sold shares
                if (costBasis[tx.ticker] && costBasis[tx.ticker].totalShares > 0) {
                  const avgCost = costBasis[tx.ticker].totalCost / costBasis[tx.ticker].totalShares;
                  const soldCost = shares * avgCost;
                  totalInvestedInStocks -= soldCost;
                  costBasis[tx.ticker].totalCost -= soldCost;
                  costBasis[tx.ticker].totalShares -= shares;
                }
              } else if (tx.transactionType === 'deposit') {
                if (!isInitialTransaction) {  // Don't double-count initial transactions
                  totalDeposits += amount;
                }
              } else if (tx.transactionType === 'withdrawal') {
                totalDeposits -= Math.abs(amount);  // Reduce deposits by withdrawal amount
              } else if (tx.transactionType === 'dividend') {
                totalDividends += amount;
              }
            });
            
            // Fetch current prices and historical prices (in CHF)
            const db = await getDb();
            if (!db) {
              return portfolio;
            }
            
            const { getStockCurrency, convertToCHF } = await import("./fxHelper");
            
            let currentValueCHF = 0;
            let liveStartValueCHF = 0;
            const liveStartDate = new Date(portfolio.liveStartDate);
            const liveStartDateStr = liveStartDate.toISOString().split('T')[0];
            const todayStr = new Date().toISOString().split('T')[0];
            
            const { historicalPrices, realizedGains } = await import("../drizzle/schema");
            const { eq, and } = await import("drizzle-orm");
            
            for (const [ticker, shares] of Object.entries(holdings)) {
              if (shares > 0) {
                // Use pre-loaded stock data
                const stock = stocksMap.get(ticker);
                const currentPrice = stock ? parseFloat(stock.currentPrice || '0') : 0;
                const currency = stock?.currency || 'CHF';
                
                // Convert current value to CHF
                const currentValueLocal = shares * currentPrice;
                const currentValueInCHF = await convertToCHF(currentValueLocal, currency, todayStr);
                currentValueCHF += currentValueInCHF;
                
                // Use pre-loaded historical price
                const historicalPriceKey = `${ticker}_${liveStartDateStr}`;
                const historicalPrice = historicalPricesMap.get(historicalPriceKey);
                
                const liveStartPrice = historicalPrice?.close 
                  ? parseFloat(historicalPrice.close)
                  : currentPrice;
                
                // Convert live start value to CHF
                const liveStartValueLocal = shares * liveStartPrice;
                const liveStartValueInCHF = await convertToCHF(liveStartValueLocal, currency, liveStartDateStr);
                liveStartValueCHF += liveStartValueInCHF;
              }
            }
            
            // Calculate cash position
            // Cash = Deposits - Buys + Sells + Dividends
            const cashPosition = totalDeposits - totalBuyAmounts + totalSellProceeds + totalDividends;
            
            // Fetch realized gains for this portfolio
            let totalRealizedGains = 0;
            
            const gains = await db
              .select()
              .from(realizedGains)
              .where(eq(realizedGains.portfolioId, portfolio.id));
            
            // Sum all realized gains (realizedGain is in CHF, includes stock gain + FX gain)
            totalRealizedGains = gains.reduce((sum, gain) => sum + parseFloat(gain.realizedGain || '0'), 0);
            
            // Total current value = Market value of stocks + Cash
            const totalCurrentValue = currentValueCHF + cashPosition;
            
            // Calculate performance:
            // Performance = (Total Current Value - Total Deposits) / Total Deposits * 100
            // This shows how much the portfolio has grown relative to the capital invested
            const performance = totalDeposits > 0 
              ? ((totalCurrentValue - totalDeposits) / totalDeposits) * 100 
              : 0;
            
            return { ...portfolio, livePerformance: performance };
          } catch (error) {
            console.error(`Error calculating live performance for portfolio ${portfolio.id}:`, error);
            return portfolio;
          }
        })
      );
      
      return portfoliosWithPerformance;
    }),

    get: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "id" in val && typeof val.id === "number") {
          return val.id;
        }
        throw new Error("Invalid portfolio ID");
      })
      .query(async ({ input, ctx }) => {
        const { getSavedPortfolioById } = await import("./db");
        return await getSavedPortfolioById(input, ctx.user.id);
      }),

    create: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "name" in val && "portfolioData" in val) {
          return val as { name: string; description?: string; portfolioData: string };
        }
        throw new Error("Invalid portfolio data");
      })
      .mutation(async ({ input, ctx }) => {
        const { createSavedPortfolio } = await import("./db");
        return await createSavedPortfolio({
          userId: ctx.user.id,
          name: input.name,
          description: input.description || null,
          portfolioData: input.portfolioData,
        });
      }),

    update: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "id" in val && typeof val.id === "number") {
          return val as { id: number; name?: string; description?: string; portfolioData?: string };
        }
        throw new Error("Invalid update data");
      })
      .mutation(async ({ input, ctx }) => {
        const { updateSavedPortfolio } = await import("./db");
        const { id, ...updates } = input;
        return await updateSavedPortfolio(id, ctx.user.id, updates);
      }),

    delete: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "id" in val && typeof val.id === "number") {
          return val.id;
        }
        throw new Error("Invalid portfolio ID");
      })
      .mutation(async ({ input, ctx }) => {
        const { deleteSavedPortfolio } = await import("./db");
        const success = await deleteSavedPortfolio(input, ctx.user.id);
        if (!success) {
          throw new Error("Failed to delete portfolio");
        }
        return { success: true };
      }),

    toggleLive: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "id" in val && typeof val.id === "number" && "isLive" in val && typeof val.isLive === "boolean") {
          return val as { id: number; isLive: boolean };
        }
        throw new Error("Invalid toggle data");
      })
      .mutation(async ({ input, ctx }) => {
        const { togglePortfolioLive } = await import("./db");
        return await togglePortfolioLive(input.id, ctx.user.id, input.isLive);
      }),

    updateLiveStartDate: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "id" in val && typeof val.id === "number" && "liveStartDate" in val && typeof val.liveStartDate === "string") {
          return val as { id: number; liveStartDate: string };
        }
        throw new Error("Invalid update data");
      })
      .mutation(async ({ input, ctx }) => {
        const { getDb, getSavedPortfolioById } = await import("./db");
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }
        
        const { savedPortfolios, portfolioTransactions, historicalPrices } = await import("../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        
        // Get portfolio to check if it's live and has data
        const portfolio = await getSavedPortfolioById(input.id, ctx.user.id);
        if (!portfolio || !portfolio.isLive) {
          throw new Error("Portfolio not found or not in live mode");
        }
        
        const newLiveStartDate = new Date(input.liveStartDate);
        const newLiveStartDateStr = newLiveStartDate.toISOString().split('T')[0];
        
        // Delete all existing initial transactions (those with notes containing "Initial position")
        await db
          .delete(portfolioTransactions)
          .where(
            and(
              eq(portfolioTransactions.portfolioId, input.id),
              eq(portfolioTransactions.transactionType, 'buy')
            )
          );
        
        console.log('[UpdateLiveStartDate] Deleted existing initial transactions');
        
        // Recreate initial transactions with new date and historical prices
        if (portfolio.portfolioData) {
          const portfolioData = JSON.parse(portfolio.portfolioData);
          const stocks = Array.isArray(portfolioData) ? portfolioData : (portfolioData.stocks || []);
          
          console.log('[UpdateLiveStartDate] Creating new initial transactions for', stocks.length, 'positions with date', newLiveStartDateStr);
          
          for (const stock of stocks) {
            const ticker = stock.ticker || stock.symbol;
            const shares = parseFloat(stock.shares || '0');
            
            if (ticker && shares > 0) {
              // Try to get historical price for the new live start date
              let priceToUse = parseFloat(stock.currentPrice || stock.price || '0');
              
              try {
                const historicalPrice = await db
                  .select()
                  .from(historicalPrices)
                  .where(
                    and(
                      eq(historicalPrices.ticker, ticker),
                      eq(historicalPrices.date, newLiveStartDateStr)
                    )
                  )
                  .limit(1);
                
                if (historicalPrice[0]?.close) {
                  priceToUse = parseFloat(historicalPrice[0].close);
                  console.log(`[UpdateLiveStartDate] Using historical price for ${ticker} on ${newLiveStartDateStr}: ${priceToUse}`);
                } else {
                  console.log(`[UpdateLiveStartDate] No historical price found for ${ticker} on ${newLiveStartDateStr}, using current price: ${priceToUse}`);
                }
              } catch (err) {
                console.error(`[UpdateLiveStartDate] Error fetching historical price for ${ticker}:`, err);
              }
              
              if (priceToUse > 0) {
                const totalAmount = (shares * priceToUse).toFixed(2);
                
                await db.insert(portfolioTransactions).values({
                  portfolioId: input.id,
                  transactionType: 'buy',
                  ticker: ticker,
                  shares: shares.toString(),
                  pricePerShare: priceToUse.toString(),
                  totalAmount: totalAmount,
                  fees: '0',
                  notes: `Initial position (price from ${newLiveStartDateStr})`,
                  transactionDate: newLiveStartDate,
                });
                
                console.log(`[UpdateLiveStartDate] Created initial buy: ${ticker} x ${shares} @ ${priceToUse}`);
              }
            }
          }
        }
        
        // Update the liveStartDate
        await db
          .update(savedPortfolios)
          .set({ liveStartDate: newLiveStartDate })
          .where(
            and(
              eq(savedPortfolios.id, input.id),
              eq(savedPortfolios.userId, ctx.user.id)
            )
          );
        
        return { success: true };
      }),

    calculateLivePerformance: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "id" in val && typeof val.id === "number") {
          return val.id;
        }
        throw new Error("Invalid portfolio ID");
      })
      .query(async ({ input, ctx }) => {
        const { getSavedPortfolioById, getPortfolioTransactions } = await import("./db");
        
        // Get portfolio and transactions
        const portfolio = await getSavedPortfolioById(input, ctx.user.id);
        if (!portfolio || !portfolio.isLive || !portfolio.liveStartDate) {
          return { performance: null, error: "Portfolio is not in live mode" };
        }
        
        const transactions = await getPortfolioTransactions(input);
        if (transactions.length === 0) {
          return { performance: 0, currentValue: 0, totalInvested: 0 };
        }
        
        // Calculate deposits and current value
        let totalDeposits = 0;
        let totalInvestedInStocks = 0;
        let totalBuyAmounts = 0;
        let totalSellProceeds = 0;
        let totalDividends = 0;
        const holdings: Record<string, number> = {};
        const costBasis: Record<string, { totalCost: number; totalShares: number }> = {};
        
        // Process transactions
        // For live portfolios, all buy transactions on the liveStartDate are treated as initial positions (implicit deposits)
        const liveStartDate = new Date(portfolio.liveStartDate);
        const liveStartDateStr = liveStartDate.toISOString().split('T')[0];
        
        console.log('\n========== [calculateLivePerformance] START ==========');
        console.log('[calculateLivePerformance] Portfolio ID:', input);
        console.log('[calculateLivePerformance] Live Start Date:', liveStartDateStr);
        console.log('[calculateLivePerformance] Total Transactions:', transactions.length);
        console.log('\n[calculateLivePerformance] Processing transactions...');
        transactions.forEach((tx: any) => {
          const shares = parseFloat(tx.shares || '0');
          const price = parseFloat(tx.pricePerShare || '0');
          const amount = parseFloat(tx.totalAmountCHF || '0');
          const txDateStr = new Date(tx.transactionDate).toISOString().split('T')[0];
          const isInitialPosition = tx.transactionType === 'buy' && txDateStr <= liveStartDateStr;
          
          if (tx.transactionType === 'buy') {
            console.log(`[calculateLivePerformance] BUY ${tx.ticker}: ${shares} shares @ ${price} ${tx.currency}, totalAmountCHF=${amount}`);
            holdings[tx.ticker] = (holdings[tx.ticker] || 0) + shares;
            totalBuyAmounts += amount;
            totalInvestedInStocks += amount;
            console.log(`[calculateLivePerformance]   → totalInvestedInStocks now: ${totalInvestedInStocks}`);
            
            // Treat initial positions as implicit deposits (capital brought into the portfolio)
            if (isInitialPosition) {
              totalDeposits += amount;
              console.log(`[calculateLivePerformance]   → Initial position, totalDeposits now: ${totalDeposits}`);
            }
            
            if (!costBasis[tx.ticker]) {
              costBasis[tx.ticker] = { totalCost: 0, totalShares: 0 };
            }
            costBasis[tx.ticker].totalCost += amount;
            costBasis[tx.ticker].totalShares += shares;
          } else if (tx.transactionType === 'sell') {
            console.log(`[calculateLivePerformance] SELL ${tx.ticker}: ${shares} shares @ ${price} ${tx.currency}, totalAmountCHF=${amount}`);
            holdings[tx.ticker] = (holdings[tx.ticker] || 0) - shares;
            totalSellProceeds += amount;
            console.log(`[calculateLivePerformance]   → totalSellProceeds now: ${totalSellProceeds}`);
            if (costBasis[tx.ticker] && costBasis[tx.ticker].totalShares > 0) {
              const avgCost = costBasis[tx.ticker].totalCost / costBasis[tx.ticker].totalShares;
              const soldCost = shares * avgCost;
              console.log(`[calculateLivePerformance]   → Avg cost: ${avgCost.toFixed(2)}, Sold cost: ${soldCost.toFixed(2)}`);
              totalInvestedInStocks -= soldCost;
              console.log(`[calculateLivePerformance]   → totalInvestedInStocks reduced to: ${totalInvestedInStocks}`);
              costBasis[tx.ticker].totalCost -= soldCost;
              costBasis[tx.ticker].totalShares -= shares;
            }
          } else if (tx.transactionType === 'deposit') {
            console.log(`[calculateLivePerformance] DEPOSIT: CHF ${amount}`);
            totalDeposits += amount;
            console.log(`[calculateLivePerformance]   → totalDeposits now: ${totalDeposits}`);
          } else if (tx.transactionType === 'withdrawal') {
            console.log(`[calculateLivePerformance] WITHDRAWAL: CHF ${amount}`);
            totalDeposits -= Math.abs(amount);
            console.log(`[calculateLivePerformance]   → totalDeposits now: ${totalDeposits}`);
          } else if (tx.transactionType === 'dividend') {
            console.log(`[calculateLivePerformance] DIVIDEND ${tx.ticker}: CHF ${amount}`);
            totalDividends += amount;
            console.log(`[calculateLivePerformance]   → totalDividends now: ${totalDividends}`);
          }
        });
        
        // Fetch current prices and calculate current value (in CHF)
        const { getStockByTicker } = await import("./db");
        const { getDb } = await import("./db");
        const { getStockCurrency, convertToCHF, getCurrentFxRate } = await import("./fxHelper");
        const db = await getDb();
        
        let currentValueCHF = 0;
        let liveStartValueCHF = 0;
        
        // liveStartDate and liveStartDateStr already declared above
        const todayStr = new Date().toISOString().split('T')[0];
        
        for (const [ticker, shares] of Object.entries(holdings)) {
          if (shares > 0) {
            const stock = await getStockByTicker(ticker);
            const currentPrice = stock ? parseFloat(stock.currentPrice || '0') : 0;
            
            // Get currency for this stock
            const currency = await getStockCurrency(ticker);
            
            // Convert current value to CHF
            const currentValueLocal = shares * currentPrice;
            const currentValueInCHF = await convertToCHF(currentValueLocal, currency, todayStr);
            currentValueCHF += currentValueInCHF;
            
            // Get price at live start date from historicalPrices table
            if (db) {
              const { historicalPrices } = await import("../drizzle/schema");
              const { eq, and } = await import("drizzle-orm");
              
              const historicalPrice = await db
                .select()
                .from(historicalPrices)
                .where(
                  and(
                    eq(historicalPrices.ticker, ticker),
                    eq(historicalPrices.date, liveStartDateStr)
                  )
                )
                .limit(1);
              
              // Use historical price if available, otherwise use current price (assumes no change)
              const liveStartPrice = historicalPrice[0]?.close 
                ? parseFloat(historicalPrice[0].close)
                : currentPrice;
              
              // Convert live start value to CHF using historical FX rate
              const liveStartValueLocal = shares * liveStartPrice;
              const liveStartValueInCHF = await convertToCHF(liveStartValueLocal, currency, liveStartDateStr);
              liveStartValueCHF += liveStartValueInCHF;
            } else {
              // Fallback: use current price if no DB access
              const fallbackValueInCHF = await convertToCHF(currentValueLocal, currency, todayStr);
              liveStartValueCHF += fallbackValueInCHF;
            }
          }
        }
        
        // Fetch realized gains for this portfolio
        let totalRealizedGains = 0;
        if (db) {
          const { realizedGains } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          
          const gains = await db
            .select()
            .from(realizedGains)
            .where(eq(realizedGains.portfolioId, input));
          
          // Sum all realized gains (realizedGain is in CHF, includes stock gain + FX gain)
          totalRealizedGains = gains.reduce((sum, gain) => sum + parseFloat(gain.realizedGain || '0'), 0);
        }
        
        // Calculate cash position and total value
        const cashPosition = totalDeposits - totalBuyAmounts + totalSellProceeds + totalDividends;
        const totalCurrentValue = currentValueCHF + cashPosition;
        
        // Calculate performance:
        // Performance = (Total Current Value - Total Deposits) / Total Deposits * 100
        const performance = totalDeposits > 0 
          ? ((totalCurrentValue - totalDeposits) / totalDeposits) * 100 
          : 0;
        
        console.log('\n[calculateLivePerformance] ========== FINAL SUMMARY ==========');
        console.log('[calculateLivePerformance] Transaction Totals:');
        console.log(`  - Total Buy Amounts:      CHF ${totalBuyAmounts.toFixed(2)}`);
        console.log(`  - Total Sell Proceeds:    CHF ${totalSellProceeds.toFixed(2)}`);
        console.log(`  - Total Deposits:         CHF ${totalDeposits.toFixed(2)}`);
        console.log(`  - Total Dividends:        CHF ${totalDividends.toFixed(2)}`);
        console.log('\n[calculateLivePerformance] Current Holdings:');
        Object.entries(holdings).forEach(([ticker, shares]) => {
          if (shares > 0) {
            const basis = costBasis[ticker];
            const avgCost = basis ? basis.totalCost / basis.totalShares : 0;
            console.log(`  - ${ticker}: ${shares.toFixed(2)} shares, Avg Cost: CHF ${avgCost.toFixed(2)}, Total Cost: CHF ${(basis?.totalCost || 0).toFixed(2)}`);
          }
        });
        console.log('\n[calculateLivePerformance] Calculated Values:');
        console.log(`  - Total Invested in Stocks: CHF ${totalInvestedInStocks.toFixed(2)}`);
        console.log(`  - Current Stock Value:      CHF ${currentValueCHF.toFixed(2)}`);
        console.log(`  - Live Start Stock Value:   CHF ${liveStartValueCHF.toFixed(2)}`);
        console.log(`  - Cash Position:            CHF ${cashPosition.toFixed(2)}`);
        console.log(`  - Total Current Value:      CHF ${totalCurrentValue.toFixed(2)}`);
        console.log(`  - Total Realized Gains:     CHF ${totalRealizedGains.toFixed(2)}`);
        console.log(`  - Performance:              ${performance.toFixed(2)}%`);
        console.log('\n[calculateLivePerformance] Formula Check:');
        console.log(`  Cash = Deposits - BuyAmounts + SellProceeds + Dividends`);
        console.log(`  Cash = ${totalDeposits.toFixed(2)} - ${totalBuyAmounts.toFixed(2)} + ${totalSellProceeds.toFixed(2)} + ${totalDividends.toFixed(2)}`);
        console.log(`  Cash = ${cashPosition.toFixed(2)} ✓`);
        console.log(`\n  Performance = (CurrentValue - Deposits) / Deposits * 100`);
        console.log(`  Performance = (${totalCurrentValue.toFixed(2)} - ${totalDeposits.toFixed(2)}) / ${totalDeposits.toFixed(2)} * 100`);
        console.log(`  Performance = ${performance.toFixed(2)}% ✓`);
        console.log('========== [calculateLivePerformance] END ==========\n');
        
        return {
          performance,
          currentValue: totalCurrentValue,
          liveStartValue: liveStartValueCHF,
          totalInvested: totalDeposits,  // Total capital invested (deposits - withdrawals + initial positions)
          totalInvestedInStocks,  // Cost basis of current stock positions
          totalDeposits,
          cashPosition,
          totalRealizedGains,
          holdings,
          transactionCount: transactions.length,
        };
      }),

    validateCalculations: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "id" in val && typeof val.id === "number") {
          return val.id;
        }
        throw new Error("Invalid portfolio ID");
      })
      .query(async ({ input, ctx }) => {
        const { getSavedPortfolioById, getPortfolioTransactions } = await import("./db");
        
        console.log('\n========== [validateCalculations] START ==========');
        console.log('[validateCalculations] Portfolio ID:', input);
        
        // Get portfolio
        const portfolio = await getSavedPortfolioById(input, ctx.user.id);
        if (!portfolio) {
          return { error: "Portfolio not found" };
        }
        
        if (!portfolio.isLive || !portfolio.liveStartDate) {
          return { error: "Portfolio is not in live mode" };
        }
        
        // Get all transactions
        const transactions = await getPortfolioTransactions(input);
        console.log('[validateCalculations] Total transactions:', transactions.length);
        
        // Initialize tracking variables
        const validation: any = {
          portfolioId: input,
          liveStartDate: portfolio.liveStartDate,
          transactionCount: transactions.length,
          transactions: [],
          calculations: {},
          warnings: [],
          errors: []
        };
        
        // Process each transaction
        let runningDeposits = 0;
        let runningBuys = 0;
        let runningSells = 0;
        let runningDividends = 0;
        let runningInvested = 0;
        const holdings: Record<string, number> = {};
        const costBasis: Record<string, { totalCost: number; totalShares: number }> = {};
        
        const liveStartDateStr = new Date(portfolio.liveStartDate).toISOString().split('T')[0];
        
        transactions.forEach((tx: any, index: number) => {
          const shares = parseFloat(tx.shares || '0');
          const price = parseFloat(tx.pricePerShare || '0');
          const amount = parseFloat(tx.totalAmountCHF || '0');
          const txDateStr = new Date(tx.transactionDate).toISOString().split('T')[0];
          const isInitialPosition = tx.transactionType === 'buy' && txDateStr <= liveStartDateStr;
          
          const txValidation: any = {
            index: index + 1,
            date: txDateStr,
            type: tx.transactionType,
            ticker: tx.ticker,
            shares,
            price,
            currency: tx.currency,
            fxRate: parseFloat(tx.fxRate || '1'),
            amountCHF: amount,
            isInitialPosition
          };
          
          // Validate transaction data
          if (shares <= 0 && tx.transactionType !== 'deposit' && tx.transactionType !== 'withdrawal') {
            validation.warnings.push(`Transaction #${index + 1}: Invalid shares (${shares})`);
          }
          if (price <= 0 && tx.transactionType !== 'deposit' && tx.transactionType !== 'withdrawal') {
            validation.warnings.push(`Transaction #${index + 1}: Invalid price (${price})`);
          }
          if (amount === 0) {
            validation.warnings.push(`Transaction #${index + 1}: Zero amount`);
          }
          
          // Process transaction
          if (tx.transactionType === 'buy') {
            runningBuys += amount;
            runningInvested += amount;
            holdings[tx.ticker] = (holdings[tx.ticker] || 0) + shares;
            
            if (isInitialPosition) {
              runningDeposits += amount;
              txValidation.note = 'Initial position (counted as deposit)';
            }
            
            if (!costBasis[tx.ticker]) {
              costBasis[tx.ticker] = { totalCost: 0, totalShares: 0 };
            }
            costBasis[tx.ticker].totalCost += amount;
            costBasis[tx.ticker].totalShares += shares;
            
          } else if (tx.transactionType === 'sell') {
            runningSells += amount;
            holdings[tx.ticker] = (holdings[tx.ticker] || 0) - shares;
            
            if (costBasis[tx.ticker] && costBasis[tx.ticker].totalShares > 0) {
              const avgCost = costBasis[tx.ticker].totalCost / costBasis[tx.ticker].totalShares;
              const soldCost = shares * avgCost;
              runningInvested -= soldCost;
              costBasis[tx.ticker].totalCost -= soldCost;
              costBasis[tx.ticker].totalShares -= shares;
              
              txValidation.avgCost = avgCost;
              txValidation.soldCost = soldCost;
              txValidation.realizedGain = amount - soldCost;
            }
            
          } else if (tx.transactionType === 'deposit') {
            runningDeposits += amount;
          } else if (tx.transactionType === 'withdrawal') {
            runningDeposits -= Math.abs(amount);
          } else if (tx.transactionType === 'dividend') {
            runningDividends += amount;
          }
          
          txValidation.runningTotals = {
            deposits: runningDeposits,
            buys: runningBuys,
            sells: runningSells,
            dividends: runningDividends,
            invested: runningInvested
          };
          
          validation.transactions.push(txValidation);
        });
        
        // Calculate expected values
        const expectedCash = runningDeposits - runningBuys + runningSells + runningDividends;
        
        validation.calculations = {
          totalDeposits: runningDeposits,
          totalBuyAmounts: runningBuys,
          totalSellProceeds: runningSells,
          totalDividends: runningDividends,
          totalInvestedInStocks: runningInvested,
          expectedCash,
          formula: `Cash = ${runningDeposits.toFixed(2)} - ${runningBuys.toFixed(2)} + ${runningSells.toFixed(2)} + ${runningDividends.toFixed(2)} = ${expectedCash.toFixed(2)}`
        };
        
        validation.holdings = Object.entries(holdings)
          .filter(([_, shares]) => shares > 0)
          .map(([ticker, shares]) => ({
            ticker,
            shares,
            costBasis: costBasis[ticker]?.totalCost || 0,
            avgCost: costBasis[ticker] ? costBasis[ticker].totalCost / costBasis[ticker].totalShares : 0
          }));
        
        console.log('[validateCalculations] Validation complete');
        console.log('[validateCalculations] Expected Cash:', expectedCash.toFixed(2));
        console.log('[validateCalculations] Total Invested:', runningInvested.toFixed(2));
        console.log('[validateCalculations] Warnings:', validation.warnings.length);
        console.log('[validateCalculations] Errors:', validation.errors.length);
        console.log('========== [validateCalculations] END ==========\n');
        
        return validation;
      }),

    getHoldingsWithChfPerformance: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "id" in val && typeof val.id === "number") {
          return val.id;
        }
        throw new Error("Invalid portfolio ID");
      })
      .query(async ({ input: portfolioId, ctx }) => {
        console.log(`\n========== getHoldingsWithChfPerformance START ==========`);
        console.log(`Portfolio ID: ${portfolioId}`);
        console.log(`Timestamp: ${new Date().toISOString()}`);
        
        const { getSavedPortfolioById, getPortfolioTransactions, getStockByTicker, getDb } = await import("./db");
        const { getStockCurrency, convertToCHF } = await import("./fxHelper");
        
        // Get portfolio and transactions
        const portfolio = await getSavedPortfolioById(portfolioId, ctx.user.id);
        if (!portfolio || !portfolio.isLive || !portfolio.liveStartDate) {
          return [];
        }
        
        const transactions = await getPortfolioTransactions(portfolioId);
        if (transactions.length === 0) {
          return [];
        }
        
        // Calculate holdings from transactions
        const holdingsByTicker: Record<string, { shares: number; totalInvestedLocal: number; totalInvestedCHF: number; totalBought: number; avgBuyPrice: number; avgBuyPriceCHF: number; currency: string }> = {};
        
        for (const tx of transactions) {
          const ticker = tx.ticker;
          if (!holdingsByTicker[ticker]) {
            const currency = await getStockCurrency(ticker);
            holdingsByTicker[ticker] = { 
              shares: 0, 
              totalInvestedLocal: 0, 
              totalInvestedCHF: 0,
              totalBought: 0, 
              avgBuyPrice: 0,
              avgBuyPriceCHF: 0,
              currency 
            };
          }
          
          const shares = parseFloat(tx.shares || '0');
          const price = parseFloat(tx.pricePerShare || '0');
          // Use totalAmount from transaction (includes fees) if available, otherwise calculate
          const amountLocal = parseFloat(tx.totalAmount || '0') || (shares * price);
          const amountCHF = parseFloat(tx.totalAmountCHF || '0') || amountLocal;
          
          if (ticker === 'NVDA') {
            console.log(`[NVDA] tx.totalAmount: "${tx.totalAmount}"`);
            console.log(`[NVDA] tx.totalAmountCHF: "${tx.totalAmountCHF}"`);
            console.log(`[NVDA] tx.currency: "${tx.currency}"`);
            console.log(`[NVDA] amountLocal: ${amountLocal}`);
            console.log(`[NVDA] amountCHF: ${amountCHF}`);
            console.log(`[NVDA] amountCHF === amountLocal? ${amountCHF === amountLocal}`);
            console.log(`[NVDA] holding currency: ${holdingsByTicker[ticker].currency}`);
          }
          
          if (tx.transactionType === 'buy') {
            holdingsByTicker[ticker].shares += shares;
            holdingsByTicker[ticker].totalBought += shares;
            holdingsByTicker[ticker].totalInvestedLocal += amountLocal;
            holdingsByTicker[ticker].totalInvestedCHF += amountCHF;
            // Calculate average buy price (cost per share including fees)
            holdingsByTicker[ticker].avgBuyPrice = holdingsByTicker[ticker].totalInvestedLocal / holdingsByTicker[ticker].totalBought;
            holdingsByTicker[ticker].avgBuyPriceCHF = holdingsByTicker[ticker].totalInvestedCHF / holdingsByTicker[ticker].totalBought;
          } else if (tx.transactionType === 'sell') {
            console.log(`[getHoldingsWithChfPerformance] SELL ${ticker}: ${shares} shares`);
            holdingsByTicker[ticker].shares -= shares;
            // Reduce totalInvested proportionally based on average buy price
            const costBasisLocal = shares * holdingsByTicker[ticker].avgBuyPrice;
            const costBasisCHF = shares * holdingsByTicker[ticker].avgBuyPriceCHF;
            console.log(`[getHoldingsWithChfPerformance]   → Cost basis for ${shares} shares: CHF ${costBasisCHF}`);
            holdingsByTicker[ticker].totalInvestedLocal -= costBasisLocal;
            holdingsByTicker[ticker].totalInvestedCHF -= costBasisCHF;
            console.log(`[getHoldingsWithChfPerformance]   → ${ticker} totalInvestedCHF now: ${holdingsByTicker[ticker].totalInvestedCHF}`);
          }
        }
        
        // Fetch realized gains per ticker for this portfolio
        const db = await getDb();
        const realizedGainsByTicker: Record<string, number> = {};
        
        if (db) {
          const { realizedGains } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          
          const gains = await db
            .select()
            .from(realizedGains)
            .where(eq(realizedGains.portfolioId, portfolioId));
          
          // Group realized gains by ticker
          gains.forEach((gain) => {
            const ticker = gain.ticker;
            const totalGain = parseFloat(gain.realizedGain || '0');
            realizedGainsByTicker[ticker] = (realizedGainsByTicker[ticker] || 0) + totalGain;
          });
        }
        
        // Calculate CHF-converted performance for each holding
        // Use liveStartDate as baseline for performance calculation
        const liveStartDateStr = new Date(portfolio.liveStartDate).toISOString().split('T')[0];
        const todayStr = new Date().toISOString().split('T')[0];
        
        const holdingsWithPerformance = [];
        
        for (const [ticker, holding] of Object.entries(holdingsByTicker)) {
          if (holding.shares <= 0) continue;
          
          const stock = await getStockByTicker(ticker);
          const currentPrice = stock ? parseFloat(stock.currentPrice || '0') : 0;
          
          // Current value in local currency
          const currentValueLocal = holding.shares * currentPrice;
          
          // Convert to CHF using today's rate
          const currentValueCHF = await convertToCHF(currentValueLocal, holding.currency, todayStr);
          
          // Get price at liveStartDate for baseline
          const { historicalPrices } = await import("../drizzle/schema");
          const { eq, and } = await import("drizzle-orm");
          
          let liveStartPrice = currentPrice; // fallback
          if (db) {
            const priceData = await db
              .select()
              .from(historicalPrices)
              .where(
                and(
                  eq(historicalPrices.ticker, ticker),
                  eq(historicalPrices.date, liveStartDateStr)
                )
              )
              .limit(1);
            
            if (priceData.length > 0) {
              liveStartPrice = parseFloat(priceData[0].close || '0');
            }
          }
          
          // Calculate live start value in CHF
          const liveStartValueLocal = holding.shares * liveStartPrice;
          const liveStartValueCHF = await convertToCHF(liveStartValueLocal, holding.currency, liveStartDateStr);
          
          // Get realized gains for this ticker
          const realizedGains = realizedGainsByTicker[ticker] || 0;
          
          // Calculate CHF performance from live start date:
          // Performance = (Current Value + Realized Gains - Live Start Value) / Live Start Value * 100
          const performanceCHF = liveStartValueCHF > 0
            ? ((currentValueCHF + realizedGains - liveStartValueCHF) / liveStartValueCHF) * 100
            : 0;
          
          // Keep totalInvestedCHF for reference (actual money spent)
          const totalInvestedCHF = holding.totalInvestedCHF;
          
          // Calculate average FX rate (buy)
          const avgFxRate = holding.totalInvestedLocal > 0 
            ? holding.totalInvestedCHF / holding.totalInvestedLocal
            : 1.0;
          
          // Calculate current FX rate
          const currentFxRate = currentValueLocal > 0
            ? currentValueCHF / currentValueLocal
            : 1.0;
          
          holdingsWithPerformance.push({
            ticker,
            shares: holding.shares,
            currency: holding.currency,
            currentPrice,
            currentValueLocal,
            currentValueCHF,
            totalInvestedLocal: holding.totalInvestedLocal,
            totalInvestedCHF,
            performanceCHF,
            avgBuyPrice: holding.avgBuyPrice,
            avgFxRate,
            currentFxRate
          });
        }
        
        const totalInvestedAllHoldings = holdingsWithPerformance.reduce((sum, h) => sum + h.totalInvestedCHF, 0);
        console.log(`[getHoldingsWithChfPerformance] SUMMARY: Total invested across all holdings: CHF ${totalInvestedAllHoldings.toFixed(2)}`);
        
        return holdingsWithPerformance;
      }),

    getLivePerformanceHistory: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "id" in val && typeof val.id === "number") {
          return val.id;
        }
        throw new Error("Invalid portfolio ID");
      })
      .query(async ({ input, ctx }) => {
        const { getSavedPortfolioById, getPortfolioTransactions } = await import("./db");
        const { getDb } = await import("./db");
        
        // Get portfolio
        const portfolio = await getSavedPortfolioById(input, ctx.user.id);
        if (!portfolio || !portfolio.isLive || !portfolio.liveStartDate) {
          return { dataPoints: [] };
        }
        
        const transactions = await getPortfolioTransactions(input);
        if (transactions.length === 0) {
          return { dataPoints: [] };
        }
        
        const db = await getDb();
        if (!db) {
          return { dataPoints: [] };
        }
        
        // Generate all days from liveStartDate to today
        const startDate = new Date(portfolio.liveStartDate);
        const today = new Date();
        const days: Date[] = [];
        
        for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
          days.push(new Date(d));
        }
        
        // Calculate holdings and invested amount for each day
        const dataPoints = [];
        
        for (const day of days) {
          // Get transactions up to this day
          const txUpToDay = transactions.filter(
            (tx: any) => new Date(tx.transactionDate) <= day
          );
          
          // Calculate holdings and total invested (using same logic as calculateLivePerformance)
          let totalDeposits = 0;
          let totalWithdrawals = 0;
          let totalBuyAmounts = 0;
          let totalSellProceeds = 0;
          let totalDividends = 0;
          const holdings: Record<string, number> = {};
          const liveStartDateStr = new Date(portfolio.liveStartDate).toISOString().split('T')[0];
          
          txUpToDay.forEach((tx: any) => {
            const shares = parseFloat(tx.shares || '0');
            const amountCHF = parseFloat(tx.totalAmountCHF || tx.totalAmount || '0');
            const txDateStr = new Date(tx.transactionDate).toISOString().split('T')[0];
            const isInitialPosition = tx.transactionType === 'buy' && txDateStr <= liveStartDateStr;
            
            if (tx.transactionType === 'buy') {
              holdings[tx.ticker] = (holdings[tx.ticker] || 0) + shares;
              totalBuyAmounts += amountCHF;
              if (isInitialPosition) {
                totalDeposits += amountCHF;
              }
            } else if (tx.transactionType === 'sell') {
              holdings[tx.ticker] = (holdings[tx.ticker] || 0) - shares;
              totalSellProceeds += amountCHF;
            } else if (tx.transactionType === 'deposit') {
              totalDeposits += amountCHF;
            } else if (tx.transactionType === 'withdrawal') {
              totalWithdrawals += amountCHF;
            } else if (tx.transactionType === 'dividend') {
              totalDividends += amountCHF;
            }
          });
          
          // Get historical prices for this day
          const dayStr = day.toISOString().split('T')[0];
          let portfolioValue = 0;
          
          for (const [ticker, shares] of Object.entries(holdings)) {
            if (shares > 0) {
              // Get stock currency
              const { getStockCurrency } = await import("./fxHelper");
              const currency = await getStockCurrency(ticker);
              
              // Try to get historical price for this day
              const priceData = await db
                .select()
                .from(historicalPrices)
                .where(
                  and(
                    eq(historicalPrices.ticker, ticker),
                    eq(historicalPrices.date, dayStr)
                  )
                )
                .limit(1);
              
              let price = 0;
              if (priceData.length > 0) {
                price = parseFloat(priceData[0].close || '0');
              } else {
                // Fallback: use current price from stocks table
                const { getStockByTicker } = await import("./db");
                const stock = await getStockByTicker(ticker);
                price = stock ? parseFloat(stock.currentPrice || '0') : 0;
              }
              
              // Convert to CHF if needed
              let priceCHF = price;
              if (currency !== 'CHF') {
                const { convertToCHF } = await import("./fxHelper");
                priceCHF = await convertToCHF(price, currency, dayStr);
              }
              
              portfolioValue += shares * priceCHF;
            }
          }
          
          // Calculate cash position (same as calculateLivePerformance)
          const cashPosition = totalDeposits - totalBuyAmounts + totalSellProceeds + totalDividends - totalWithdrawals;
          const totalCurrentValue = portfolioValue + cashPosition;
          
          // Calculate performance (same formula as calculateLivePerformance)
          // Performance = (Current Value - Total Deposits) / Total Deposits × 100
          const totalCapital = totalDeposits - totalWithdrawals;
          const performance = totalCapital > 0
            ? ((totalCurrentValue - totalCapital) / totalCapital) * 100
            : 0;
          
          dataPoints.push({
            date: dayStr,
            invested: totalCapital,
            value: totalCurrentValue,
            performance
          });
        }
        
        return { dataPoints };
      }),
  }),

  portfolioPerformance: router({
    // YTD Performance using daily historical prices
    getYTDPerformance: protectedProcedure
      .input((val: unknown) => {
        // Accept tickers/weights for backwards compatibility, but ignore them
        if (typeof val === "object" && val !== null) {
          return val as { tickers?: string[]; weights?: number[] };
        }
        return {};
      })
      .query(async () => {
        // Load all stocks from database (ignore input params)
        const { getAllStocks } = await import("./db");
        const stocks = await getAllStocks();
        const { calculateYTDPerformance } = await import("./ytd-performance");
        const dailyData = await calculateYTDPerformance(stocks);
        
        // Transform to { dates, values } format expected by chart
        return {
          dates: dailyData.map(d => d.date),
          values: dailyData.map(d => d.performance),
        };
      }),

    getHistoricalData: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "tickers" in val && Array.isArray((val as any).tickers)) {
          return val as { tickers: string[]; weights: number[]; years?: number; ytd?: boolean; ytdStartPrices?: number[] };
        }
        throw new Error("Invalid input: tickers and weights arrays required");
      })
      .query(async ({ input }) => {
        const { tickers, weights, years = 5, ytd = false, ytdStartPrices = [] } = input;
        
        console.log('[Chart] Using cached historical data');
        console.log('[Chart] YTD mode:', ytd);
        console.log('[Chart] Years parameter:', years);
        console.log('[Chart] Received ytdStartPrices:', ytdStartPrices.slice(0, 5), '... (first 5)');

        // Calculate fromDate based on YTD flag
        const fromDate = ytd ? new Date(new Date().getFullYear(), 0, 1) : (() => {
          const d = new Date();
          // For fractional years (e.g., 0.5 for 6 months), calculate days instead
          const daysToSubtract = Math.round(years * 365.25);
          d.setDate(d.getDate() - daysToSubtract);
          return d;
        })();
        const fromDateStr = fromDate.toISOString().split('T')[0];
        const toDateStr = new Date().toISOString().split('T')[0];
        
        console.log('[Chart] Date range:', fromDateStr, 'to', toDateStr, `(${years} years = ${Math.round(years * 365.25)} days)`);

        try {
          const { getDb } = await import("./db");
          const db = await getDb();
          if (!db) {
            throw new Error('Database not available');
          }

          // Fetch cached data for all tickers
          const results: Array<{ ticker: string; data: any[]; weight: number } | null> = [];
          
          for (let i = 0; i < tickers.length; i++) {
            const ticker = tickers[i];
            const cleanTicker = ticker.replace(/\s+•\s+/, '.');
            
            try {
              // Query cache for this ticker
              const cachedPrices = await db
                .select()
                .from(historicalPrices)
                .where(
                  and(
                    eq(historicalPrices.ticker, cleanTicker),
                    sql`${historicalPrices.date} >= ${fromDateStr}`,
                    sql`${historicalPrices.date} <= ${toDateStr}`
                  )
                )
                .orderBy(historicalPrices.date);
              
              if (cachedPrices.length > 0) {
                console.log(`[Chart] Cache HIT for ${cleanTicker}: ${cachedPrices.length} records`);
                const data = cachedPrices
                  .filter(p => p.date && p.close) // Filter out invalid entries
                  .map(p => ({
                    date: typeof p.date === 'string' ? p.date : (p.date as Date)?.toISOString().split('T')[0] || '',
                    close: parseFloat(p.close as any)
                  }))
                  .filter(p => p.date); // Remove entries with empty dates
                results.push({ ticker: cleanTicker, data, weight: weights[i] || 0 });
              } else {
                console.log(`[Chart] Cache MISS for ${cleanTicker}`);
                results.push(null);
              }
            } catch (error) {
              console.error(`[Chart] Failed to fetch cached data for ${cleanTicker}:`, error);
              results.push(null);
            }
          }
          
          const validResults = results.filter((r): r is { ticker: string; data: any[]; weight: number } => r !== null && r.data && r.data.length > 0);
          console.log(`[Chart] Valid cached results: ${validResults.length}/${results.length}`);

          if (validResults.length === 0) {
            return { dates: [], values: [] };
          }

          // Collect ALL dates from all stocks (union instead of intersection)
          const allDatesSet = new Set<string>();
          validResults.forEach(r => {
            if (r && r.data) {
              r.data.forEach((d: any) => allDatesSet.add(d.date));
            }
          });

          const allDates = Array.from(allDatesSet).sort();
          console.log(`[Chart] Found ${allDates.length} total dates. First: ${allDates[0]}, Last: ${allDates[allDates.length - 1]}`);

          // Build price lookup maps for each stock with forward-fill for missing dates
          const stockPriceMaps = validResults.map(r => {
            const priceMap = new Map<string, number>();
            let lastPrice = 0;
            let hasStarted = false;
            
            // Sort data by date
            const sortedData = [...r.data].sort((a, b) => a.date.localeCompare(b.date));
            
            // Fill price map with forward-fill for missing dates
            allDates.forEach(date => {
              const dataPoint = sortedData.find((d: any) => d.date === date);
              if (dataPoint) {
                lastPrice = dataPoint.close;
                priceMap.set(date, lastPrice);
                hasStarted = true;
              } else if (hasStarted && lastPrice > 0) {
                // Forward-fill: use last known price (only AFTER stock has data)
                priceMap.set(date, lastPrice);
              }
              // If stock hasn't started yet (no data), don't add to priceMap
            });
            
            return { weight: r.weight, priceMap };
          });

          // Calculate weighted portfolio performance for each date
          // Use ytdStartPrices if provided (for YTD calculations), otherwise use first price
          
          // Get start price for each stock (first valid price in their data)
          const startPrices = stockPriceMaps.map(({ priceMap }, idx) => {
            // Use first valid price in historical data
            for (const date of allDates) {
              const price = priceMap.get(date);
              if (price !== undefined && price > 0) {
                return price;
              }
            }
            return 0;
          });


          const portfolioValues = allDates.map((date, dateIdx) => {
            let weightedPerformance = 0;
            let totalWeight = 0;
            

            
            stockPriceMaps.forEach(({ weight, priceMap }, idx) => {
              const currentPrice = priceMap.get(date);
              const startPrice = startPrices[idx];
              
              // Only include stocks that have data at this date
              if (currentPrice !== undefined && currentPrice > 0 && startPrice > 0) {
                // Calculate percentage change for this stock from its start
                const stockPerformance = ((currentPrice / startPrice) - 1) * 100;
                // Weight it
                weightedPerformance += stockPerformance * weight;
                totalWeight += weight;
                

              }
            });
            
            // Normalize by actual weights present at this date
            // This prevents drops when new stocks are added
            return totalWeight > 0 ? weightedPerformance / totalWeight : 0;
          });

          // Final filtering: ensure we only return data within the requested time range
          const filteredData = allDates
            .map((date, idx) => ({ date, value: portfolioValues[idx] }))
            .filter(item => item.date >= fromDateStr && item.date <= toDateStr);
          
          const validDates = filteredData.map(item => item.date);
          const absoluteValues = filteredData.map(item => item.value);

          const timeSpanYears = validDates.length > 0 
            ? ((new Date(validDates[validDates.length - 1]).getTime() - new Date(validDates[0]).getTime()) / (365.25 * 24 * 60 * 60 * 1000)).toFixed(1)
            : '0.0';
          console.log(`[Chart] Returning ${validDates.length} data points spanning ${timeSpanYears} years (filtered from ${fromDateStr} to ${toDateStr})`);
          

          return {
            dates: validDates,
            values: absoluteValues,
          };
        } catch (error: any) {
          console.error('[portfolioPerformance] Error:', error);
          throw new Error(error.message || "Failed to fetch historical data");
        }
      }),

    getBenchmarkData: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "benchmark" in val) {
          return val as { benchmark: string; years?: number; ytd?: boolean };
        }
        throw new Error("Invalid input: benchmark required");
      })
      .query(async ({ input }) => {
        const { benchmark, years = 5, ytd = false } = input;

        // Map benchmark names to Yahoo Finance tickers
        const benchmarkTickers: Record<string, string> = {
          'sp500': '%5EGSPC',
          'nasdaq': '%5EIXIC',
          'smi': '%5ESSMI',
          'msci_world': 'URTH',
          'eurostoxx': '%5ESTOXX50E',
        };

        const ticker = benchmarkTickers[benchmark];
        if (!ticker) throw new Error("Invalid benchmark");

        // Calculate fromDate based on YTD flag
        const fromDate = ytd ? new Date(new Date().getFullYear(), 0, 1) : (() => {
          const d = new Date();
          d.setFullYear(d.getFullYear() - years);
          return d;
        })();
        const period1 = Math.floor(fromDate.getTime() / 1000);
        const period2 = Math.floor(Date.now() / 1000);

        try {
          // Use Yahoo Finance API via Manus Data API
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${period1}&period2=${period2}&interval=1d`;
          const res = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0',
            },
          });
          
          if (!res.ok) {
            console.error('[portfolioPerformance] Benchmark fetch failed:', res.status, res.statusText);
            throw new Error("Failed to fetch benchmark data");
          }
          
          const data = await res.json();

          if (!data?.chart?.result?.[0]?.timestamp || !data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close) {
            console.warn('[portfolioPerformance] No benchmark data available');
            return { dates: [], values: [] };
          }

          const timestamps = data.chart.result[0].timestamp;
          const closes = data.chart.result[0].indicators.quote[0].close;

          // Convert timestamps to dates and filter out null values
          // Limit to max 500 data points to prevent memory issues
          const maxPoints = 500;
          const step = Math.max(1, Math.floor(timestamps.length / maxPoints));
          
          const validData: Array<{ date: string; close: number }> = [];
          for (let i = 0; i < timestamps.length; i += step) {
            if (closes[i] !== null && closes[i] !== undefined) {
              const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
              validData.push({ date, close: closes[i] });
            }
          }

          if (validData.length === 0) {
            return { dates: [], values: [] };
          }

          const dates = validData.map(d => d.date);
          const closePrices = validData.map(d => d.close);

          // Normalize to percentage (start at 0%)
          const startValue = closePrices[0] || 1;
          const percentageValues = closePrices.map((v: number) => ((v / startValue) - 1) * 100);

          return {
            dates,
            values: percentageValues,
          };
        } catch (error: any) {
          console.error('[portfolioPerformance] Error fetching benchmark:', error);
          // Return empty data instead of throwing to prevent UI errors
          return { dates: [], values: [] };
        }
      }),
  }),

  score: router({
    calculateAll: protectedProcedure.query(async ({ ctx }) => {
      const { getAllStocks } = await import("./db");
      const { calculateStockScore } = await import("./scoring");
      type StockMetrics = import("./scoring").StockMetrics;
      
      const stocks = await getAllStocks();
      
      const scores = stocks.map(stock => {
        const metrics: StockMetrics = {
          // Available metrics from APIs
          dividendYield: stock.dividendYield ? parseFloat(stock.dividendYield) : undefined,
          peRatio: stock.peRatio ? parseFloat(stock.peRatio) : undefined,
          pegRatio: stock.pegRatio ? parseFloat(stock.pegRatio) : undefined,
          beta: stock.beta ? parseFloat(stock.beta) : undefined,
          volatility: stock.volatility ? parseFloat(stock.volatility) : undefined,
          sharpeRatio: stock.sharpeRatio ? parseFloat(stock.sharpeRatio) : undefined,
          // Legacy metrics (not used)
          ytdPerformance: stock.ytdPerformance ? parseFloat(stock.ytdPerformance) : undefined,
        };
        
        return calculateStockScore(stock.ticker, metrics, undefined, stock.category || undefined);
      });
      
      return scores;
    }),
  }),

  user: router({
    updateSettings: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null) return val;
        throw new Error("Invalid input");
      })
      .mutation(async ({ input, ctx }) => {
        const { getDb } = await import("./db");
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const updates = input as { mobile?: string | null; whatsappAlerts?: number };
        
        await db.update(users)
          .set(updates)
          .where(eq(users.openId, ctx.user.openId));
        
        return { success: true };
      }),
    
    updateProfile: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "username" in val && "email" in val) {
          return val as { username: string; email: string };
        }
        throw new Error("Invalid input: username and email are required");
      })
      .mutation(async ({ input, ctx }) => {
        const { getDb } = await import("./db");
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.update(users)
          .set({
            username: input.username,
            email: input.email,
          })
          .where(eq(users.openId, ctx.user.openId));
        
        return { success: true };
      }),
    
    updatePassword: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "currentPassword" in val && "newPassword" in val) {
          return val as { currentPassword: string; newPassword: string };
        }
        throw new Error("Invalid input: currentPassword and newPassword are required");
      })
      .mutation(async ({ input, ctx }) => {
        const { getDb } = await import("./db");
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const bcrypt = await import("bcryptjs");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        // Get current user with password
        const [user] = await db.select().from(users).where(eq(users.openId, ctx.user.openId)).limit(1);
        if (!user || !user.password) {
          throw new Error("User not found or password not set");
        }
        
        // Verify current password
        const isValid = await bcrypt.compare(input.currentPassword, user.password);
        if (!isValid) {
          throw new Error("Aktuelles Passwort ist falsch");
        }
        
        // Hash new password
        const hashedPassword = await bcrypt.hash(input.newPassword, 10);
        
        // Update password
        await db.update(users)
          .set({ password: hashedPassword })
          .where(eq(users.openId, ctx.user.openId));
        
        return { success: true };
      }),
    
    updateNotifications: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null) {
          return val as { whatsappAlerts?: boolean; emailNotifications?: boolean; newsletterSubscribed?: boolean };
        }
        throw new Error("Invalid input");
      })
      .mutation(async ({ input, ctx }) => {
        const { getDb } = await import("./db");
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.update(users)
          .set({
            whatsappAlerts: input.whatsappAlerts ? 1 : 0,
            // TODO: Add emailNotifications and newsletterSubscribed fields to schema
          })
          .where(eq(users.openId, ctx.user.openId));
        
        return { success: true };
      }),
  }),

  scoring: router({
    calculateScores: publicProcedure.query(async () => {
      const { calculateStockScores } = await import("./scoring");
      const { getAllStocks } = await import("./db");
      const stocks = await getAllStocks();
      return calculateStockScores(stocks);
    }),
  }),
  
  categories: router({
    list: publicProcedure.query(async () => {
      const { getAllCategories } = await import("./db");
      return await getAllCategories();
    }),
    add: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "name" in val) {
          return val as { name: string; description?: string; color?: string };
        }
        throw new Error("Invalid input: name is required");
      })
      .mutation(async ({ input, ctx }) => {
        // Only admins can manage categories
        if (ctx.user.role !== 'admin') {
          throw new Error("Unauthorized: Admin access required");
        }
        
        const { insertCategory } = await import("./db");
        await insertCategory(input);
        return { success: true };
      }),
    update: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "id" in val) {
          return val as { id: number; name?: string; description?: string; color?: string };
        }
        throw new Error("Invalid input: id is required");
      })
      .mutation(async ({ input, ctx }) => {
        // Only admins can manage categories
        if (ctx.user.role !== 'admin') {
          throw new Error("Unauthorized: Admin access required");
        }
        
        const { updateCategory } = await import("./db");
        const { id, ...data } = input;
        await updateCategory(id, data);
        return { success: true };
      }),
    delete: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "number") return val;
        throw new Error("Invalid input: id must be a number");
      })
      .mutation(async ({ input: id, ctx }) => {
        // Only admins can manage categories
        if (ctx.user.role !== 'admin') {
          throw new Error("Unauthorized: Admin access required");
        }
        
        const { deleteCategory } = await import("./db");
        const success = await deleteCategory(id);
        if (!success) throw new Error("Failed to delete category");
        return { success: true };
      }),
  }),

  weeklyOverview: router({
    generate: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("./db");
      const { stocks } = await import("../drizzle/schema");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get all portfolio stocks
      const allStocks = await db.select().from(stocks);
      if (allStocks.length === 0) return { overview: [] };

      const { getFinnhubApiKey } = await import("./_core/env");
      const apiKey = await getFinnhubApiKey();
      if (!apiKey) {
        throw new Error(`Finnhub API key not configured. Please add it via Admin > API Secrets.`);
      }

      // Get date range for current week
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fromDate = weekAgo.toISOString().split('T')[0];
      const toDate = now.toISOString().split('T')[0];

      console.log(`[WeeklyOverview] Analyzing ${allStocks.length} stocks from ${fromDate} to ${toDate}`);

      // Fetch news and price data for each stock
      const stockAnalysisPromises = allStocks.map(async (stock) => {
        try {
          const cleanTicker = stock.ticker.replace(/\s+•\s+/, '.').replace('.SW', '');
          
          // Fetch news from Finnhub
          const newsUrl = `https://finnhub.io/api/v1/company-news?symbol=${cleanTicker}&from=${fromDate}&to=${toDate}&token=${apiKey}`;
          const newsRes = await fetch(newsUrl);
          const newsData = newsRes.ok ? await newsRes.json() : [];

          // Fetch weekly price data to check for significant moves
          const eodhd_key = process.env.EODHD_API_KEY;
          let priceChange = 0;
          if (eodhd_key) {
            try {
              const priceUrl = `https://eodhd.com/api/eod/${stock.ticker}?api_token=${eodhd_key}&from=${fromDate}&to=${toDate}&fmt=json`;
              const priceRes = await fetch(priceUrl);
              if (priceRes.ok) {
                const priceData = await priceRes.json();
                if (priceData && priceData.length >= 2) {
                  const firstPrice = priceData[0].close;
                  const lastPrice = priceData[priceData.length - 1].close;
                  priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;
                }
              }
            } catch (e) {
              console.error(`[WeeklyOverview] Price fetch failed for ${stock.ticker}:`, e);
            }
          }

          return {
            ticker: stock.ticker,
            companyName: stock.companyName,
            news: newsData || [],
            priceChange,
          };
        } catch (error) {
          console.error(`[WeeklyOverview] Error fetching data for ${stock.ticker}:`, error);
          return {
            ticker: stock.ticker,
            companyName: stock.companyName,
            news: [],
            priceChange: 0,
          };
        }
      });

      const stocksData = await Promise.all(stockAnalysisPromises);

      // Use LLM to filter and summarize relevant news
      const { invokeLLM } = await import("./_core/llm");
      
      const prompt = `Du bist ein Finanzanalyst. Analysiere die folgenden Aktien und ihre News der letzten Woche.

Zeige NUR Aktien an, die WICHTIGE Ereignisse hatten:
- Gewinnpublikationen (Earnings)
- Übernahmen / M&A
- Starke Kursbewegungen (>10% oder <-10%)
- Wichtige Corporate News (neue Produkte, Partnerschaften, Regulierung)
- Neue Kursziele von Analysten

Aktien-Daten:
${JSON.stringify(stocksData.map(s => ({
  ticker: s.ticker,
  name: s.companyName,
  priceChange: s.priceChange.toFixed(2) + '%',
  newsCount: s.news.length,
  headlines: s.news.slice(0, 5).map((n: any) => n.headline)
})), null, 2)}

Antworte im JSON-Format:
{
  "stocks": [
    {
      "ticker": "AAPL",
      "companyName": "Apple Inc.",
      "summary": "Kurze Zusammenfassung der wichtigsten Ereignisse",
      "events": [
        { "type": "earnings", "description": "Q4 Earnings übertreffen Erwartungen" },
        { "type": "price_move", "description": "+12.5% Kursanstieg nach Earnings" }
      ]
    }
  ]
}

Wenn eine Aktie KEINE wichtigen Ereignisse hatte, lasse sie weg.`;

      try {
        const llmResponse = await invokeLLM({
          messages: [
            { role: "system", content: "Du bist ein Finanzanalyst, der relevante Börsennews filtert und zusammenfasst." },
            { role: "user", content: prompt }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "weekly_overview",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  stocks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        ticker: { type: "string" },
                        companyName: { type: "string" },
                        summary: { type: "string" },
                        events: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              type: { type: "string" },
                              description: { type: "string" }
                            },
                            required: ["type", "description"],
                            additionalProperties: false
                          }
                        }
                      },
                      required: ["ticker", "companyName", "summary", "events"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["stocks"],
                additionalProperties: false
              }
            }
          }
        });

        const content = llmResponse.choices[0]?.message?.content;
        if (!content) throw new Error("No LLM response");
        if (typeof content !== 'string') throw new Error("Invalid LLM response format");
        
        const result = JSON.parse(content);
        console.log(`[WeeklyOverview] LLM filtered to ${result.stocks.length} stocks with important events`);
        
        return { overview: result.stocks };
      } catch (error: any) {
        console.error("[WeeklyOverview] LLM error:", error);
        throw new Error(`Failed to generate overview: ${error.message}`);
      }
    }),
  }),

  sectors: router({  
    list: publicProcedure.query(async () => {
      const { getAllUniqueSectors } = await import("./db");
      return await getAllUniqueSectors();
    }),
    updateStockSector: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "ticker" in val && "sector" in val) {
          return val as { ticker: string; sector: string };
        }
        throw new Error("Invalid input: ticker and sector are required");
      })
      .mutation(async ({ input, ctx }) => {
        // Only admins can manage sectors
        if (ctx.user.role !== 'admin') {
          throw new Error("Unauthorized: Admin access required");
        }
        
        const { updateStockSector } = await import("./db");
        await updateStockSector(input.ticker, input.sector);
        return { success: true };
      }),
  }),

  portfolioTransactions: portfolioTransactionsRouter,

  dividendCalendar: dividendCalendarRouter,

  annualPerformance: annualPerformanceRouter,

  fx: router({
    getCurrentRate: publicProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "currency" in val && typeof val.currency === "string") {
          return val as { currency: string; date?: string };
        }
        throw new Error("Invalid currency");
      })
      .query(async ({ input }) => {
        const { getFxRate } = await import("./fxHelper");
        
        const date = input.date || new Date().toISOString().split('T')[0];
        const currencyPair = input.currency === 'CHF' ? 'CHFCHF' : input.currency + 'CHF';
        
        const rate = await getFxRate(date, currencyPair);
        
        return {
          currency: input.currency,
          date,
          rate,
          currencyPair
        };
      }),
  }),

  realizedGainsHistory: realizedGainsHistoryRouter,
  secrets: secretsRouter,
  testSecrets: testSecretsRouter,
  logs: logsRouter,
  notificationSettings: notificationSettingsRouter,
});

export type AppRouter = typeof appRouter;
