import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const portfolioPerformanceRouter = router({
    // YTD Performance using daily historical prices
    getYTDPerformance: protectedProcedure
      // Accept tickers/weights for backwards compatibility, but ignore them
      .input(z.object({
        tickers: z.array(z.string()).optional(),
        weights: z.array(z.number()).optional(),
      }).optional())
      .query(async () => {
        // Load all stocks from database (ignore input params)
        const { getAllStocks } = await import("../db");
        const stocks = await getAllStocks();
        const { calculateYTDPerformance } = await import("../ytd-performance");
        const dailyData = await calculateYTDPerformance(stocks);
        
        // Transform to { dates, values } format expected by chart
        return {
          dates: dailyData.map(d => d.date),
          values: dailyData.map(d => d.performance),
        };
      }),

    getHistoricalData: protectedProcedure
      .input(z.object({
        tickers: z.array(z.string()),
        weights: z.array(z.number()),
        years: z.number().optional(),
        ytd: z.boolean().optional(),
        ytdStartPrices: z.array(z.number()).optional(),
      }))
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
          const { getDb } = await import("../db");
          const db = await getDb();
          if (!db) {
            throw new Error('Database not available');
          }

          const { historicalPrices } = await import("../../drizzle/schema");
          const { and, eq, sql } = await import("drizzle-orm");

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
                  .filter(p => p.date && (p.adjustedClose || p.close)) // Filter out invalid entries
                  .map(p => ({
                    date: typeof p.date === 'string' ? p.date : (p.date as Date)?.toISOString().split('T')[0] || '',
                    // Use adjustedClose if available (split-adjusted), fallback to close
                    close: parseFloat((p.adjustedClose || p.close) as any)
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
      .input(z.object({
        benchmark: z.string(),
        years: z.number().optional(),
        ytd: z.boolean().optional(),
      }))
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
});
