import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";

/**
 * Portfolio weighting logic:
 * - When adding a stock with weight X%: redistribute all OTHER stocks equally to (100% - X%)
 * - When updating a stock weight: redistribute all OTHER stocks equally to remaining %
 * - When deleting a stock: redistribute all REMAINING stocks equally to 100%
 */
async function recalculateWeights(changedTicker?: string, isDelete: boolean = false) {
  const { getAllStocks, updateStock } = await import("./db");
  const allStocks = await getAllStocks();
  
  if (allStocks.length === 0) return;
  
  if (isDelete) {
    // Delete: redistribute all remaining stocks equally to 100%
    const equalWeight = 100 / allStocks.length;
    
    for (const stock of allStocks) {
      await updateStock(stock.ticker, {
        portfolioWeight: equalWeight.toFixed(4),
      });
    }
  } else if (changedTicker) {
    // Add or Update: redistribute all OTHER stocks equally
    const changedStock = allStocks.find(s => s.ticker === changedTicker);
    if (!changedStock) return;
    
    const changedWeight = parseFloat(changedStock.portfolioWeight || "0");
    const otherStocks = allStocks.filter(s => s.ticker !== changedTicker);
    
    if (otherStocks.length === 0) return;
    
    // Distribute remaining weight equally among other stocks
    const remainingWeight = 100 - changedWeight;
    const equalWeight = remainingWeight / otherStocks.length;
    
    for (const stock of otherStocks) {
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
        stockData.portfolioWeight = stockData.portfolioWeight || "0";
        
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
        
        // Recalculate weights: redistribute other stocks
        await recalculateWeights(stockData.ticker, false);
        
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
          await recalculateWeights(ticker, false);
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
        
        // Recalculate weights: redistribute all remaining stocks equally to 100%
        await recalculateWeights(undefined, true);
        
        return { success: true };
      }),
    refreshData: protectedProcedure.mutation(async () => {
      const { getAllStocks, updateStock } = await import("./db");
      
      const stocks = await getAllStocks();
      let ytdUpdated = 0;
      
      // Recalculate YTD performance for all stocks
      for (const stock of stocks) {
        if (stock.ytdStartPrice && stock.currentPrice) {
          const ytdStart = parseFloat(stock.ytdStartPrice);
          const current = parseFloat(stock.currentPrice);
          
          if (ytdStart > 0 && current > 0) {
            const ytdPerf = ((current - ytdStart) / ytdStart) * 100;
            await updateStock(stock.ticker, {
              ytdPerformance: ytdPerf.toFixed(2),
            });
            ytdUpdated++;
          }
        }
      }
      
      // Trigger news update (the news updater runs in background)
      try {
        const { updateNewsForAllStocks } = await import("./newsUpdater");
        // Run news update in background without waiting
        updateNewsForAllStocks().catch((error: any) => {
          console.error("[Refresh] News update failed:", error);
        });
      } catch (error) {
        console.error("[Refresh] Failed to trigger news update:", error);
      }
      
      return { 
        success: true, 
        message: `YTD Performance für ${ytdUpdated} Aktien aktualisiert. News werden im Hintergrund aktualisiert.`,
        ytdUpdated,
      };
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
});

export type AppRouter = typeof appRouter;

