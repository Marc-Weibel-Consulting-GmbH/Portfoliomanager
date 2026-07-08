import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { loginSchema, loginUser, registerSchema, registerUser, SESSION_MAX_AGE_MS } from "./_core/authService";
import { getClientIp, isRateLimited, LOGIN_RATE_LIMIT, RATE_LIMIT_MESSAGE, REGISTER_RATE_LIMIT } from "./_core/rateLimit";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { ENV } from "./_core/env";
import { stocksRouter } from "./routers/stocksRouter";
import { portfoliosRouter } from "./routers/portfoliosRouter";
import { portfolioPerformanceRouter } from "./routers/performanceRouter";
import { portfolioMetricsRouter } from "./routers/portfolioPerformanceRouter";
import { adminRouter } from "./routers/adminRouter";
import { weeklyOverviewRouter } from "./routers/weeklyOverviewRouter";
import { portfolioComparisonRouter } from "./routers/portfolioComparisonRouter";
import { dividendCalendarRouter } from "./routers/dividendCalendarRouter";
import { annualPerformanceRouter } from "./routers/annualPerformanceRouter";
import { portfolioTransactionsRouter } from "./routers/portfolioTransactionsRouter";
import { realizedGainsHistoryRouter } from "./routers/realizedGainsHistoryRouter";
import { secretsRouter } from "./routers/secretsRouter";
import { testSecretsRouter } from "./routers/testSecretsRouter";
import { logsRouter } from "./routers/logsRouter";
import { notificationSettingsRouter } from "./routers/notificationSettingsRouter";
import { priceAlertsRouter } from "./routers/priceAlertsRouter";
import { chatRouter } from "./routers/chatRouter";
import { signalsRouter } from "./routers/signalsRouter";
import { portfolioOptimizerRouter } from "./routers/portfolioOptimizerRouter";
import { onboardingRouter } from "./routers/onboardingRouter";
import { authRouter as authExtensionsRouter } from "./routers/authRouter";
import { autoPortfolioRouter } from "./routers/autoPortfolioRouter";
import { fxRatesRouter } from "./routers/fxRatesRouter";
import { portfolioManagementRouter } from "./routers/portfolioManagementRouter";
import { dashboardRouter } from "./routers/dashboardRouter";
import { dashboardPerformanceRouter } from "./routers/dashboardPerformanceRouter";
import { newsRouter } from "./routers/newsRouter";
import { analyticsRouter } from "./routers/analyticsRouter";
import { aiInsightsRouter } from "./routers/aiInsightsRouter";
import { watchlistRouter } from "./routers/watchlistRouter";
import { investRouter } from "./routers/investRouter";
import { backtestRouter } from "./routers/backtestRouter";
import { predictionRouter } from "./routers/predictionRouter";
import { optimizerRouter } from "./routers/optimizerRouter";
import { marketRegimeRouter } from "./routers/marketRegimeRouter";
import { copilotRouter } from "./routers/copilotRouter";
import { recommendationsRouter } from "./routers/recommendationsRouter";
import { investmentProfileRouter } from "./routers/investmentProfileRouter";
import { pdfImportRouter } from "./routers/pdfImportRouter";
import { tradingviewRouter } from "./routers/tradingview";
import { researchRouter } from "./routers/researchRouter";
import { userSettingsRouter } from "./routers/userSettingsRouter";
import { fetchLogo } from "./logoService";
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

  // Fincept Analytics (Python microservice proxy)
  analytics: analyticsRouter,
  aiInsights: aiInsightsRouter,

  // Watchlist & Invest
  watchlist: watchlistRouter,
  invest: investRouter,
  backtest: backtestRouter,
  prediction: predictionRouter,
  optimizer: optimizerRouter,
  marketRegime: marketRegimeRouter,
  copilot: copilotRouter,
  recommendations: recommendationsRouter,
  investmentProfile: investmentProfileRouter,
  pdfImport: pdfImportRouter,
  userSettings: userSettingsRouter,

  // TradingView Analytics Bridge (Railway microservice)
  tradingview: tradingviewRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    // Password reset and email verification
    ...authExtensionsRouter._def.procedures,
    // Thin delegates to the shared auth service (D-08) — cookie handling stays
    // in the transport layer, business logic lives in _core/authService.ts.
    register: publicProcedure
      .input(registerSchema)
      .mutation(async ({ input, ctx }) => {
        if (isRateLimited(`register:${getClientIp(ctx.req)}`, REGISTER_RATE_LIMIT)) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: RATE_LIMIT_MESSAGE });
        }

        const { sessionToken } = await registerUser(input);

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: SESSION_MAX_AGE_MS,
        });

        return { success: true };
      }),
    login: publicProcedure
      .input(loginSchema)
      .mutation(async ({ input, ctx }) => {
        if (isRateLimited(`login:${getClientIp(ctx.req)}`, LOGIN_RATE_LIMIT)) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: RATE_LIMIT_MESSAGE });
        }

        const { sessionToken } = await loginUser(input.email, input.password);

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: SESSION_MAX_AGE_MS,
        });

        return { success: true };
      }),
    completeOnboarding: protectedProcedure
      .input(z.object({
        investmentGoal: z.enum(["dividends", "growth", "balanced"]),
        riskTolerance: z.enum(["low", "medium", "high"]),
        investmentHorizon: z.enum(["short", "medium", "long"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const { updateUserPreferences, completeOnboarding } = await import("./db");
        
        // Update user preferences
        await updateUserPreferences(ctx.user.id, {
          investmentGoal: input.investmentGoal,
          riskTolerance: input.riskTolerance,
          investmentHorizon: input.investmentHorizon,
        });
        
        // Mark onboarding as completed
        await completeOnboarding(ctx.user.id);
        
        return { success: true };
      }),
    updatePreferences: protectedProcedure
      .input(z.object({
        investmentGoal: z.enum(["dividends", "growth", "balanced"]).optional(),
        riskTolerance: z.enum(["low", "medium", "high"]).optional(),
        investmentHorizon: z.enum(["short", "medium", "long"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { updateUserPreferences } = await import("./db");
        
        await updateUserPreferences(ctx.user.id, input);
        
        return { success: true };
      }),
  }),


  news: router({
    getByTicker: publicProcedure
      .input(z.string())
      .query(async ({ input }) => {
        // Fetch real news from Finnhub API
        const { fetchCompanyNews } = await import("./_core/newsApi");
        const articles = await fetchCompanyNews(input, 10);
        
        // Transform to match database schema format
        return articles.map(article => ({
          id: 0, // Not stored in DB
          ticker: article.ticker,
          title: article.title,
          description: article.description,
          url: article.url,
          imageUrl: article.imageUrl,
          source: article.source,
          priority: "Mittel" as const,
          publishedAt: article.publishedAt,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));
      }),
    getAll: publicProcedure.query(async () => {
      // Fetch general market news from Finnhub
      const { fetchMarketNews } = await import("./_core/newsApi");
      const articles = await fetchMarketNews("general", 50);
      
      // Transform to match database schema format
      return articles.map(article => ({
        id: 0, // Not stored in DB
        ticker: article.ticker,
        title: article.title,
        description: article.description,
        url: article.url,
        imageUrl: article.imageUrl,
        source: article.source,
        priority: "Mittel" as const,
        publishedAt: article.publishedAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    }),
    getPortfolioNews: publicProcedure.query(async () => {
      // Fetch news for all stocks in portfolio
      const { getAllStocks } = await import("./db");
      const { fetchMultiTickerNews } = await import("./_core/newsApi");
      
      const stocks = await getAllStocks();
      const tickers = stocks.map(s => s.ticker);
      
      if (tickers.length === 0) {
        return [];
      }
      
      const articles = await fetchMultiTickerNews(tickers, 3);
      
      // Transform to match database schema format
      return articles.map(article => ({
        id: 0, // Not stored in DB
        ticker: article.ticker,
        title: article.title,
        description: article.description,
        url: article.url,
        imageUrl: article.imageUrl,
        source: article.source,
        priority: "Mittel" as const,
        publishedAt: article.publishedAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
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
      .input(z.object({
        title: z.string(),
        content: z.string().optional(),
        fileUrl: z.string().optional(),
        fileType: z.string().optional(),
        fileName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const { research } = await import("../drizzle/schema");
        const { storagePut } = await import("./storage");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const data = input;
        
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
              const ext = data.fileName?.split('.').pop() || 'bin';
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
      .input(z.number())
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
      .input(z.object({
        ticker: z.string().optional(),
        metricName: z.string(),
        condition: z.enum(['above', 'below', 'change']),
        threshold: z.string(),
        notificationMethod: z.enum(['email', 'whatsapp', 'both']).default('email'),
      }))
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
      .input(z.object({ limit: z.number().default(50) }).default({ limit: 50 }))
      .query(async ({ ctx, input }) => {
        const { getUserAlertHistory } = await import("./_core/alertSystem");
        return await getUserAlertHistory(ctx.user.id, input.limit);
      }),
  }),


  newsletter: router({
    subscribe: publicProcedure
      .input(z.object({ email: z.string() }))
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
            apiVersion: "2025-09-30.clover",
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
      .input(z.object({ paymentId: z.string() }))
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
      .input(z.object({
        name: z.string(),
        email: z.string(),
        message: z.string(),
      }))
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
    completeRegistration: protectedProcedure
      .input(z.object({
        firstName: z.string(),
        lastName: z.string(),
        investmentGoal: z.enum(["dividends", "growth", "balanced"]),
        riskTolerance: z.enum(["low", "medium", "high"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const { getDb } = await import("./db");
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.update(users)
          .set({
            firstName: input.firstName,
            lastName: input.lastName,
            investmentGoal: input.investmentGoal,
            riskTolerance: input.riskTolerance,
            hasCompletedRegistration: 1,
          })
          .where(eq(users.openId, ctx.user.openId));
        
        return { success: true };
      }),
    
    updateSettings: protectedProcedure
      .input(z.object({
        mobile: z.string().nullish(),
        whatsappAlerts: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { getDb } = await import("./db");
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const updates = input;

        await db.update(users)
          .set(updates)
          .where(eq(users.openId, ctx.user.openId));
        
        return { success: true };
      }),
    
    updateProfile: protectedProcedure
      .input(z.object({
        username: z.string(),
        email: z.string(),
      }))
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
      .input(z.object({
        currentPassword: z.string(),
        newPassword: z.string(),
      }))
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
      .input(z.object({
        whatsappAlerts: z.boolean().optional(),
        emailNotifications: z.boolean().optional(),
        newsletterSubscribed: z.boolean().optional(),
      }))
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
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        color: z.string().optional(),
      }))
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
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        color: z.string().optional(),
      }))
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
      .input(z.number())
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


  sectors: router({  
    list: publicProcedure.query(async () => {
      const { getAllUniqueSectors } = await import("./db");
      return await getAllUniqueSectors();
    }),
    updateStockSector: protectedProcedure
      .input(z.object({
        ticker: z.string(),
        sector: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Only admins can manage sectors
        if (ctx.user.role !== 'admin') {
          throw new Error("Unauthorized: Admin access required");
        }
        
        const { updateStockSector } = await import("./db");
        await updateStockSector(input.ticker, input.sector);
        return { success: true };
      }),
    // Fetch and update sectors for all stocks without sector data
    refreshMissingSectors: protectedProcedure
      .mutation(async ({ ctx }) => {
        // Only admins can refresh sectors
        if (ctx.user.role !== 'admin') {
          throw new Error("Unauthorized: Admin access required");
        }
        
        const { getAllStocks, updateStock } = await import("./db");
        const { fetchEODHDFundamentals } = await import("./_core/eodhdApi");
        
        const allStocks = await getAllStocks();
        const stocksWithoutSector = allStocks.filter(s => !s.sector || s.sector === '');
        
        console.log(`[Sectors] Found ${stocksWithoutSector.length} stocks without sector data`);
        
        let updated = 0;
        let failed = 0;
        
        for (const stock of stocksWithoutSector) {
          try {
            const fundamentals = await fetchEODHDFundamentals(stock.ticker);
            if (fundamentals.sector) {
              await updateStock(stock.ticker, { sector: fundamentals.sector });
              console.log(`[Sectors] Updated ${stock.ticker}: ${fundamentals.sector}`);
              updated++;
            } else {
              console.log(`[Sectors] No sector found for ${stock.ticker}`);
              failed++;
            }
            // Rate limiting: wait 200ms between API calls
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch (error) {
            console.error(`[Sectors] Error updating ${stock.ticker}:`, error);
            failed++;
          }
        }
        
        return { updated, failed, total: stocksWithoutSector.length };
      }),
  }),

  portfolioTransactions: portfolioTransactionsRouter,

  dividendCalendar: dividendCalendarRouter,

  annualPerformance: annualPerformanceRouter,

  // Extracted large routers
  stocks: stocksRouter,
  portfolios: portfoliosRouter,
  autoPortfolio: autoPortfolioRouter,
  portfolioManagement: portfolioManagementRouter,
  portfolioPerformance: portfolioPerformanceRouter,
  portfolioMetrics: portfolioMetricsRouter,
  fxRates: fxRatesRouter,
  admin: adminRouter,
  weeklyOverview: weeklyOverviewRouter,
  portfolioComparison: portfolioComparisonRouter,
  signals: signalsRouter,
  portfolioOptimizer: portfolioOptimizerRouter,

  fx: router({
    getCurrentRate: publicProcedure
      .input(z.object({
        currency: z.string(),
        date: z.string().optional(),
      }))
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


  priceAlerts: priceAlertsRouter,

  chat: chatRouter,

  dashboard: dashboardRouter,
  dashboardPerformance: dashboardPerformanceRouter,
  realizedGainsHistory: realizedGainsHistoryRouter,
  secrets: secretsRouter,
  testSecrets: testSecretsRouter,
  logs: logsRouter,
  notificationSettings: notificationSettingsRouter,
  
    onboarding: onboardingRouter,
  researchAdmin: researchRouter,
  // Logo service for stock logos
  logos: router({
    getLogoUrl: publicProcedure
      .input(z.object({
        ticker: z.string(),
        companyName: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const result = await fetchLogo(input.ticker);
        return {
          ticker: input.ticker,
          url: result.url,
          source: result.source,
        };
      }),
    
    getBatchLogos: publicProcedure
      .input(z.array(z.object({
        ticker: z.string(),
        companyName: z.string().optional(),
      })))
      .query(async ({ input }) => {
        const results: Record<string, { url: string; source: string }> = {};
        
        // Process in parallel for better performance
        await Promise.all(
          input.map(async (item) => {
            const result = await fetchLogo(item.ticker);
            results[item.ticker] = {
              url: result.url,
              source: result.source,
            };
          })
        );
        
        return results;
      }),
  }),
});

export type AppRouter = typeof appRouter;
