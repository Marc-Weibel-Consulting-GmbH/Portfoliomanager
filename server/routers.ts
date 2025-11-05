import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { fetchStockMetrics } from "./_core/stockDataApi";
import { fetchEODHDFundamentals } from "./_core/eodhdApi";

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
  
  if (allStocks.length === 0) return;
  
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
          const apiKey = process.env.EODHD_API_KEY;
          if (!apiKey) throw new Error("EODHD API key not configured");

          // Clean ticker: replace " • " with "." (e.g., "NOVN • SW" -> "NOVN.SW")
          const cleanTicker = ticker.replace(/ • /g, ".").trim();

          // Fetch fundamentals from EODHD
          const fundamentalsUrl = `https://eodhd.com/api/fundamentals/${cleanTicker}?api_token=${apiKey}`;
          const fundamentalsRes = await fetch(fundamentalsUrl);
          if (!fundamentalsRes.ok) throw new Error("Failed to fetch fundamentals");
          const fundamentals = await fundamentalsRes.json();

          // Fetch real-time quote
          const quoteUrl = `https://eodhd.com/api/real-time/${cleanTicker}?api_token=${apiKey}&fmt=json`;
          const quoteRes = await fetch(quoteUrl);
          if (!quoteRes.ok) throw new Error("Failed to fetch quote");
          const quote = await quoteRes.json();

          // Fetch historical price for YTD start (31.12.2024 or last available trading day)
          let ytdStartPrice = null;
          try {
            const historicalUrl = `https://eodhd.com/api/eod/${cleanTicker}?api_token=${apiKey}&from=2024-12-27&to=2024-12-31&fmt=json`;
            const historicalRes = await fetch(historicalUrl);
            if (historicalRes.ok) {
              const historicalData = await historicalRes.json();
              if (historicalData && historicalData.length > 0) {
                // Get the last available trading day's close price
                ytdStartPrice = historicalData[historicalData.length - 1].close;
              }
            }
          } catch (err) {
            console.warn('[fetchStockData] Failed to fetch historical price:', err);
          }

          return {
            ticker: cleanTicker,
            companyName: fundamentals.General?.Name || cleanTicker,
            currentPrice: quote.close || 0,
            ytdStartPrice: ytdStartPrice,
            peRatio: fundamentals.Highlights?.PERatio || null,
            pegRatio: fundamentals.Highlights?.PEGRatio || null,
            dividendYield: fundamentals.Highlights?.DividendYield ? fundamentals.Highlights.DividendYield * 100 : null,
            sharpeRatio: fundamentals.Technicals?.SharpRatio || null,
            volatility: fundamentals.Technicals?.Volatility || null,
            beta: fundamentals.Technicals?.Beta || null,
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
        const stockData = input as any;
        
        // Set default values for required fields
        stockData.currency = stockData.currency || "USD";
        stockData.dividendYield = stockData.dividendYield || "0";
        stockData.pegRatio = stockData.pegRatio || "0";
        stockData.peRatio = stockData.peRatio || "0";
        stockData.portfolioWeight = stockData.portfolioWeight || "0";
        
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
      console.log('[RefreshData] Starting refresh...');
      const { getAllStocks, updateStock } = await import("./db");
      
      const stocks = await getAllStocks();
      console.log(`[RefreshData] Found ${stocks.length} stocks to update`);
      let updated = 0;
      let failed = 0;
      const errors: string[] = [];
      
      // Fetch fresh data for all stocks
      for (const stock of stocks) {
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
          if (fundamentals.pegRatio !== null && !isNaN(fundamentals.pegRatio)) {
            updateData.pegRatio = fundamentals.pegRatio.toFixed(2);
          }
          if (fundamentals.peRatio !== null && !isNaN(fundamentals.peRatio)) {
            updateData.peRatio = fundamentals.peRatio.toFixed(2);
          }
          if (fundamentals.dividendYield !== null && !isNaN(fundamentals.dividendYield)) {
            updateData.dividendYield = fundamentals.dividendYield.toFixed(2);
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
          
          // Delay to avoid rate limiting (1s for EODHD)
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error: any) {
          console.error(`[Refresh] Failed to update ${stock.ticker}:`, error);
          failed++;
          errors.push(`${stock.ticker}: ${error.message}`);
        }
      }
      
      // Trigger news update in background
      try {
        const { updateNewsForAllStocks } = await import("./newsUpdater");
        updateNewsForAllStocks().catch((error: any) => {
          console.error("[Refresh] News update failed:", error);
        });
      } catch (error) {
        console.error("[Refresh] Failed to trigger news update:", error);
      }
      
      return { 
        success: true, 
        message: `${updated} Aktien erfolgreich aktualisiert${failed > 0 ? `, ${failed} fehlgeschlagen` : ""}. News werden im Hintergrund aktualisiert.`,
        updated,
        failed,
        errors: failed > 0 ? errors : undefined,
      };
    }),
    portfolioPerformance: publicProcedure.query(async () => {
      const { getAllStocks } = await import("./db");
      const { calculatePortfolioPerformance } = await import("./_core/stockDataApi");
      
      const stocks = await getAllStocks();
      
      if (stocks.length === 0) {
        return [];
      }
      
      const performance = await calculatePortfolioPerformance(stocks);
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
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
            apiVersion: "2025-10-29.clover",
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
      const { getSavedPortfolios } = await import("./db");
      return await getSavedPortfolios(ctx.user.id);
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
  }),

  portfolioPerformance: router({
    getHistoricalData: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "tickers" in val && Array.isArray((val as any).tickers)) {
          return val as { tickers: string[]; weights: number[]; years?: number };
        }
        throw new Error("Invalid input: tickers and weights arrays required");
      })
      .query(async ({ input }) => {
        const { tickers, weights, years = 5 } = input;
        const apiKey = process.env.EODHD_API_KEY;
        if (!apiKey) throw new Error("EODHD API key not configured");

        const fromDate = new Date();
        fromDate.setFullYear(fromDate.getFullYear() - years);
        const fromDateStr = fromDate.toISOString().split('T')[0];
        const toDateStr = new Date().toISOString().split('T')[0];

        try {
          // Fetch historical data for each ticker
          const historicalDataPromises = tickers.map(async (ticker, index) => {
            const cleanTicker = ticker.replace(/\s+•\s+/, '.');
            const url = `https://eodhd.com/api/eod/${cleanTicker}?api_token=${apiKey}&from=${fromDateStr}&to=${toDateStr}&fmt=json`;
            const res = await fetch(url);
            if (!res.ok) return null;
            const data = await res.json();
            return { ticker: cleanTicker, data, weight: weights[index] || 0 };
          });

          const results = await Promise.all(historicalDataPromises);
          const validResults = results.filter((r): r is { ticker: string; data: any[]; weight: number } => r !== null && r.data && r.data.length > 0);

          if (validResults.length === 0) {
            return { dates: [], values: [] };
          }

          // Find common dates across all stocks
          const allDates = validResults[0]?.data.map((d: any) => d.date) || [];
          const dateSet = new Set(allDates);
          validResults.forEach(r => {
            if (r && r.data) {
              const dates = new Set(r.data.map((d: any) => d.date));
              dateSet.forEach(date => {
                if (!dates.has(date)) dateSet.delete(date);
              });
            }
          });

          const commonDates = Array.from(dateSet).sort();

          // Calculate weighted portfolio value for each date
          const portfolioValues = commonDates.map(date => {
            let totalValue = 0;
            validResults.forEach(r => {
              const dataPoint = r.data.find((d: any) => d.date === date);
              if (dataPoint) {
                totalValue += dataPoint.close * r.weight;
              }
            });
            return totalValue;
          });

          // Normalize to percentage (start at 100%)
          const startValue = portfolioValues[0] || 1;
          const percentageValues = portfolioValues.map(v => ((v / startValue) - 1) * 100);

          return {
            dates: commonDates,
            values: percentageValues,
          };
        } catch (error: any) {
          console.error('[portfolioPerformance] Error:', error);
          throw new Error(error.message || "Failed to fetch historical data");
        }
      }),

    getBenchmarkData: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "benchmark" in val) {
          return val as { benchmark: string; years?: number };
        }
        throw new Error("Invalid input: benchmark required");
      })
      .query(async ({ input }) => {
        const { benchmark, years = 5 } = input;

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

        const fromDate = new Date();
        fromDate.setFullYear(fromDate.getFullYear() - years);
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
          const validData: Array<{ date: string; close: number }> = [];
          for (let i = 0; i < timestamps.length; i++) {
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
      const { getStocks } = await import("./db");
      const { calculateStockScore, StockMetrics } = await import("./scoring");
      
      const stocks = await getStocks(ctx.user.id);
      
      const scores = stocks.map(stock => {
        const metrics: StockMetrics = {
          dividendYield: stock.dividendYield || undefined,
          payoutRatio: stock.payoutRatio || undefined,
          equityRatio: stock.equityRatio || undefined,
          peRatio: stock.peRatio || undefined,
          pegRatio: stock.pegRatio || undefined,
          earningsGrowth: stock.earningsGrowth || undefined,
          fcfYield: stock.fcfYield || undefined,
          revenueGrowth: stock.revenueGrowth || undefined,
        };
        
        return calculateStockScore(stock.ticker, metrics);
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
  }),
});

export type AppRouter = typeof appRouter;

