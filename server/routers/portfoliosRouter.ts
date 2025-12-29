import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

// Helper to get YTD start date (January 1st of current year)
function getYTDStartDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-01-01`;
}

export const portfoliosRouter = router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getSavedPortfolios, getPortfolioTransactions, getStockByTicker, getDb } = await import("../db");
      const portfolios = await getSavedPortfolios(ctx.user.id);
      
      // Batch load all stocks and historical prices for performance optimization
      const db = await getDb();
      if (!db) return portfolios;
      
      const { stocks: stocksTable, historicalPrices } = await import("../../drizzle/schema");
      const { inArray, and, eq, desc, lte } = await import("drizzle-orm");
      const { getStockCurrency, convertToCHF } = await import("../fxHelper");
      
      // Get all unique tickers from all live portfolios
      const livePortfolios = portfolios.filter(p => p.isLive && p.liveStartDate);
      const allTickers = new Set<string>();
      
      for (const portfolio of livePortfolios) {
        const transactions = await getPortfolioTransactions(portfolio.id);
        transactions.forEach((tx: any) => {
          if (tx.ticker) allTickers.add(tx.ticker);
        });
      }
      
      // Batch load all stocks
      const allStocksData = allTickers.size > 0
        ? await db.select().from(stocksTable).where(inArray(stocksTable.ticker, Array.from(allTickers)))
        : [];
      const stocksMap = new Map(allStocksData.map(s => [s.ticker, s]));
      
      // YTD start date for performance calculation
      const ytdStartDate = getYTDStartDate();
      const todayStr = new Date().toISOString().split('T')[0];
      
      // Batch load YTD start prices for all tickers
      const ytdPricesMap = new Map<string, number>();
      for (const ticker of Array.from(allTickers)) {
        // Try exact date first, then nearest previous date
        let [priceRecord] = await db
          .select()
          .from(historicalPrices)
          .where(
            and(
              eq(historicalPrices.ticker, ticker),
              eq(historicalPrices.date, ytdStartDate)
            )
          )
          .limit(1);
        
        if (!priceRecord) {
          // Find nearest previous date
          [priceRecord] = await db
            .select()
            .from(historicalPrices)
            .where(
              and(
                eq(historicalPrices.ticker, ticker),
                lte(historicalPrices.date, ytdStartDate)
              )
            )
            .orderBy(desc(historicalPrices.date))
            .limit(1);
        }
        
        if (priceRecord?.close) {
          ytdPricesMap.set(ticker, parseFloat(priceRecord.close));
        }
      }
      
      // Calculate YTD performance for each live portfolio
      const portfoliosWithPerformance = await Promise.all(
        portfolios.map(async (portfolio) => {
          if (!portfolio.isLive || !portfolio.liveStartDate) {
            return portfolio;
          }
          
          try {
            const transactions = await getPortfolioTransactions(portfolio.id);
            if (transactions.length === 0) {
              return { ...portfolio, livePerformance: 0, currentValue: 0, positionCount: 0 };
            }
            
            // Calculate current holdings from transactions
            const holdings: Record<string, number> = {};
            
            transactions.forEach((tx: any) => {
              const shares = parseFloat(tx.shares || '0');
              const ticker = tx.ticker;
              
              if (!ticker) return;
              
              if (tx.transactionType === 'buy') {
                holdings[ticker] = (holdings[ticker] || 0) + shares;
              } else if (tx.transactionType === 'sell') {
                holdings[ticker] = (holdings[ticker] || 0) - shares;
              }
            });
            
            // Calculate current value and YTD start value
            let currentValueCHF = 0;
            let ytdStartValueCHF = 0;
            
            for (const [ticker, shares] of Object.entries(holdings)) {
              if (shares <= 0) continue;
              
              const stock = stocksMap.get(ticker);
              if (!stock) continue;
              
              const currency = stock.currency || 'CHF';
              const currentPrice = parseFloat(stock.currentPrice || '0');
              
              // Get YTD start price
              const ytdStartPrice = ytdPricesMap.get(ticker) || currentPrice;
              
              // Convert to CHF
              const currentPriceCHF = await convertToCHF(currentPrice, currency, todayStr);
              const ytdStartPriceCHF = await convertToCHF(ytdStartPrice, currency, ytdStartDate);
              
              currentValueCHF += shares * currentPriceCHF;
              ytdStartValueCHF += shares * ytdStartPriceCHF;
            }
            
            // Calculate YTD performance
            const performanceCHF = currentValueCHF - ytdStartValueCHF;
            const performancePercent = ytdStartValueCHF > 0 
              ? (performanceCHF / ytdStartValueCHF) * 100 
              : 0;
            
            // Count unique positions with shares > 0
            const positionCount = Object.values(holdings).filter(s => s > 0).length;
            
            return { 
              ...portfolio, 
              livePerformance: performancePercent,
              currentValue: currentValueCHF,
              positionCount: positionCount
            };
          } catch (error) {
            console.error(`Error calculating YTD performance for portfolio ${portfolio.id}:`, error);
            return portfolio;
          }
        })
      );
      
      return portfoliosWithPerformance;
    }),

    get: protectedProcedure
      .input(z.number().int().positive())
      .query(async ({ input, ctx }) => {
        console.log('[portfolios.get] input:', input, 'type:', typeof input, 'userId:', ctx.user.id);
        const { getSavedPortfolioById } = await import("../db");
        const result = await getSavedPortfolioById(input, ctx.user.id);
        console.log('[portfolios.get] result:', result ? 'found' : 'not found');
        return result;
      }),

    // Get portfolio with currency conversion data
    getWithCurrency: protectedProcedure
      .input(z.number().int().positive())
      .query(async ({ input, ctx }) => {
        const { getSavedPortfolioById, getStockByTicker } = await import("../db");
        const { getStockCurrency, getCurrentFxRate, convertToCHF } = await import("../fxHelper");
        
        const portfolio = await getSavedPortfolioById(input, ctx.user.id);
        if (!portfolio) return null;
        
        // Parse portfolio data
        let portfolioData: { stocks: any[] } = { stocks: [] };
        try {
          portfolioData = JSON.parse(portfolio.portfolioData || '{}');
        } catch (e) {
          console.error('[getWithCurrency] Failed to parse portfolio data:', e);
        }
        
        const todayStr = new Date().toISOString().split('T')[0];
        
        // Enrich stocks with currency and FX data
        const enrichedStocks = await Promise.all(
          (portfolioData.stocks || []).map(async (stock: any) => {
            const ticker = stock.ticker;
            const dbStock = await getStockByTicker(ticker);
            const currency = dbStock?.currency || await getStockCurrency(ticker);
            const currentPrice = parseFloat(stock.currentPrice) || parseFloat(dbStock?.currentPrice || '0');
            
            // Get FX rate for this currency
            let fxRate = 1.0;
            if (currency !== 'CHF') {
              fxRate = await getCurrentFxRate(`${currency}CHF`);
            }
            
            const priceCHF = currentPrice * fxRate;
            
            // Calculate weight - for test portfolios, use equal weight if not specified
            const stockCount = portfolioData.stocks?.length || 1;
            const defaultWeight = 100 / stockCount;
            const weight = stock.portfolioWeight || stock.weight || defaultWeight;
            
            return {
              ...stock,
              currency,
              fxRate,
              currentPrice,
              currentPriceLocal: currentPrice,
              priceCHF,
              currentPriceCHF: priceCHF,
              weight: parseFloat(weight.toFixed(2)),
            };
          })
        );
        
        // Calculate total value and avg dividend yield
        let totalValueCHF = 0;
        let totalDividendYield = 0;
        enrichedStocks.forEach((stock: any) => {
          const shares = parseFloat(stock.shares) || 0;
          const priceCHF = stock.priceCHF || 0;
          totalValueCHF += shares * priceCHF;
          totalDividendYield += parseFloat(stock.dividendYield) || 0;
        });
        const avgDividendYield = enrichedStocks.length > 0 ? totalDividendYield / enrichedStocks.length : 0;
        
        return {
          ...portfolio,
          portfolioData: JSON.stringify({ ...portfolioData, stocks: enrichedStocks }),
          enrichedStocks,
          totalValueCHF,
          avgDividendYield,
        };
      }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          portfolioData: z.string(),
          isLive: z.number().optional().default(0),
          liveStartDate: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { createSavedPortfolio } = await import("../db");
        const result = await createSavedPortfolio({
          userId: ctx.user.id,
          name: input.name,
          description: input.description || null,
          portfolioData: input.portfolioData,
          isLive: input.isLive,
          liveStartDate: input.liveStartDate ? new Date(input.liveStartDate) : null,
        });
        return result;
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          name: z.string().min(1).optional(),
          description: z.string().optional(),
          portfolioData: z.string().optional(),
          isLive: z.number().optional(),
          liveStartDate: z.string().optional().nullable(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { updateSavedPortfolio } = await import("../db");
        const result = await updateSavedPortfolio(input.id, ctx.user.id, {
          name: input.name,
          description: input.description,
          portfolioData: input.portfolioData,
          isLive: input.isLive,
          liveStartDate: input.liveStartDate ? new Date(input.liveStartDate) : undefined,
        });
        return result;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const { deleteSavedPortfolio } = await import("../db");
        await deleteSavedPortfolio(input.id, ctx.user.id);
        return { success: true };
      }),

    // Get holdings with CHF performance for a portfolio
    getHoldingsWithChfPerformance: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        const { getSavedPortfolioById, getPortfolioTransactions, getStockByTicker } = await import("../db");
        const { getStockCurrency, convertToCHF, getHistoricalPrice } = await import("../fxHelper");
        
        const portfolio = await getSavedPortfolioById(input.id, ctx.user.id);
        if (!portfolio || !portfolio.isLive) return [];
        
        const transactions = await getPortfolioTransactions(input.id);
        if (transactions.length === 0) return [];
        
        // Calculate holdings from transactions
        const holdings: Record<string, { shares: number; totalInvestedCHF: number }> = {};
        
        transactions.forEach((tx: any) => {
          const ticker = tx.ticker;
          if (!ticker) return;
          
          const shares = parseFloat(tx.shares || '0');
          const amount = parseFloat(tx.totalAmountCHF || '0');
          
          if (!holdings[ticker]) {
            holdings[ticker] = { shares: 0, totalInvestedCHF: 0 };
          }
          
          if (tx.transactionType === 'buy') {
            holdings[ticker].shares += shares;
            holdings[ticker].totalInvestedCHF += amount;
          } else if (tx.transactionType === 'sell') {
            const avgCost = holdings[ticker].shares > 0 
              ? holdings[ticker].totalInvestedCHF / holdings[ticker].shares 
              : 0;
            holdings[ticker].shares -= shares;
            holdings[ticker].totalInvestedCHF -= shares * avgCost;
          }
        });
        
        const todayStr = new Date().toISOString().split('T')[0];
        const ytdStartDate = `${new Date().getFullYear()}-01-01`;
        
        // Calculate CHF values for each holding
        const results = [];
        for (const [ticker, holding] of Object.entries(holdings)) {
          if (holding.shares <= 0) continue;
          
          const stock = await getStockByTicker(ticker);
          if (!stock) continue;
          
          const currency = stock.currency || 'CHF';
          const currentPrice = parseFloat(stock.currentPrice || '0');
          const ytdStartPrice = await getHistoricalPrice(ticker, ytdStartDate) || currentPrice;
          
          const currentPriceCHF = await convertToCHF(currentPrice, currency, todayStr);
          const ytdStartPriceCHF = await convertToCHF(ytdStartPrice, currency, ytdStartDate);
          
          const currentValueCHF = holding.shares * currentPriceCHF;
          const ytdStartValueCHF = holding.shares * ytdStartPriceCHF;
          const performanceCHF = currentValueCHF - ytdStartValueCHF;
          const performancePercent = ytdStartValueCHF > 0 
            ? (performanceCHF / ytdStartValueCHF) * 100 
            : 0;
          
          results.push({
            ticker,
            companyName: stock.companyName,
            shares: holding.shares,
            currency,
            currentPrice,
            currentPriceCHF,
            currentValueCHF,
            totalInvestedCHF: holding.totalInvestedCHF,
            performanceCHF,
            performancePercent,
          });
        }
        
        return results;
      }),

    // Get historical portfolio performance based on daily closing prices
    getHistoricalPerformance: protectedProcedure
      .input(z.object({
        portfolioId: z.number().int().positive(),
        period: z.enum(['1M', '3M', '6M', '1Y', 'YTD', '3Y', '5Y', 'All']).default('YTD'),
        benchmark: z.string().default('SPY'),
      }))
      .query(async ({ input, ctx }) => {
        const { portfolioId, period, benchmark } = input;
        const { getSavedPortfolioById, getPortfolioTransactions, getStockByTicker, getDb } = await import("../db");
        const { convertToCHF } = await import("../fxHelper");
        
        const portfolio = await getSavedPortfolioById(portfolioId, ctx.user.id);
        if (!portfolio) {
          return { chartData: [], totalValueHistory: [] };
        }
        
        const isLivePortfolio = portfolio.isLive;
        let transactions: any[] = [];
        let portfolioStocks: any[] = [];
        
        if (isLivePortfolio) {
          transactions = await getPortfolioTransactions(portfolioId);
          if (transactions.length === 0) {
            return { chartData: [], totalValueHistory: [] };
          }
        } else {
          // For test portfolios, get stocks from portfolioData
          try {
            const portfolioData = typeof portfolio.portfolioData === 'string' 
              ? JSON.parse(portfolio.portfolioData) 
              : portfolio.portfolioData;
            portfolioStocks = portfolioData?.stocks || [];
            if (portfolioStocks.length === 0) {
              return { chartData: [], totalValueHistory: [] };
            }
          } catch (e) {
            return { chartData: [], totalValueHistory: [] };
          }
        }
        
        const db = await getDb();
        if (!db) return { chartData: [], totalValueHistory: [] };
        
        const { historicalPrices } = await import("../../drizzle/schema");
        const { eq, and, gte, lte, asc } = await import("drizzle-orm");
        
        // Calculate start date based on period
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        let startDate: Date;
        
        // For live portfolios, find the earliest transaction date
        let earliestTransactionDate: Date | null = null;
        if (isLivePortfolio && transactions.length > 0) {
          const sortedTx = [...transactions].sort((a: any, b: any) => 
            new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
          );
          earliestTransactionDate = new Date(sortedTx[0].transactionDate);
        }
        
        switch (period) {
          case '1M':
            startDate = new Date(today);
            startDate.setMonth(startDate.getMonth() - 1);
            break;
          case '3M':
            startDate = new Date(today);
            startDate.setMonth(startDate.getMonth() - 3);
            break;
          case '6M':
            startDate = new Date(today);
            startDate.setMonth(startDate.getMonth() - 6);
            break;
          case '1Y':
            startDate = new Date(today);
            startDate.setFullYear(startDate.getFullYear() - 1);
            break;
          case '3Y':
            startDate = new Date(today);
            startDate.setFullYear(startDate.getFullYear() - 3);
            break;
          case '5Y':
            startDate = new Date(today);
            startDate.setFullYear(startDate.getFullYear() - 5);
            break;
          case 'All':
            // Use earliest transaction date for live portfolios
            if (earliestTransactionDate) {
              startDate = earliestTransactionDate;
            } else {
              startDate = new Date(today);
              startDate.setFullYear(startDate.getFullYear() - 5);
            }
            break;
          case 'YTD':
          default:
            startDate = new Date(`${today.getFullYear()}-01-01`);
            break;
        }
        
        // For live portfolios, never start before the first transaction
        if (isLivePortfolio && earliestTransactionDate && startDate < earliestTransactionDate) {
          startDate = earliestTransactionDate;
        }
        
        const ytdStartDate = startDate.toISOString().split('T')[0];
        
        // Get all unique tickers - different logic for live vs test portfolios
        let tickers: string[] = [];
        const holdingsAtYtdStart: Record<string, { shares: number; avgCost: number; weight: number }> = {};
        
        if (isLivePortfolio) {
          // For live portfolios, get tickers from transactions
          const tickerSet = new Set(transactions.map((tx: any) => tx.ticker).filter(Boolean));
          tickers = Array.from(tickerSet);
          
          // Build holdings at YTD start based on transactions before that date
          const sortedTx = [...transactions].sort((a: any, b: any) => 
            new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
          );
          
          // Check if all transactions are after ytdStartDate (portfolio started after period start)
          const allTransactionsAfterStart = sortedTx.every((tx: any) => {
            const txDate = new Date(tx.transactionDate).toISOString().split('T')[0];
            return txDate >= ytdStartDate;
          });
          
          if (allTransactionsAfterStart) {
            // For portfolios that started during the period, initialize holdings from first transactions
            // and use the first transaction date as the effective start
            console.log(`[HistoricalPerformance] Portfolio started after ${ytdStartDate}, initializing from first transactions`);
            // Don't process transactions here - they will be processed in the main loop
            // Just initialize empty holdings for each ticker
            sortedTx.forEach((tx: any) => {
              const ticker = tx.ticker;
              if (!ticker) return;
              
              if (!holdingsAtYtdStart[ticker]) {
                holdingsAtYtdStart[ticker] = { shares: 0, avgCost: 0, weight: 0 };
              }
            });
          } else {
            // Normal case: process transactions before ytdStartDate
            sortedTx.forEach((tx: any) => {
              const txDate = new Date(tx.transactionDate).toISOString().split('T')[0];
              if (txDate >= ytdStartDate) return; // Only process transactions before YTD
              
              const ticker = tx.ticker;
              if (!ticker) return;
              
              if (!holdingsAtYtdStart[ticker]) {
                holdingsAtYtdStart[ticker] = { shares: 0, avgCost: 0, weight: 0 };
              }
              
              const shares = parseFloat(tx.shares) || 0;
              const price = parseFloat(tx.pricePerShare) || 0;
              
              if (tx.transactionType === 'buy') {
                const totalCost = holdingsAtYtdStart[ticker].shares * holdingsAtYtdStart[ticker].avgCost + shares * price;
                holdingsAtYtdStart[ticker].shares += shares;
                holdingsAtYtdStart[ticker].avgCost = holdingsAtYtdStart[ticker].shares > 0 
                  ? totalCost / holdingsAtYtdStart[ticker].shares 
                  : 0;
              } else if (tx.transactionType === 'sell') {
                holdingsAtYtdStart[ticker].shares -= shares;
              }
            });
          }
        } else {
          // For test portfolios, assume all stocks were held from period start with equal weight
          tickers = portfolioStocks.map((s: any) => s.ticker).filter(Boolean);
          const weightPerStock = 100 / tickers.length;
          
          tickers.forEach((ticker: string) => {
            holdingsAtYtdStart[ticker] = { 
              shares: 1, // Use 1 share as base for percentage calculation
              avgCost: 0, 
              weight: weightPerStock 
            };
          });
        }
        
        // For live portfolios, continue with transaction-based logic
        let sortedTx: any[] = [];
        if (isLivePortfolio) {
          sortedTx = [...transactions].sort((a: any, b: any) => 
            new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
          );
          
          // This part was already processed above for holdingsAtYtdStart
          // Now we need to handle transactions during the period
        }
        

        
        // Get historical prices for all tickers from YTD start to today
        const pricesMap: Record<string, Record<string, number>> = {};
        // Store last known price for forward-fill
        const lastKnownPrices: Record<string, number> = {};
        
        for (const ticker of tickers) {
          const prices = await db
            .select()
            .from(historicalPrices)
            .where(
              and(
                eq(historicalPrices.ticker, ticker),
                gte(historicalPrices.date, ytdStartDate),
                lte(historicalPrices.date, todayStr)
              )
            )
            .orderBy(asc(historicalPrices.date));
          
          pricesMap[ticker] = {};
          prices.forEach((p: any) => {
            const price = parseFloat(p.close) || 0;
            if (price > 0) {
              pricesMap[ticker][p.date] = price;
              lastKnownPrices[ticker] = price; // Track last known price
            }
          });
        }
        
        // Get stock currencies
        const stockCurrencies: Record<string, string> = {};
        for (const ticker of tickers) {
          const stock = await getStockByTicker(ticker);
          stockCurrencies[ticker] = stock?.currency || 'CHF';
        }
        
        // Generate daily portfolio values
        const chartData: { date: string; portfolio: number; benchmark: number }[] = [];
        let currentHoldings = { ...holdingsAtYtdStart };
        let txIndex = 0;
        
        // Fetch benchmark prices
        const benchmarkPrices = await db
          .select()
          .from(historicalPrices)
          .where(
            and(
              eq(historicalPrices.ticker, benchmark),
              gte(historicalPrices.date, ytdStartDate),
              lte(historicalPrices.date, todayStr)
            )
          )
          .orderBy(asc(historicalPrices.date));
        
        const benchmarkMap: Record<string, number> = {};
        benchmarkPrices.forEach((p: any) => {
          benchmarkMap[p.date] = parseFloat(p.close) || 0;
        });
        
        // Get benchmark starting price - find the first available price at or after ytdStartDate
        let benchmarkStartPrice = 0;
        const sortedBenchmarkDates = Object.keys(benchmarkMap).sort();
        for (const date of sortedBenchmarkDates) {
          if (date >= ytdStartDate) {
            benchmarkStartPrice = benchmarkMap[date];
            break;
          }
        }
        // Fallback to first available price if no price found at or after start date
        if (benchmarkStartPrice === 0 && benchmarkPrices.length > 0) {
          benchmarkStartPrice = parseFloat(String(benchmarkPrices[0]?.close || 0));
        }
        console.log(`[HistoricalPerformance] Benchmark ${benchmark} start price: ${benchmarkStartPrice}, ytdStartDate: ${ytdStartDate}`);
        
        // Get all dates with price data
        const allDates = new Set<string>();
        Object.values(pricesMap).forEach(prices => {
          Object.keys(prices).forEach(date => allDates.add(date));
        });
        // Also add benchmark dates
        Object.keys(benchmarkMap).forEach(date => allDates.add(date));
        const sortedDates = Array.from(allDates).sort();
        
        // Calculate starting value at YTD start
        let startingValueCHF = 0;
        const startingPricesCHF: Record<string, number> = {};
        
        console.log(`[HistoricalPerformance] holdingsAtYtdStart:`, JSON.stringify(holdingsAtYtdStart));
        console.log(`[HistoricalPerformance] isLivePortfolio: ${isLivePortfolio}, ytdStartDate: ${ytdStartDate}`);
        
        // For live portfolios that started during the period, we need to calculate starting value
        // based on the first transaction date, not YTD start
        const allTransactionsAfterStart = isLivePortfolio && transactions.length > 0 && transactions.every((tx: any) => {
          const txDate = new Date(tx.transactionDate).toISOString().split('T')[0];
          return txDate >= ytdStartDate;
        });
        
        // Get the first transaction date for portfolios that started during the period
        let effectiveStartDate = ytdStartDate;
        if (allTransactionsAfterStart && transactions.length > 0) {
          const sortedTransactions = [...transactions].sort((a: any, b: any) => 
            new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
          );
          effectiveStartDate = new Date(sortedTransactions[0].transactionDate).toISOString().split('T')[0];
          console.log(`[HistoricalPerformance] Portfolio started during period, effective start date: ${effectiveStartDate}`);
        }
        
        for (const [ticker, holding] of Object.entries(currentHoldings)) {
          if (holding.shares <= 0 && !holding.weight) continue;
          
          // Find the first available price (might not be exactly ytdStartDate)
          const tickerPrices = pricesMap[ticker] || {};
          const availableDates = Object.keys(tickerPrices).sort();
          const firstDate = availableDates[0] || ytdStartDate;
          const price = tickerPrices[firstDate] || tickerPrices[ytdStartDate] || 0;
          
          const currency = stockCurrencies[ticker] || 'CHF';
          const priceCHF = await convertToCHF(price, currency, firstDate);
          startingPricesCHF[ticker] = priceCHF;
          
          if (isLivePortfolio && !allTransactionsAfterStart) {
            // Only calculate starting value for portfolios that existed before the period
            startingValueCHF += holding.shares * priceCHF;
            console.log(`[HistoricalPerformance] ${ticker}: shares=${holding.shares}, price=${price}, priceCHF=${priceCHF}, subtotal=${holding.shares * priceCHF}`);
          }
        }
        console.log(`[HistoricalPerformance] startingValueCHF: ${startingValueCHF}`);
        
        // For test portfolios, we use weight-based calculation
        const isTestPortfolio = !isLivePortfolio;
        
        // Pre-calculate FX rates for all dates to avoid repeated API calls
        const fxRatesCache: Record<string, Record<string, number>> = {};
        const uniqueCurrencies = Array.from(new Set(Object.values(stockCurrencies)));
        
        for (const currency of uniqueCurrencies) {
          if (currency === 'CHF') continue;
          fxRatesCache[currency] = {};
          // Get FX rate for first date only (use same rate for all dates to speed up)
          const firstDate = sortedDates[0] || ytdStartDate;
          const rate = await convertToCHF(1, currency, firstDate);
          // Apply same rate to all dates
          for (const date of sortedDates) {
            fxRatesCache[currency][date] = rate;
          }
        }
        
        // Helper function to convert using cached rates
        const convertToCHFCached = (price: number, currency: string, date: string): number => {
          if (currency === 'CHF') return price;
          const rate = fxRatesCache[currency]?.[date] || 1;
          return price * rate;
        };
        
        // Sample dates to reduce data points (max 100 points for chart)
        const maxDataPoints = 100;
        const sampleInterval = Math.max(1, Math.floor(sortedDates.length / maxDataPoints));
        const sampledDates = sortedDates.filter((_, idx) => idx % sampleInterval === 0 || idx === sortedDates.length - 1);
        
        // Process each sampled date
        for (const date of sampledDates) {
          // Apply any transactions on this date (for live portfolios)
          while (txIndex < sortedTx.length) {
            const tx = sortedTx[txIndex] as any;
            const txDate = new Date(tx.transactionDate).toISOString().split('T')[0];
            if (txDate > date) break;
            
            const ticker = tx.ticker;
            if (ticker && txDate >= ytdStartDate) {
              if (!currentHoldings[ticker]) {
                currentHoldings[ticker] = { shares: 0, avgCost: 0, weight: 0 };
              }
              
              const shares = parseFloat(tx.shares) || 0;
              const price = parseFloat(tx.pricePerShare) || 0;
              
              if (tx.transactionType === 'buy') {
                const totalCost = currentHoldings[ticker].shares * currentHoldings[ticker].avgCost + shares * price;
                currentHoldings[ticker].shares += shares;
                currentHoldings[ticker].avgCost = currentHoldings[ticker].shares > 0 
                  ? totalCost / currentHoldings[ticker].shares 
                  : 0;
              } else if (tx.transactionType === 'sell') {
                currentHoldings[ticker].shares -= shares;
              }
            }
            txIndex++;
          }
          
          // Calculate portfolio performance on this date
          let portfolioPerformance = 0;
          
          if (isTestPortfolio) {
            // For test portfolios: calculate weighted average performance of all stocks
            let totalWeight = 0;
            let weightedPerformance = 0;
            
            for (const [ticker, holding] of Object.entries(currentHoldings)) {
              const weight = holding.weight || 0;
              if (weight <= 0) continue;
              
              const currentPrice = pricesMap[ticker]?.[date] || 0;
              const startPrice = startingPricesCHF[ticker] || 0;
              
              if (currentPrice > 0 && startPrice > 0) {
                const currency = stockCurrencies[ticker] || 'CHF';
                const currentPriceCHF = convertToCHFCached(currentPrice, currency, date);
                const stockPerformance = ((currentPriceCHF - startPrice) / startPrice) * 100;
                weightedPerformance += stockPerformance * (weight / 100);
                totalWeight += weight;
              }
            }
            
            portfolioPerformance = totalWeight > 0 ? weightedPerformance : 0;
          } else {
            // For live portfolios: calculate based on actual holdings value
            let totalValueCHF = 0;
            // Track forward-filled prices for this date
            const forwardFilledPrices: Record<string, number> = {};
            
            for (const [ticker, holding] of Object.entries(currentHoldings)) {
              if (holding.shares <= 0) continue;
              
              // Get price with forward-fill: use current date price, or last known price
              let price = pricesMap[ticker]?.[date] || 0;
              
              // Forward-fill: if no price for this date, use last known price
              if (price === 0) {
                // Find the most recent price before this date
                const tickerPrices = pricesMap[ticker] || {};
                const sortedPriceDates = Object.keys(tickerPrices).sort();
                for (const priceDate of sortedPriceDates) {
                  if (priceDate <= date && tickerPrices[priceDate] > 0) {
                    price = tickerPrices[priceDate];
                  }
                }
              }
              
              // Store the forward-filled price for future reference
              if (price > 0) {
                forwardFilledPrices[ticker] = price;
              }
              
              // Skip if still no price available
              if (price === 0) continue;
              
              const currency = stockCurrencies[ticker] || 'CHF';
              const priceCHF = convertToCHFCached(price, currency, date);
              totalValueCHF += holding.shares * priceCHF;
            }
            
            // For portfolios that started during the period, set starting value on first date with holdings
            if (startingValueCHF === 0 && totalValueCHF > 0) {
              startingValueCHF = totalValueCHF;
              console.log(`[HistoricalPerformance] Setting starting value on ${date}: ${startingValueCHF}`);
            }
            
            portfolioPerformance = startingValueCHF > 0 
              ? ((totalValueCHF - startingValueCHF) / startingValueCHF) * 100 
              : 0;
          }
          
          // Calculate benchmark performance from actual prices
          const benchmarkCurrentPrice = parseFloat(String(benchmarkMap[date] || 0));
          const benchmarkPerformance = benchmarkStartPrice > 0 && benchmarkCurrentPrice > 0
            ? ((benchmarkCurrentPrice - benchmarkStartPrice) / benchmarkStartPrice) * 100
            : 0;
          
          // Only add data point if we have valid performance data
          if (portfolioPerformance !== 0 || benchmarkPerformance !== 0) {
            chartData.push({
              date,
              portfolio: parseFloat(portfolioPerformance.toFixed(2)),
              benchmark: parseFloat(benchmarkPerformance.toFixed(2)),
            });
          }
        }
        
        return { chartData };
      }),
});
