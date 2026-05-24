import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { fetchStockMetrics } from "../_core/stockDataApi";
import { fetchEODHDFundamentals } from "../_core/eodhdApi";
import { fetchDividendYieldWithFallback } from "../_core/dividendYieldHelper";
import { recalculateWeights } from "../_core/portfolioWeightHelper";
import { getStockLogoUrl } from "../_core/stockLogo";

export const stocksRouter = router({
    getAll: publicProcedure.query(async () => {
      const { getAllStocks } = await import("../db");
      return await getAllStocks();
    }),

    getDailyPerformance: publicProcedure.query(async () => {
      const { getAllStocks, getDb } = await import("../db");
      const stocks = await getAllStocks();
      
      if (stocks.length === 0) {
        return { performance: 0, performanceAbsolute: 0 };
      }
      
      const db = await getDb();
      if (!db) {
        return { performance: 0, performanceAbsolute: 0 };
      }
      
      const { historicalPrices } = await import("../../drizzle/schema");
      const { eq, and, lte } = await import("drizzle-orm");
      const { getStockCurrency, convertToCHF } = await import("../fxHelper");
      
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
        const { getStockByTicker } = await import("../db");
        return await getStockByTicker(input.ticker);
      }),

    getByTickers: publicProcedure
      .input(z.object({
        tickers: z.array(z.string())
      }))
      .query(async ({ input }) => {
        const { getDb } = await import("../db");
        const { stocks } = await import("../../drizzle/schema");
        const { inArray } = await import("drizzle-orm");
        
        const db = await getDb();
        if (!db) return [];
        
        if (input.tickers.length === 0) return [];
        
        const result = await db
          .select()
          .from(stocks)
          .where(inArray(stocks.ticker, input.tickers));
        
        return result;
      }),

    getLogo: publicProcedure
      .input(z.object({
        ticker: z.string(),
        companyName: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const logoUrl = getStockLogoUrl(input.ticker, input.companyName);
        return { logoUrl };
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
        const { calculateHistoricalPE } = await import("../historical-pe");
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
        const { getHistoricalMetrics, getTrendSummary } = await import("../_core/historicalMetricsRecorder");
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
        const { fetchCompleteStockData } = await import("../_core/multiApiDataMerger");
        const { getDb } = await import("../db");
        const { stocks } = await import("../../drizzle/schema");
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
        if (completeData.logoUrl) updateData.logoUrl = completeData.logoUrl;

        // Update in database
        await db.update(stocks)
          .set(updateData)
          .where(eq(stocks.ticker, ticker));

        // Get old values for alert checking
        const oldStock = await db.select().from(stocks).where(eq(stocks.ticker, ticker)).limit(1);
        const oldValues = oldStock[0];

        // Record historical snapshot
        const { recordMetricsSnapshot } = await import("../_core/historicalMetricsRecorder");
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
        const { checkAlerts } = await import("../_core/alertSystem");
        const changes = [];
        if (updateData.sharpeRatio) changes.push({ ticker, metricName: 'sharpeRatio', oldValue: oldValues?.sharpeRatio || null, newValue: updateData.sharpeRatio });
        if (updateData.peRatio) changes.push({ ticker, metricName: 'peRatio', oldValue: oldValues?.peRatio || null, newValue: updateData.peRatio });
        if (updateData.dividendYield) changes.push({ ticker, metricName: 'dividendYield', oldValue: oldValues?.dividendYield || null, newValue: updateData.dividendYield });
        await checkAlerts(changes);

        // Return updated stock
        const updatedStock = await db.select().from(stocks).where(eq(stocks.ticker, ticker)).limit(1);
        return updatedStock[0] || null;
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
          const { fetchCompleteStockData } = await import("../_core/multiApiDataMerger");
          
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
            logoUrl: completeData.logoUrl || null,
          };
        } catch (error: any) {
          console.error("[fetchStockData] Error:", error);
          throw new Error(error.message || "Failed to fetch stock data");
        }
      }),
    list: publicProcedure.query(async () => {
      const { getAllStocks } = await import("../db");
      return await getAllStocks();
    }),
    getFxRates: publicProcedure.query(async () => {
      const db = await (await import("../db")).getDb();
      if (!db) return { USDCHF: 0.88, EURCHF: 0.93, GBPCHF: 1.12 };
      
      const { exchangeRates } = await import("../../drizzle/schema");
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
        const { getStocksByCategory } = await import("../db");
        return await getStocksByCategory(input);
      }),
    byTicker: publicProcedure
      .input((val: unknown) => {
        if (typeof val === "string") return val;
        throw new Error("Invalid ticker");
      })
      .query(async ({ input }) => {
        const { getStockByTicker } = await import("../db");
        return await getStockByTicker(input);
      }),
    stats: publicProcedure.query(async () => {
      const { getAllStocks } = await import("../db");
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
        const { insertStock, getAllStocks, logTransaction, updateStock } = await import("../db");
        const { notifyTransaction } = await import("../services/whatsapp");
        const { invokeLLM } = await import("../_core/llm");
        const { fetchCompleteStockData } = await import("../_core/multiApiDataMerger");
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
        if (!stockData.logoUrl && completeData.logoUrl) {
          stockData.logoUrl = completeData.logoUrl;
          console.log(`[AddStock] Auto-filled logoUrl: ${stockData.logoUrl} (from ${completeData.dataSources.logoUrl})`);
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
          const { getDb } = await import("../db");
          const { users } = await import("../../drizzle/schema");
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
        const { updateStock, getStockByTicker, logTransaction } = await import("../db");
        const { notifyTransaction } = await import("../services/whatsapp");
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
            const { getDb } = await import("../db");
            const { users } = await import("../../drizzle/schema");
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
        const { deleteStock, getStockByTicker, logTransaction } = await import("../db");
        const { notifyTransaction } = await import("../services/whatsapp");
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
            const { getDb } = await import("../db");
            const { users } = await import("../../drizzle/schema");
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
      const { getAllStocks, updateStock } = await import("../db");
      
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
          const { updateNewsForAllStocks } = await import("../newsUpdater");
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
        const { getStockByTicker, updateStock } = await import("../db");
        
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
              const { fetchEODHDHistorical } = await import("../_core/eodhdApi");
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
      const { getAllStocks } = await import("../db");
      const { calculatePortfolioPerformance } = await import("../_core/stockDataApi");
      
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
        const { findCompetitors } = await import("../_core/competitorAnalyzer");
        const { getAllStocks } = await import("../db");
        
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
        const { generateDailyNews } = await import("../_core/aiDailyNews");
        return await generateDailyNews(input.ticker, input.companyName);
      }),
    importPrices: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null) return val;
        throw new Error("Invalid input");
      })
      .mutation(async ({ input }) => {
        const { getAllStocks, updateStock, getStockByTicker } = await import("../db");
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

    // Get historical prices for a stock (for chart display)
    getHistoricalPrices: publicProcedure
      .input(z.object({
        ticker: z.string(),
        period: z.enum(['1D', '1W', '1M', '3M', '6M', '1Y', '3Y', '5Y', '10Y', 'YTD', 'All']).optional().default('6M'),
      }))
      .query(async ({ input }) => {
        const { getDb } = await import("../db");
        const { historicalPrices } = await import("../../drizzle/schema");
        const { eq, and, gte } = await import("drizzle-orm");
        
        const db = await getDb();
        if (!db) return [];
        
        // Calculate start date based on period
        const now = new Date();
        let startDate = new Date();
        
        switch (input.period) {
          case '1D':
            startDate.setDate(now.getDate() - 1);
            break;
          case '1W':
            startDate.setDate(now.getDate() - 7);
            break;
          case '1M':
            startDate.setMonth(now.getMonth() - 1);
            break;
          case '3M':
            startDate.setMonth(now.getMonth() - 3);
            break;
          case '6M':
            startDate.setMonth(now.getMonth() - 6);
            break;
          case '1Y':
            startDate.setFullYear(now.getFullYear() - 1);
            break;
          case '3Y':
            startDate.setFullYear(now.getFullYear() - 3);
            break;
          case '5Y':
            startDate.setFullYear(now.getFullYear() - 5);
            break;
          case '10Y':
            startDate.setFullYear(now.getFullYear() - 10);
            break;
          case 'YTD':
            // For YTD, start from Dec 25 of previous year to ensure we get the last trading day
            startDate = new Date(now.getFullYear() - 1, 11, 25);
            break;
          case 'All':
            startDate = new Date(2000, 0, 1); // Far back date
            break;
        }
        
        const startDateStr = startDate.toISOString().split('T')[0];
        
        try {
          // Note: historicalPrices table only has: date, close, adjustedClose, currency, source
          // We don't have open, high, low, volume - so we'll simulate them from close price
          const prices = await db
            .select({
              date: historicalPrices.date,
              close: historicalPrices.close,
              adjustedClose: historicalPrices.adjustedClose,
            })
            .from(historicalPrices)
            .where(
              and(
                eq(historicalPrices.ticker, input.ticker),
                gte(historicalPrices.date, startDateStr)
              )
            )
            .orderBy(historicalPrices.date);
          
          return prices.map(p => {
            const closePrice = p.close ? parseFloat(p.close) : null;
            // Simulate OHLV from close price (since we only have close)
            return {
              date: p.date,
              open: closePrice ? closePrice * (1 + (Math.random() - 0.5) * 0.01) : null,
              high: closePrice ? closePrice * (1 + Math.random() * 0.01) : null,
              low: closePrice ? closePrice * (1 - Math.random() * 0.01) : null,
              close: closePrice,
              volume: Math.floor(Math.random() * 1000000) + 500000, // Simulated volume
            };
          });
        } catch (error) {
          console.error(`[getHistoricalPrices] Error fetching prices for ${input.ticker}:`, error);
          return [];
        }
      }),
});
