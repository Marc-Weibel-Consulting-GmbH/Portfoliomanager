import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";

// Helper function with minimum 1% position logic
async function recalculateWeights(excludeTicker?: string, manuallyUpdatedTicker?: string) {
  const { getAllStocks, updateStock } = await import("./db");
  let allStocks = await getAllStocks();
  
  // Filter out the excluded ticker (if deleting)
  if (excludeTicker) {
    allStocks = allStocks.filter(s => s.ticker !== excludeTicker);
  }
  
  if (allStocks.length === 0) return;
  
  const MIN_POSITION = 1.0; // Minimum 1% per position
  
  if (manuallyUpdatedTicker) {
    // Manual weight update: identify manual vs auto stocks
    const manualStocks: typeof allStocks = [];
    const autoStocks: typeof allStocks = [];
    
    for (const stock of allStocks) {
      const weight = parseFloat(stock.portfolioWeight || "0");
      // Consider stocks > 1% OR the just-updated stock as "manual"
      if (weight > MIN_POSITION || stock.ticker === manuallyUpdatedTicker) {
        manualStocks.push(stock);
      } else {
        autoStocks.push(stock);
      }
    }
    
    // Calculate total manual weight
    const totalManualWeight = manualStocks.reduce((sum, s) => 
      sum + parseFloat(s.portfolioWeight || "0"), 0);
    
    // Remaining weight for auto stocks
    const remainingWeight = 100 - totalManualWeight;
    
    if (autoStocks.length > 0) {
      const equalWeight = remainingWeight / autoStocks.length;
      
      if (equalWeight >= MIN_POSITION) {
        // All auto stocks get equal share
        for (const stock of autoStocks) {
          await updateStock(stock.ticker, {
            portfolioWeight: equalWeight.toFixed(4),
          });
        }
      } else {
        // Equal weight below minimum: set auto to 1%, scale down manual
        const totalMinPositions = autoStocks.length * MIN_POSITION;
        const availableForManual = 100 - totalMinPositions;
        
        if (availableForManual >= manualStocks.length * MIN_POSITION) {
          // Set auto stocks to 1%
          for (const stock of autoStocks) {
            await updateStock(stock.ticker, {
              portfolioWeight: MIN_POSITION.toFixed(4),
            });
          }
          
          // Scale down manual weights proportionally
          for (const stock of manualStocks) {
            const currentWeight = parseFloat(stock.portfolioWeight || "0");
            const scaledWeight = (currentWeight / totalManualWeight) * availableForManual;
            await updateStock(stock.ticker, {
              portfolioWeight: Math.max(scaledWeight, MIN_POSITION).toFixed(4),
            });
          }
        } else {
          // Not enough space: equal weight for all
          const equalWeight = 100 / allStocks.length;
          for (const stock of allStocks) {
            await updateStock(stock.ticker, {
              portfolioWeight: equalWeight.toFixed(4),
            });
          }
        }
      }
    }
  } else {
    // Equal weight for all stocks (delete or add scenario)
    const equalWeight = 100 / allStocks.length;
    for (const stock of allStocks) {
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
  }),

  stocks: router({
    searchTicker: publicProcedure
      .input((val: unknown) => {
        if (typeof val === "string") return val;
        throw new Error("Invalid search query");
      })
      .query(async ({ input }) => {
        const { callDataApi } = await import("./_core/dataApi");
        try {
          const result = await callDataApi("yahoo-finance/search", { query: { q: input } }) as any;
          return result.quotes?.slice(0, 10) || [];
        } catch (error) {
          console.error("[Ticker Search] Failed:", error);
          return [];
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
      .mutation(async ({ input }) => {
        const { insertStock, getAllStocks, logTransaction, updateStock } = await import("./db");
        const { invokeLLM } = await import("./_core/llm");
        const stockData = input as any;
        
        // Set default values for required fields
        stockData.currency = stockData.currency || "USD";
        stockData.dividendYield = stockData.dividendYield || "0";
        stockData.pegRatio = stockData.pegRatio || "0";
        stockData.peRatio = stockData.peRatio || "0";
        
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
        
        // Log transaction
        await logTransaction({
          action: "add",
          ticker: stockData.ticker,
          companyName: stockData.companyName,
          details: JSON.stringify({ category: stockData.category, price: stockData.currentPrice }),
          newValue: stockData.portfolioWeight || "0",
        });
        
        // Recalculate weights for all stocks after adding a new one
        await recalculateWeights();
        
        return { success: true };
      }),
    update: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "ticker" in val) return val;
        throw new Error("Invalid input");
      })
      .mutation(async ({ input }) => {
        const { updateStock, getStockByTicker, logTransaction } = await import("./db");
        const { ticker, ...updates } = input as any;
        
        // Get old values before update
        const oldStock = await getStockByTicker(ticker);
        
        // Check if portfolioWeight is being updated
        const hasWeightUpdate = "portfolioWeight" in updates;
        
        await updateStock(ticker, updates);
        
        // Log transaction
        if (hasWeightUpdate) {
          await logTransaction({
            action: "update_weight",
            ticker,
            companyName: oldStock?.companyName || ticker,
            details: "Portfolio weight updated",
            oldValue: oldStock?.portfolioWeight || "0",
            newValue: updates.portfolioWeight,
          });
        } else {
          await logTransaction({
            action: "update_data",
            ticker,
            companyName: oldStock?.companyName || ticker,
            details: JSON.stringify(updates),
          });
        }
        
        // If weight was manually updated, recalculate other weights
        if (hasWeightUpdate) {
          await recalculateWeights(undefined, ticker);
        }
        
        return { success: true };
      }),
    delete: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "string") return val;
        throw new Error("Invalid ticker");
      })
      .mutation(async ({ input }) => {
        const { deleteStock, getStockByTicker, logTransaction } = await import("./db");
        
        // Get stock data before deletion
        const stock = await getStockByTicker(input);
        
        await deleteStock(input);
        
        // Log transaction
        if (stock) {
          await logTransaction({
            action: "delete",
            ticker: input,
            companyName: stock.companyName,
            details: JSON.stringify({ category: stock.category, weight: stock.portfolioWeight }),
            oldValue: stock.portfolioWeight || "0",
          });
        }
        
        // Recalculate weights for remaining stocks after deletion
        await recalculateWeights(input);
        
        return { success: true };
      }),
    refreshPrices: protectedProcedure.mutation(async () => {
      const { getAllStocks, updateStock } = await import("./db");
      const { callDataApi } = await import("./_core/dataApi");
      
      const stocks = await getAllStocks();
      let successCount = 0;
      let failCount = 0;
      let rateLimitHit = false;
      
      // Update prices with delay to avoid rate limiting
      for (const stock of stocks) {
        try {
          await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay between requests
          
          const response: any = await callDataApi("YahooFinance/quote", {
            query: { symbols: stock.ticker },
          });
          
          if (response?.quoteResponse?.result?.[0]) {
            const quote = response.quoteResponse.result[0];
            const newPrice = quote.regularMarketPrice;
            
            if (newPrice) {
              await updateStock(stock.ticker, {
                currentPrice: newPrice.toString(),
              });
              successCount++;
            }
          }
        } catch (error: any) {
          failCount++;
          if (error.message?.includes("429") || error.message?.includes("rate limit")) {
            rateLimitHit = true;
            break; // Stop if rate limit hit
          }
        }
      }
      
      if (rateLimitHit) {
        return { 
          success: false, 
          message: `Rate limit erreicht. ${successCount} Kurse aktualisiert, ${failCount} fehlgeschlagen. Bitte später erneut versuchen.`,
          successCount,
          failCount
        };
      }
      
      return { 
        success: true, 
        message: `${successCount} Kurse erfolgreich aktualisiert${failCount > 0 ? `, ${failCount} fehlgeschlagen` : ''}`,
        successCount,
        failCount
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
      const db = await getDb();
      if (!db) return [];
      const result: any = await db.execute("SELECT * FROM research ORDER BY created_at DESC");
      return result.rows || result;
    }),
    add: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null) return val;
        throw new Error("Invalid input");
      })
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const { research } = await import("../drizzle/schema");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const data = input as any;
        
        await db.insert(research).values({
          title: data.title,
          content: data.content || "",
          fileUrl: data.fileUrl || "",
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
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.execute(`DELETE FROM research WHERE id = ${input}`);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;

