import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { ENV } from "./_core/env";
import { stocksRouter } from "./routers/stocksRouter";
import { portfoliosRouter } from "./routers/portfoliosRouter";
import { portfolioPerformanceRouter } from "./routers/performanceRouter";
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

  // Extracted large routers
  stocks: stocksRouter,
  savedPortfolios: portfoliosRouter,
  portfolioPerformance: portfolioPerformanceRouter,
  admin: adminRouter,
  weeklyOverview: weeklyOverviewRouter,
  portfolioComparison: portfolioComparisonRouter,
  signals: signalsRouter,
  portfolio: portfolioOptimizerRouter,

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


  priceAlerts: priceAlertsRouter,

  chat: chatRouter,

  realizedGainsHistory: realizedGainsHistoryRouter,
  secrets: secretsRouter,
  testSecrets: testSecretsRouter,
  logs: logsRouter,
  notificationSettings: notificationSettingsRouter,
  
  // Onboarding: Demo portfolio creation
  onboarding: router({
    createDemoPortfolio: protectedProcedure.mutation(async ({ ctx }) => {
      const { getDb } = await import("./db");
      const { savedPortfolios, users, portfolioTransactions } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      
      if (!db) {
        throw new Error("Database not available");
      }
      
      // Check if user already has demo portfolio
      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      if (user?.hasDemoPortfolio) {
        throw new Error("Demo-Portfolio wurde bereits erstellt");
      }
      
      // Demo portfolio with realistic Swiss stocks
      const demoStocks = [
        { ticker: "NESN.SW", name: "Nestlé", weight: 20, shares: 5, price: 85.50, currency: "CHF" },
        { ticker: "NOVN.SW", name: "Novartis", weight: 20, shares: 12, price: 82.30, currency: "CHF" },
        { ticker: "ROG.SW", name: "Roche", weight: 15, shares: 6, price: 245.00, currency: "CHF" },
        { ticker: "UBSG.SW", name: "UBS Group", weight: 15, shares: 50, price: 29.50, currency: "CHF" },
        { ticker: "ZURN.SW", name: "Zurich Insurance", weight: 15, shares: 3, price: 520.00, currency: "CHF" },
        { ticker: "ABBN.SW", name: "ABB", weight: 15, shares: 30, price: 52.00, currency: "CHF" },
      ];
      
      const portfolioData = {
        stocks: demoStocks,
        metrics: {
          expectedReturn: 8.5,
          volatility: 12.3,
          sharpeRatio: 0.69,
          avgDividendYield: 3.2,
          avgPE: 18.5,
          avgPEG: 1.8,
        },
        strategy: "Max. Sharpe Ratio",
        timeFrame: "3Y",
      };
      
      // Create demo portfolio
      const [portfolio] = await db.insert(savedPortfolios).values({
        userId: ctx.user.id,
        name: "Demo Portfolio - Schweizer Blue Chips",
        description: "Beispiel-Portfolio mit Schweizer Unternehmen zum Kennenlernen!",
        portfolioData: JSON.stringify(portfolioData),
        isLive: 0,
        liveStartDate: null,
      });
      
      // Mark user as having demo portfolio
      await db.update(users)
        .set({ hasDemoPortfolio: 1 })
        .where(eq(users.id, ctx.user.id));
      
      return {
        success: true,
        message: "Demo-Portfolio erfolgreich erstellt!",
        portfolioId: portfolio.insertId,
      };
    }),
    
    markOnboardingSeen: protectedProcedure.mutation(async ({ ctx }) => {
      const { getDb } = await import("./db");
      const { users } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      
      if (!db) {
        throw new Error("Database not available");
      }
      
      await db.update(users)
        .set({ hasSeenOnboarding: 1 })
        .where(eq(users.id, ctx.user.id));
      
      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
