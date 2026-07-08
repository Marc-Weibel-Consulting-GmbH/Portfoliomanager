import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { ENV } from "../_core/env";
// D-01: unified holdings replay (buy/entry/sell, chronological, DESC-safe) —
// replaces the previously inline re-implemented per-router replay loops.
import { buildHoldings } from "../lib/holdings";

// Helper to safely parse float values - handles 'NA', null, undefined
function safeParseFloat(value: string | null | undefined, fallback = 0): number {
  if (!value || value === 'NA' || value === 'N/A' || value === 'null') return fallback;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? fallback : parsed;
}

// Helper to get YTD start date (January 1st of current year)
function getYTDStartDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-01-01`;
}

export const dashboardRouter = router({
  // Get aggregated metrics - supports scope parameter for per-portfolio metrics
  getAggregatedMetrics: protectedProcedure
    .input(z.object({ scope: z.union([z.literal("aggregate"), z.number()]).optional().default("aggregate") }).optional().default({ scope: "aggregate" }))
    .query(async ({ ctx, input }) => {
    const { getSavedPortfolios, getStockByTicker } = await import("../db");
    const { batchGetPortfolioTransactions, batchGetStocks, batchGetHistoricalPrices } = await import("../db-optimized");
    const { convertToCHF } = await import("../fxHelper");
    
    const portfolios = await getSavedPortfolios(ctx.user.id);
    
    // Filter portfolios based on scope
    let targetPortfolios: typeof portfolios;
    if (input.scope === "aggregate") {
      targetPortfolios = portfolios; // All portfolios
    } else {
      targetPortfolios = portfolios.filter(p => p.id === input.scope);
    }
    const livePortfolios = targetPortfolios.filter(p => p.isLive === 1 && p.liveStartDate);
    const demoPortfolios = targetPortfolios.filter(p => p.isLive !== 1);
    
    // Helper function to calculate portfolio value from portfolioData (for consistent values)
    // Optionally collects the resolved positions (for the day-change calculation, R-29).
    const calculatePortfolioValueFromData = async (
      portfolio: any,
      holdingsOut?: Array<{ ticker: string; shares: number; currency: string }>
    ): Promise<number> => {
      try {
        const portfolioData = JSON.parse(portfolio.portfolioData || '{}');
        const stocks = portfolioData.stocks || portfolioData.positions || [];
        
        if (stocks.length === 0) return 0;
        
        let totalValueCHF = 0;
        const investmentAmount = parseFloat(portfolio.investmentAmount || '0');
        const todayStr = new Date().toISOString().split('T')[0];
        
        for (const stock of stocks) {
          const ticker = stock.ticker;
          if (!ticker) continue;
          
          const stockData = await getStockByTicker(ticker);
          if (!stockData) continue;
          
          const currentPrice = safeParseFloat(stockData.currentPrice);
          if (!currentPrice || isNaN(currentPrice)) continue; // Skip stocks with invalid prices
          const currency = stockData.currency || 'CHF';
          const weight = parseFloat(stock.weight || '0') / 100;
          
          let shares = parseFloat(stock.shares || '0') || 0;
          if (shares === 0 && investmentAmount > 0 && weight > 0) {
            const allocationCHF = investmentAmount * weight;
            const priceCHF = await convertToCHF(currentPrice, currency, todayStr);
            shares = (priceCHF > 0 ? allocationCHF / priceCHF : 0) || 0;
          }
          
          const priceCHF = await convertToCHF(currentPrice, currency, todayStr);
          const positionValue = (shares * priceCHF) || 0;
          totalValueCHF += positionValue;
          holdingsOut?.push({ ticker, shares, currency });
        }
        
        const cashBalance = parseFloat(portfolio.cashBalance || '0') || 0;
        totalValueCHF += cashBalance;
        
        return totalValueCHF;
      } catch (error) {
        console.error(`[dashboard.getAggregatedMetrics] Error calculating value from portfolioData:`, error);
        return 0;
      }
    };
    
    if (livePortfolios.length === 0 && demoPortfolios.length === 0) {
      return {
        totalValue: 0,
        totalPerformance: 0,
        totalPerformancePercent: 0,
        totalDividends: 0,
        portfolioCount: portfolios.length,
        livePortfolioCount: 0,
      };
    }
    
    const ytdStartDate = getYTDStartDate();
    const today = new Date().toISOString().split('T')[0];
    
    // OPTIMIZATION: Batch load ALL transactions in ONE query
    const portfolioIds = livePortfolios.map(p => p.id);
    const transactionsByPortfolio = await batchGetPortfolioTransactions(portfolioIds);
    
    // OPTIMIZATION: Collect all unique tickers (from live transactions AND demo portfolioData)
    const allTickers = new Set<string>();
    for (const transactions of Array.from(transactionsByPortfolio.values())) {
      transactions.forEach(tx => {
        if (tx.ticker) allTickers.add(tx.ticker);
      });
    }
    // Also add tickers from demo portfolios
    for (const portfolio of demoPortfolios) {
      try {
        const pd = JSON.parse(portfolio.portfolioData || '{}');
        const stocks = pd.stocks || pd.positions || [];
        for (const s of stocks) {
          if (s.ticker) allTickers.add(s.ticker);
        }
      } catch (e) { /* ignore */ }
    }
    
    if (allTickers.size === 0) {
      return {
        totalValue: 0,
        totalPerformance: 0,
        totalPerformancePercent: 0,
        totalDividends: 0,
        portfolioCount: portfolios.length,
        livePortfolioCount: livePortfolios.length,
      };
    }
    
    // OPTIMIZATION: Batch load ALL stocks in ONE query
    const stocksMap = await batchGetStocks(Array.from(allTickers));
    
    // OPTIMIZATION: Batch load ALL historical prices in ONE query
    const ytdPricesMap = await batchGetHistoricalPrices(Array.from(allTickers), ytdStartDate);
    
    // OPTIMIZATION: Pre-warm FX cache (fxHelper caches in-memory, D-02)
    const uniqueCurrencies = new Set<string>();
    for (const stock of Array.from(stocksMap.values())) {
      if (stock.currency) uniqueCurrencies.add(stock.currency);
    }

    const fxPromises = [];
    for (const currency of Array.from(uniqueCurrencies)) {
      if (currency !== 'CHF') {
        fxPromises.push(convertToCHF(1, currency, today));
        fxPromises.push(convertToCHF(1, currency, ytdStartDate));
      }
    }
    await Promise.all(fxPromises);
    
    let totalValueCHF = 0;
    let totalValueYTDStartCHF = 0;
    let totalDividendsCHF = 0;
    let totalInvestedCHF = 0;
    // Positions across all portfolios, for the day-change calculation (R-29)
    const dayChangeHoldings: Array<{ ticker: string; shares: number; currency: string }> = [];

    // Helper: Calculate portfolio value at a specific date using historical prices
    // Uses FIXED shares (calculated from current price) to ensure consistent comparison
    const calculatePortfolioValueAtDate = async (portfolio: any, dateStr: string): Promise<number> => {
      try {
        const portfolioData = JSON.parse(portfolio.portfolioData || '{}');
        const stocks = portfolioData.stocks || portfolioData.positions || [];
        if (stocks.length === 0) return 0;
        
        let totalValueAtDate = 0;
        const investmentAmount = parseFloat(portfolio.investmentAmount || '0');
        const usePricesMap = ytdPricesMap;
        const todayForFx = new Date().toISOString().split('T')[0];
        
        for (const stock of stocks) {
          const ticker = stock.ticker;
          if (!ticker) continue;
          
          const stockData = stocksMap.get(ticker) as any;
          if (!stockData) continue;
          
          const currency = stockData.currency || 'CHF';
          const weight = parseFloat(stock.weight || '0') / 100;
          
          // Get historical price at the given date
          const historicalPrice = usePricesMap.get(ticker);
          if (!historicalPrice) continue;
          
          // Calculate shares using CURRENT price (same as calculatePortfolioValueFromData)
          // This ensures dayChange reflects actual price movement, not share count differences
          let shares = parseFloat(stock.shares || '0') || 0;
          if (shares === 0 && investmentAmount > 0 && weight > 0) {
            const currentPrice = parseFloat(stockData.currentPrice || '0');
            const currentPriceCHF = await convertToCHF(currentPrice, currency, todayForFx);
            shares = (currentPriceCHF > 0 ? (investmentAmount * weight) / currentPriceCHF : 0) || 0;
          }
          
          const priceCHF = await convertToCHF(historicalPrice, currency, dateStr);
          const posValue = (shares * priceCHF) || 0;
          totalValueAtDate += posValue;
        }
        
        const cashBalance = parseFloat(portfolio.cashBalance || '0') || 0;
        totalValueAtDate += cashBalance;
        
        return totalValueAtDate;
      } catch (error) {
        console.error(`[dashboard.getAggregatedMetrics] Error calculating value at date:`, error);
        return 0;
      }
    };
    
    // Calculate metrics for each live portfolio
    for (const portfolio of livePortfolios) {
      const transactions = transactionsByPortfolio.get(portfolio.id) || [];
      
      // Calculate dividend income from transactions
      let dividendIncome = 0;
      for (const tx of transactions) {
        if (tx.transactionType === 'dividend') {
          dividendIncome += parseFloat(tx.totalAmountCHF || '0');
        }
      }
      totalDividendsCHF += dividendIncome;
      
      // Calculate CURRENT value from portfolioData for consistency
      const portfolioValueCHF = await calculatePortfolioValueFromData(portfolio, dayChangeHoldings);
      const investmentAmount = parseFloat(portfolio.investmentAmount || '0');

      // Calculate YTD start value using actual historical prices (same method as portfoliosRouter.list)
      const ytdStartValue = await calculatePortfolioValueAtDate(portfolio, ytdStartDate);
      // If we couldn't get historical prices, fall back to investmentAmount
      const portfolioValueYTDStartCHF = ytdStartValue > 0 ? ytdStartValue : (investmentAmount || portfolioValueCHF);

      totalValueCHF += portfolioValueCHF;
      totalValueYTDStartCHF += portfolioValueYTDStartCHF;
      totalInvestedCHF += investmentAmount;
    }

    // Also calculate values for demo portfolios
    for (const portfolio of demoPortfolios) {
      const portfolioValueCHF = await calculatePortfolioValueFromData(portfolio, dayChangeHoldings);
      const investmentAmount = parseFloat(portfolio.investmentAmount || '0');

      // Calculate YTD start value using actual historical prices
      const ytdStartValue = await calculatePortfolioValueAtDate(portfolio, ytdStartDate);
      const portfolioValueYTDStartCHF = ytdStartValue > 0 ? ytdStartValue : (investmentAmount || portfolioValueCHF);

      totalValueCHF += portfolioValueCHF;
      totalValueYTDStartCHF += portfolioValueYTDStartCHF;
      totalInvestedCHF += investmentAmount;
    }
    
    // Calculate YTD performance
    const totalPerformanceCHF = totalValueCHF - totalValueYTDStartCHF;
    const totalPerformancePercent = totalValueYTDStartCHF > 0 
      ? (totalPerformanceCHF / totalValueYTDStartCHF) * 100 
      : 0;
    
    // Calculate benchmark performance (SPY YTD)
    const benchmarkTicker = 'SPY';
    const { getDb } = await import("../db");
    const { historicalPrices } = await import("../../drizzle/schema");
    const { eq, and, lte, gte, desc, inArray } = await import("drizzle-orm");
    
    let benchmarkPerformance = 0;
    let benchmarkSmiYtd = 0;
    let benchmarkMsciYtd = 0;
    try {
      const db = await getDb();
      if (db) {
        // Helper to get YTD performance for a ticker
        const getTickerYtdPerf = async (ticker: string): Promise<number> => {
          const ytdPrices = await db
            .select()
            .from(historicalPrices)
            .where(and(eq(historicalPrices.ticker, ticker), lte(historicalPrices.date, ytdStartDate)))
            .orderBy(desc(historicalPrices.date))
            .limit(1);
          const currentPrices = await db
            .select()
            .from(historicalPrices)
            .where(and(eq(historicalPrices.ticker, ticker), lte(historicalPrices.date, today)))
            .orderBy(desc(historicalPrices.date))
            .limit(1);
          if (ytdPrices.length > 0 && currentPrices.length > 0) {
            const ytdPrice = parseFloat(ytdPrices[0].close || '0');
            const currentPrice = parseFloat(currentPrices[0].close || '0');
            if (ytdPrice > 0) return ((currentPrice - ytdPrice) / ytdPrice) * 100;
          }
          return 0;
        };
        
        benchmarkPerformance = await getTickerYtdPerf(benchmarkTicker);
        benchmarkSmiYtd = await getTickerYtdPerf('CHSPI.SW');
        benchmarkMsciYtd = await getTickerYtdPerf('ACWI.US');
      }
    } catch (error) {
      console.error('[dashboard.getAggregatedMetrics] Error calculating benchmark performance:', error);
    }
    
    // Calculate average dividend yield across all stocks in target portfolios
    let totalDividendYield = 0;
    let stockCount = 0;
    
    for (const portfolio of [...livePortfolios, ...demoPortfolios]) {
      try {
        const portfolioData = JSON.parse(portfolio.portfolioData || '{}');
        const stocks = portfolioData.stocks || portfolioData.positions || [];
        
        for (const stock of stocks) {
          const ticker = stock.ticker;
          if (!ticker) continue;
          
          const stockData = stocksMap.get(ticker);
          if (!stockData) continue;
          
          const dividendYield = parseFloat(stockData.dividendYield || '0');
          if (dividendYield > 0) {
            totalDividendYield += dividendYield;
            stockCount++;
          }
        }
      } catch (error) {
        console.error(`[dashboard.getAggregatedMetrics] Error calculating dividend yield for portfolio ${portfolio.id}:`, error);
      }
    }
    
    const avgDividendYield = stockCount > 0 ? totalDividendYield / stockCount : 0;
    
    // Calculate day change (R-29): per ticker close(last trading day) vs
    // close(previous trading day), both from historicalPrices, symmetric
    // skipping and ONE FX rate per currency — see server/lib/dayChange.ts.
    // vorher: totalValue (stocks.currentPrice) minus totalValueYesterday
    // (historicalPrices, asymmetrisch geskippt) — ein Titel mit currentPrice
    // aber ohne Historie erschien mit vollem Positionswert als Tagesgewinn.
    let dayChangeCHF = 0;
    let dayChangePercent = 0;
    try {
      const db = await getDb();
      if (db && dayChangeHoldings.length > 0) {
        // Fetch recent closes (14 calendar days cover weekends + holidays)
        const lookbackStart = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const tickerVariants = new Set<string>();
        for (const h of dayChangeHoldings) {
          tickerVariants.add(h.ticker);
          if (h.ticker.endsWith('.US')) tickerVariants.add(h.ticker.slice(0, -3));
          else tickerVariants.add(h.ticker + '.US');
        }
        const priceRows = await db
          .select()
          .from(historicalPrices)
          .where(and(
            inArray(historicalPrices.ticker, Array.from(tickerVariants)),
            gte(historicalPrices.date, lookbackStart),
            lte(historicalPrices.date, today)
          ));

        const rowsByDbTicker = new Map<string, Array<{ date: string; close: number }>>();
        for (const row of priceRows) {
          const close = parseFloat(row.close || '0');
          if (!(close > 0)) continue;
          const date = typeof row.date === 'string' ? row.date : new Date(row.date as any).toISOString().split('T')[0];
          if (!rowsByDbTicker.has(row.ticker)) rowsByDbTicker.set(row.ticker, []);
          rowsByDbTicker.get(row.ticker)!.push({ date, close });
        }
        // Map DB ticker variants (with/without .US) back to the holding tickers
        const priceRowsByTicker = new Map<string, Array<{ date: string; close: number }>>();
        for (const h of dayChangeHoldings) {
          if (priceRowsByTicker.has(h.ticker)) continue;
          const variant = h.ticker.endsWith('.US') ? h.ticker.slice(0, -3) : h.ticker + '.US';
          const rows = rowsByDbTicker.get(h.ticker) ?? rowsByDbTicker.get(variant);
          if (rows) priceRowsByTicker.set(h.ticker, rows);
        }

        // One FX rate per currency, applied to both sides (pure price movement)
        const fxRateByCurrency = new Map<string, number>();
        for (const currency of Array.from(uniqueCurrencies)) {
          if (currency === 'CHF') continue;
          const rate = await convertToCHF(1, currency, today);
          fxRateByCurrency.set(currency, rate);
        }

        const { computeDayChange } = await import("../lib/dayChange");
        const dayChange = computeDayChange(dayChangeHoldings, priceRowsByTicker, fxRateByCurrency);
        dayChangeCHF = dayChange.dayChangeCHF;
        dayChangePercent = dayChange.dayChangePercent;
      }
    } catch (error) {
      console.error('[dashboard.getAggregatedMetrics] Error calculating day change:', error);
    }
    
    return {
      totalValue: isFinite(totalValueCHF) ? totalValueCHF : 0,
      totalInvested: isFinite(totalInvestedCHF) ? totalInvestedCHF : 0,
      totalPerformance: isFinite(totalPerformanceCHF) ? totalPerformanceCHF : 0,
      totalPerformancePercent: isFinite(totalPerformancePercent) ? totalPerformancePercent : 0,
      totalDividends: isFinite(totalDividendsCHF) ? totalDividendsCHF : 0,
      portfolioCount: portfolios.length,
      livePortfolioCount: livePortfolios.length,
      benchmarkPerformance: isFinite(benchmarkPerformance) ? benchmarkPerformance : 0,
      benchmarkSmiYtd: isFinite(benchmarkSmiYtd) ? benchmarkSmiYtd : 0,
      benchmarkMsciYtd: isFinite(benchmarkMsciYtd) ? benchmarkMsciYtd : 0,
      avgDividendYield: isFinite(avgDividendYield) ? avgDividendYield : 0,
      dayChange: isFinite(dayChangeCHF) ? dayChangeCHF : 0,
      dayChangePercent: isFinite(dayChangePercent) ? dayChangePercent : 0,
    };
  }),
  
  // Get all portfolios with YTD performance
  getTopPortfolios: protectedProcedure.query(async ({ ctx }) => {
    const { getSavedPortfolios, getPortfolioTransactions } = await import("../db");
    const { batchGetStocks, batchGetHistoricalPrices } = await import("../db-optimized");
    const { convertToCHF } = await import("../fxHelper");
    
    const portfolios = await getSavedPortfolios(ctx.user.id);
    console.log(`[getTopPortfolios] userId=${ctx.user.id}, found ${portfolios.length} portfolios`);
    if (portfolios.length === 0) return [];

    const ytdStartDate = getYTDStartDate();
    const todayStr = new Date().toISOString().split('T')[0];

    // Collect all tickers from all portfolios
    const allTickers = new Set<string>();
    const transactionsByPortfolio = new Map<number, any[]>();
    
    for (const portfolio of portfolios) {
      if (portfolio.isLive && portfolio.liveStartDate) {
        const txs = await getPortfolioTransactions(portfolio.id);
        transactionsByPortfolio.set(portfolio.id, txs);
        txs.forEach((tx: any) => { if (tx.ticker) allTickers.add(tx.ticker); });
      } else {
        try {
          const pd = JSON.parse(portfolio.portfolioData || '{}');
          const stocks = pd.stocks || pd.positions || [];
          stocks.forEach((s: any) => { if (s.ticker) allTickers.add(s.ticker); });
        } catch (e) { console.warn('[dashboardRouter] Parsen von portfolioData (Ticker-Sammlung) fehlgeschlagen:', e); }
      }
    }

    const stocksMap = allTickers.size > 0 ? await batchGetStocks(Array.from(allTickers)) : new Map<string, any>();
    const ytdPricesMap = allTickers.size > 0 ? await batchGetHistoricalPrices(Array.from(allTickers), ytdStartDate) : new Map<string, number>();

    // Pre-warm FX cache
    const uniqueCurrencies = new Set<string>();
    for (const stock of Array.from(stocksMap.values())) {
      if ((stock as any).currency) uniqueCurrencies.add((stock as any).currency);
    }
    await Promise.all(Array.from(uniqueCurrencies).filter(c => c !== 'CHF').flatMap(c => [
      convertToCHF(1, c, todayStr),
      convertToCHF(1, c, ytdStartDate),
    ]));

    const portfolioMetrics = [];

    for (const portfolio of portfolios) {
      try {
        let portfolioValueCHF = 0;
        let performancePercent = 0;
        const isLive = !!(portfolio.isLive && portfolio.liveStartDate);

        if (isLive) {
          // Live portfolio: calculate from transactions with YTD historical prices
          const transactions = transactionsByPortfolio.get(portfolio.id) || [];
          const holdings = buildHoldings(transactions);

          let currentValueForPerf = 0;
          let ytdStartValueCHF = 0;
          let hasHistoricalData = false;

          for (const [ticker, { shares }] of Array.from(holdings.entries())) {
            if (shares <= 0) continue;
            const stock = stocksMap.get(ticker) as any;
            if (!stock) continue;
            const currency = stock.currency || 'CHF';
            const currentPrice = safeParseFloat(stock.currentPrice);
            const ytdStartPrice = ytdPricesMap.get(ticker);
            const currentPriceCHF = await convertToCHF(currentPrice, currency, todayStr);
            portfolioValueCHF += shares * currentPriceCHF;
            if (ytdStartPrice) {
              hasHistoricalData = true;
              const ytdStartPriceCHF = await convertToCHF(ytdStartPrice as number, currency, ytdStartDate);
              currentValueForPerf += shares * currentPriceCHF;
              ytdStartValueCHF += shares * ytdStartPriceCHF;
            }
          }
          const cashBalance = parseFloat(portfolio.cashBalance || '0');
          portfolioValueCHF += cashBalance;

          if (hasHistoricalData && ytdStartValueCHF > 0) {
            performancePercent = ((currentValueForPerf - ytdStartValueCHF) / ytdStartValueCHF) * 100;
          }
        } else {
          // Demo portfolio: calculate from portfolioData using historical prices for YTD
          const pd = JSON.parse(portfolio.portfolioData || '{}');
          const stocks = pd.stocks || pd.positions || [];
          const investmentAmount = parseFloat(portfolio.investmentAmount || '0');
          
          let currentValueForPerf = 0;
          let ytdStartValueCHF = 0;
          let hasHistoricalData = false;
          
          for (const stock of stocks) {
            const ticker = stock.ticker;
            if (!ticker) continue;
            const stockData = stocksMap.get(ticker) as any;
            if (!stockData) continue;
            const currentPrice = safeParseFloat(stockData.currentPrice);
            const currency = stockData.currency || 'CHF';
            const weight = parseFloat(stock.weight || '0') / 100;
            
            // Determine shares: use stored shares, or derive from investmentAmount+weight
            let shares = parseFloat(stock.shares || '0');
            const ytdStartPrice = ytdPricesMap.get(ticker);
            
            if (shares === 0 && weight > 0) {
              // Derive shares from YTD start price (so performance is normalized to YTD start)
              if (ytdStartPrice) {
                const ytdPriceCHF = await convertToCHF(ytdStartPrice, currency, ytdStartDate);
                const allocationCHF = investmentAmount > 0 ? investmentAmount * weight : 100000 * weight;
                shares = ytdPriceCHF > 0 ? allocationCHF / ytdPriceCHF : 0;
              } else if (investmentAmount > 0) {
                const priceCHF = await convertToCHF(currentPrice, currency, todayStr);
                const allocationCHF = investmentAmount * weight;
                shares = priceCHF > 0 ? allocationCHF / priceCHF : 0;
              }
            }
            
            const currentPriceCHF = await convertToCHF(currentPrice, currency, todayStr);
            portfolioValueCHF += shares * currentPriceCHF;
            currentValueForPerf += shares * currentPriceCHF;
            
            if (ytdStartPrice && shares > 0) {
              hasHistoricalData = true;
              const ytdStartPriceCHF = await convertToCHF(ytdStartPrice, currency, ytdStartDate);
              ytdStartValueCHF += shares * ytdStartPriceCHF;
            }
          }
          const cashBalance = parseFloat(portfolio.cashBalance || '0');
          portfolioValueCHF += cashBalance;
          
          // Use historical YTD performance if available, otherwise fall back to investmentAmount
          if (hasHistoricalData && ytdStartValueCHF > 0) {
            performancePercent = ((currentValueForPerf - ytdStartValueCHF) / ytdStartValueCHF) * 100;
          } else if (investmentAmount > 0) {
            performancePercent = ((portfolioValueCHF - investmentAmount) / investmentAmount) * 100;
          }
        }

        // Count positions
        let positionCount = 0;
        if (isLive) {
          const transactions = transactionsByPortfolio.get(portfolio.id) || [];
          positionCount = Array.from(buildHoldings(transactions).values()).filter(h => h.shares > 0).length;
        } else {
          try {
            const pd = JSON.parse(portfolio.portfolioData || '{}');
            const stocks = pd.stocks || pd.positions || [];
            positionCount = stocks.length;
          } catch (e) { console.warn('[dashboardRouter] Parsen von portfolioData (Positionszahl) fehlgeschlagen:', e); }
        }

        portfolioMetrics.push({
          id: portfolio.id,
          name: portfolio.name,
          description: portfolio.description,
          isLive,
          value: isFinite(portfolioValueCHF) ? portfolioValueCHF : 0,
          performance: isFinite(performancePercent) ? Number(performancePercent.toFixed(2)) : 0,
          performanceCHF: isFinite(portfolioValueCHF) ? Number((portfolioValueCHF - parseFloat(portfolio.investmentAmount || '0')).toFixed(2)) : 0,
          positionCount,
          strategy: (portfolio as any).strategy || null,
        });
      } catch (error) {
        console.error(`[dashboard.getTopPortfolios] Error for portfolio ${portfolio.id}:`, error);
      }
    }

    portfolioMetrics.sort((a, b) => b.performance - a.performance);
    return portfolioMetrics;
  }),

  // ──────────────────────────────────────────────────────────────────────
  // TTWROR + IRR Performance Metrics (new engine)
  // ──────────────────────────────────────────────────────────────────────
  getPerformanceMetrics: protectedProcedure
    .input(z.object({
      scope: z.union([z.literal("aggregate"), z.number()]).default("aggregate"),
      range: z.enum(["1M", "3M", "YTD", "1J", "3J", "5J", "Max"]).default("YTD"),
    }))
    .query(async ({ ctx, input }) => {
      const { getSavedPortfolios, getPortfolioTransactions, getBenchmarkData } = await import("../db");
      const { batchGetStocks } = await import("../db-optimized");
      const { convertToCHF, convertToCHFSync, getFxRate } = await import("../fxHelper");
      const { getDb } = await import("../db");
      const { historicalPrices } = await import("../../drizzle/schema");
      const { inArray, and, gte, lte } = await import("drizzle-orm");
      const {
        calculateTTWROR,
        calculateIRR,
        buildDailyValuations,
        buildHoldingsTimeline,
        extractPortfolioCashFlows,
      } = await import("../lib/performanceEngine");

      const db = await getDb();
      if (!db) return { ttwror: 0, irr: 0, annualizedTtwror: 0, periodDays: 0, dailySeries: [] };

      const portfolios = await getSavedPortfolios(ctx.user.id);
      let targetPortfolios: any[];
      if (input.scope === "aggregate") {
        targetPortfolios = portfolios.filter(p => p.isLive === 1 && p.liveStartDate);
      } else {
        targetPortfolios = portfolios.filter(p => p.id === input.scope);
      }
      if (targetPortfolios.length === 0) return { ttwror: 0, irr: 0, annualizedTtwror: 0, periodDays: 0, dailySeries: [] };

      // Determine date range
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      let startDate = new Date();
      switch (input.range) {
        case '1M': startDate.setMonth(startDate.getMonth() - 1); break;
        case '3M': startDate.setMonth(startDate.getMonth() - 3); break;
        case 'YTD': startDate = new Date(`${today.getFullYear()}-01-01`); break;
        case '1J': startDate.setFullYear(startDate.getFullYear() - 1); break;
        case '3J': startDate.setFullYear(startDate.getFullYear() - 3); break;
        case '5J': startDate.setFullYear(startDate.getFullYear() - 5); break;
        case 'Max': startDate = new Date('2020-01-01'); break;
      }
      let startDateStr = startDate.toISOString().split('T')[0];

      // Collect all transactions from target portfolios
      const allTransactions: any[] = [];
      const allTickers = new Set<string>();
      let earliestTxDate = todayStr;

      for (const p of targetPortfolios) {
        if (p.isLive === 1 && p.liveStartDate) {
          const txs = await getPortfolioTransactions(p.id);
          allTransactions.push(...txs);
          for (const tx of txs) {
            if (tx.ticker) allTickers.add(tx.ticker);
            if (tx.transactionDate) {
              const txDateStr = new Date(tx.transactionDate).toISOString().split('T')[0];
              if (txDateStr < earliestTxDate) earliestTxDate = txDateStr;
            }
          }
        }
      }

      if (allTickers.size === 0 || allTransactions.length === 0) {
        return { ttwror: 0, irr: 0, annualizedTtwror: 0, periodDays: 0, dailySeries: [] };
      }

      // R-15: Zeilen ohne totalAmountCHF/fxRate mit dem FX-Kurs zum
      // TRANSAKTIONSDATUM auflösen, bevor Cash-Timeline und Flows sie lesen
      // (vorher: Lokalbetrag stillschweigend als CHF gemischt).
      const { withResolvedGrossAmountCHF, getSignedFlowCHF } = await import("../lib/transactionSemantics");
      const { tryGetFxRate } = await import("../fxHelper");
      const resolvedTransactions = await withResolvedGrossAmountCHF(
        allTransactions,
        (currency, date) => tryGetFxRate(date, `${currency}CHF`)
      );

      // Don't go before earliest transaction
      if (startDateStr < earliestTxDate) startDateStr = earliestTxDate;

      // Get stock metadata
      const stocksMap = await batchGetStocks(Array.from(allTickers));

      // Get historical prices
      const pricesResult = await db.select().from(historicalPrices)
        .where(and(
          inArray(historicalPrices.ticker, Array.from(allTickers)),
          gte(historicalPrices.date, startDateStr),
          lte(historicalPrices.date, todayStr)
        ));

      const rawPriceMap = new Map<string, Map<string, number>>();
      for (const p of pricesResult) {
        if (!rawPriceMap.has(p.ticker)) rawPriceMap.set(p.ticker, new Map());
        rawPriceMap.get(p.ticker)!.set(p.date, parseFloat(p.close));
      }

      const allDates = new Set<string>();
      for (const tp of rawPriceMap.values()) {
        for (const d of tp.keys()) allDates.add(d);
      }
      const sortedDates = Array.from(allDates).sort();
      if (sortedDates.length === 0) return { ttwror: 0, irr: 0, annualizedTtwror: 0, periodDays: 0, dailySeries: [] };

      // Convert prices to CHF
      const currencyByTicker = new Map<string, string>();
      for (const [ticker, stock] of stocksMap.entries()) {
        currencyByTicker.set(ticker, (stock as any).currency || 'CHF');
      }

      // Pre-warm FX cache
      const uniqueCurrencies = new Set<string>();
      for (const c of currencyByTicker.values()) if (c !== 'CHF') uniqueCurrencies.add(c);
      await Promise.all(Array.from(uniqueCurrencies).map(c =>
        convertToCHF(1, c, todayStr)
      ));

      const pricesCHF = new Map<string, Map<string, number>>();
      for (const [ticker, datePrices] of rawPriceMap.entries()) {
        const currency = currencyByTicker.get(ticker) || 'CHF';
        const chfPrices = new Map<string, number>();
        if (currency === 'CHF') {
          for (const [date, price] of datePrices.entries()) chfPrices.set(date, price);
        } else {
          const fxRate = await convertToCHF(1, currency, todayStr);
          for (const [date, price] of datePrices.entries()) chfPrices.set(date, price * fxRate);
        }
        pricesCHF.set(ticker, chfPrices);
      }

      // Build holdings timeline
      const holdingsTimeline = buildHoldingsTimeline(allTransactions, sortedDates);

      // Build cash balances
      const cashBalances = new Map<string, number>();
      const sortedTxs = [...resolvedTransactions].sort((a, b) => {
        const da = new Date(a.transactionDate).toISOString();
        const db2 = new Date(b.transactionDate).toISOString();
        return da.localeCompare(db2);
      });
      let runningCash = 0;
      const txDateChanges = new Map<string, number>();
      for (const tx of sortedTxs) {
        const date = new Date(tx.transactionDate).toISOString().split('T')[0];
        const amountCHF = parseFloat(tx.totalAmountCHF || tx.totalAmount || '0');
        const fees = parseFloat(tx.fees || '0');
        let change = 0;
        switch (tx.transactionType) {
          // R-01: getSignedFlowCHF normalisiert beide Speicher-Konventionen
          // (vorher machte `-amountCHF` aus einer negativ gespeicherten
          // Entnahme einen Cash-ZUFLUSS).
          case 'deposit': case 'entry': case 'withdrawal': change = getSignedFlowCHF(tx); break;
          case 'buy': change = -(amountCHF + fees); break;
          case 'sell': change = amountCHF - fees; break;
          case 'dividend': change = amountCHF; break;
        }
        txDateChanges.set(date, (txDateChanges.get(date) || 0) + change);
      }
      for (const date of sortedDates) {
        const change = txDateChanges.get(date);
        if (change !== undefined) runningCash += change;
        cashBalances.set(date, Math.max(0, runningCash));
      }

      // Build daily valuations
      const valuations = buildDailyValuations(holdingsTimeline, pricesCHF, cashBalances, sortedDates);

      // Extract external cash flows
      const cashFlows = extractPortfolioCashFlows(resolvedTransactions);

      // Calculate TTWROR
      const ttwrorResult = calculateTTWROR(valuations, cashFlows);

      // Calculate IRR
      const mvb = valuations.length > 0 ? valuations[0].marketValue : 0;
      const mve = valuations.length > 0 ? valuations[valuations.length - 1].marketValue : 0;
      const irrCashFlows = cashFlows.map(cf => ({
        ...cf,
        amount: cf.type === 'withdrawal' ? -Math.abs(cf.amount) : Math.abs(cf.amount),
      }));
      // R-17: IRR-Periode an die tatsächlich BEWERTETEN Stichtage koppeln —
      // vorher lief die Periode bis «heute» (new Date()), obwohl MVE am
      // letzten Preisdatum steht.
      const irrStartStr = valuations.length > 0 ? valuations[0].date : startDateStr;
      const irrEndStr = valuations.length > 0 ? valuations[valuations.length - 1].date : todayStr;
      const irrResult = calculateIRR(mvb, mve, irrCashFlows, irrStartStr, irrEndStr);

      // Downsample daily series to max 60 points for chart
      const step = Math.max(1, Math.floor(ttwrorResult.dailySeries.length / 60));
      const sampledSeries = ttwrorResult.dailySeries.filter((_, i) =>
        i % step === 0 || i === ttwrorResult.dailySeries.length - 1
      );

      return {
        ttwror: Number((ttwrorResult.totalReturn * 100).toFixed(2)), // as percentage
        annualizedTtwror: Number((ttwrorResult.annualizedReturn * 100).toFixed(2)),
        irr: Number((irrResult.annualizedIRR * 100).toFixed(2)),
        periodDays: ttwrorResult.periodDays,
        converged: irrResult.converged,
        dailySeries: sampledSeries.map(p => ({
          date: p.date,
          value: Number((p.cumulativeReturn * 100).toFixed(2)),
        })),
      };
    }),

  // ──────────────────────────────────────────────────────────────────────
  // Performance time series — portfolio vs SMI vs MSCI World
  // ──────────────────────────────────────────────────────────────────────
  getPerformanceTimeseries: protectedProcedure
    .input(z.object({
      scope: z.union([z.literal("aggregate"), z.number()]).default("aggregate"),
      range: z.enum(["1T", "1M", "YTD", "1J", "3J", "5J", "Max"]).default("YTD"),
    }))
    .query(async ({ ctx, input }) => {
      const { getSavedPortfolios, getPortfolioTransactions, getBenchmarkData } = await import("../db");
      const { batchGetStocks } = await import("../db-optimized");
      const { convertToCHF, convertToCHFSync, getFxRate } = await import("../fxHelper");
      const { getDb } = await import("../db");
      const { historicalPrices } = await import("../../drizzle/schema");
      const { inArray, and, gte, lte } = await import("drizzle-orm");

      const db = await getDb();
      if (!db) return { range: input.range, scope: input.scope, points: [] };

      const portfolios = await getSavedPortfolios(ctx.user.id);
      // Support both live and demo portfolios
      let targetPortfolios: any[];
      if (input.scope === "aggregate") {
        // Aggregate: only live portfolios (with transactions)
        targetPortfolios = portfolios.filter(p => p.isLive === 1 && p.liveStartDate);
      } else {
        // Specific portfolio: find by ID regardless of isLive status
        targetPortfolios = portfolios.filter(p => p.id === input.scope);
      }
      if (targetPortfolios.length === 0) return { range: input.range, scope: input.scope, points: [] };

      // Determine date range
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      let startDate = new Date();
      switch (input.range) {
        case '1T': startDate.setDate(startDate.getDate() - 1); break;
        case '1M': startDate.setMonth(startDate.getMonth() - 1); break;
        case 'YTD': startDate = new Date(`${today.getFullYear()}-01-01`); break;
        case '1J': startDate.setFullYear(startDate.getFullYear() - 1); break;
        case '3J': startDate.setFullYear(startDate.getFullYear() - 3); break;
        case '5J': startDate.setFullYear(startDate.getFullYear() - 5); break;
        case 'Max': startDate.setFullYear(startDate.getFullYear() - 3); break; // 3 years max for performance
      }
      let startDateStr = startDate.toISOString().split('T')[0];

      // Get all tickers from target portfolios (live: from transactions, demo: from portfolioData)
      const allTickers = new Set<string>();
      const txByPortfolio = new Map<number, any[]>();
      const demoHoldingsByPortfolio = new Map<number, Array<{ticker: string; shares: number}>>();

      let earliestTransactionDate = todayStr;
      let latestLiveStartDate = '2000-01-01'; // Track the LATEST start date among live portfolios for comparability
      for (const p of targetPortfolios) {
        if (p.isLive === 1 && p.liveStartDate) {
          const txs = await getPortfolioTransactions(p.id);
          txByPortfolio.set(p.id, txs);
          const liveStartStr = new Date(p.liveStartDate).toISOString().split('T')[0];
          if (liveStartStr > latestLiveStartDate) latestLiveStartDate = liveStartStr;
          txs.forEach((tx: any) => {
            if (tx.ticker) allTickers.add(tx.ticker);
            if (tx.transactionDate && tx.transactionType === 'buy') {
              const txDateStr = new Date(tx.transactionDate).toISOString().split('T')[0];
              if (txDateStr < earliestTransactionDate) earliestTransactionDate = txDateStr;
            }
          });
        } else {
          // Demo portfolio: extract tickers from portfolioData
          try {
            const pd = JSON.parse(p.portfolioData || '{}');
            const stocks = pd.stocks || pd.positions || [];
            const investmentAmount = parseFloat(p.investmentAmount || '0');
            const demoHoldings: Array<{ticker: string; shares: number}> = [];
            for (const stock of stocks) {
              if (stock.ticker) {
                allTickers.add(stock.ticker);
                const weight = parseFloat(stock.weight || '0') / 100;
                let shares = parseFloat(stock.shares || '0');
                // Estimate shares if not stored
                if (shares === 0 && investmentAmount > 0 && weight > 0) {
                  shares = -1; // placeholder, will calculate with price later
                }
                demoHoldings.push({ ticker: stock.ticker, shares });
              }
            }
            demoHoldingsByPortfolio.set(p.id, demoHoldings);
            // For demo portfolios: do NOT limit by createdAt for Max range
            // They represent hypothetical allocations that can be backtested further back
            if (p.createdAt && input.range !== 'Max') {
              const createdStr = new Date(p.createdAt).toISOString().split('T')[0];
              if (createdStr < earliestTransactionDate) earliestTransactionDate = createdStr;
            }
            // For Max range on demo portfolios, allow going back to the full available history
          } catch (e) { console.warn('[dashboardRouter] Parsen von portfolioData (frühestes Datum) fehlgeschlagen:', e); }
        }
      }
      if (allTickers.size === 0) return { range: input.range, scope: input.scope, points: [] };

      // Determine the effective start date based on portfolio type and range
      const hasLivePortfolios = targetPortfolios.some(p => p.isLive === 1);
      const hasDemoPortfolios = targetPortfolios.some(p => p.isLive !== 1);

      if (input.scope === 'aggregate' && hasLivePortfolios && input.range === 'Max') {
        // Aggregated Max with live portfolios: use the LATEST start date for comparability
        if (latestLiveStartDate > '2000-01-01' && startDateStr < latestLiveStartDate) {
          startDateStr = latestLiveStartDate;
        }
      } else if (hasLivePortfolios && !hasDemoPortfolios) {
        // Pure live portfolio(s): ensure startDate is not before the first transaction
        if (startDateStr < earliestTransactionDate) {
          startDateStr = earliestTransactionDate;
        }
      } else if (hasDemoPortfolios && !hasLivePortfolios) {
        // Pure demo portfolio(s): for Max, use the full available history (startDate from switch)
        // For other ranges, limit to createdAt (already handled above via earliestTransactionDate)
        if (input.range !== 'Max' && startDateStr < earliestTransactionDate) {
          startDateStr = earliestTransactionDate;
        }
        // For Max range: keep startDateStr as 2020-01-01 (from switch statement)
      } else {
        // Mixed: fallback to earliest transaction date
        if (startDateStr < earliestTransactionDate) {
          startDateStr = earliestTransactionDate;
        }
      }

      console.log(`[getPerformanceTimeseries] scope=${input.scope} range=${input.range} startDateStr=${startDateStr} hasLive=${hasLivePortfolios} hasDemo=${hasDemoPortfolios} earliestTx=${earliestTransactionDate} tickers=${Array.from(allTickers).join(',')}`);

      const stocksMap = await batchGetStocks(Array.from(allTickers));

      // Get historical prices
      const pricesResult = await db.select().from(historicalPrices)
        .where(and(
          inArray(historicalPrices.ticker, Array.from(allTickers)),
          gte(historicalPrices.date, startDateStr),
          lte(historicalPrices.date, todayStr)
        ));

      const priceMap = new Map<string, Map<string, number>>();
      for (const p of pricesResult) {
        if (!priceMap.has(p.ticker)) priceMap.set(p.ticker, new Map());
        priceMap.get(p.ticker)!.set(p.date, parseFloat(p.close));
      }

      const allDates = new Set<string>();
      for (const tp of Array.from(priceMap.values())) {
        for (const d of Array.from(tp.keys())) allDates.add(d);
      }
      const sortedDates = Array.from(allDates).sort();
      console.log(`[getPerformanceTimeseries] pricesResult=${pricesResult.length} sortedDates=${sortedDates.length} firstDate=${sortedDates[0]} lastDate=${sortedDates[sortedDates.length-1]}`);
      if (sortedDates.length === 0) {
        // Kein einziger Titel hat historische Kurse → Backfill für ALLE Titel anstoßen, damit der
        // nächste Aufruf die Linie zeichnen kann (der frühe Return würde die Selbstheilung sonst überspringen).
        import("../autoBackfill")
          .then(({ autoBackfillNewSymbols }) => autoBackfillNewSymbols(Array.from(allTickers)))
          .catch(err => console.warn(`[getPerformanceTimeseries] Auto-Backfill (leer) fehlgeschlagen: ${err?.message}`));
        return { range: input.range, scope: input.scope, points: [], portfolioIncomplete: true };
      }

      // Get benchmark data (SMI + MSCI World)
      const smiData = await getBenchmarkData("SMI", startDateStr, todayStr);
      const msciData = await getBenchmarkData("MSCI_WORLD", startDateStr, todayStr);
      const smiMap = new Map(smiData.map(d => [d.date, parseFloat(d.close)]));
      const msciMap = new Map(msciData.map(d => [d.date, parseFloat(d.close)]));

      // Pre-warm FX cache: trigger one async call per currency to bulk-load all historical rates
      const uniqueCurrencies = new Set<string>();
      for (const s of Array.from(stocksMap.values())) { if ((s as any).currency) uniqueCurrencies.add((s as any).currency); }
      await Promise.all(Array.from(uniqueCurrencies).filter(c => c !== 'CHF').map(c =>
        getFxRate(todayStr, `${c}CHF`)
      ));

      // Pre-compute sorted date arrays per ticker (avoid repeated sort inside the hot loop)
      const sortedTickerDates = new Map<string, string[]>();
      for (const [ticker, tp] of Array.from(priceMap.entries())) {
        sortedTickerDates.set(ticker, Array.from(tp.keys()).sort());
      }

      // Helper: binary-search for the nearest price on or before a given date
      const getNearestPrice = (ticker: string, date: string): number | undefined => {
        const tp = priceMap.get(ticker);
        if (!tp) return undefined;
        const exact = tp.get(date);
        if (exact !== undefined) return exact;
        const dates = sortedTickerDates.get(ticker)!;
        // Binary search for last date <= target
        let lo = 0, hi = dates.length - 1, best = -1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (dates[mid] <= date) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
        }
        if (best >= 0) return tp.get(dates[best]);
        // Fallback: look forward up to 5 trading days (handles holidays like Jan 1)
        const forward = dates.find(d => d > date);
        return forward !== undefined ? tp.get(forward) : undefined;
      };

      // Pre-compute shares for demo portfolios (avoid repeated JSON.parse + sort inside the hot loop)
      const demoSharesCache = new Map<string, Map<string, number>>(); // portfolioId -> ticker -> shares
      for (const portfolio of targetPortfolios) {
        if (portfolio.isLive === 1 && portfolio.liveStartDate) continue;
        const demoHoldings = demoHoldingsByPortfolio.get(portfolio.id) || [];
        const investmentAmount = parseFloat(portfolio.investmentAmount || '0');
        const sharesMap = new Map<string, number>();
        const pd = JSON.parse(portfolio.portfolioData || '{}');
        const stockDefs = pd.stocks || pd.positions || [];
        for (const dh of demoHoldings) {
          let shares = dh.shares;
          if (shares <= 0 && investmentAmount > 0) {
            const stockDef = stockDefs.find((s: any) => s.ticker === dh.ticker);
            const weight = stockDef ? parseFloat(stockDef.weight || '0') / 100 : 0;
            const allocationCHF = investmentAmount * weight;
            const stock = stocksMap.get(dh.ticker) as any;
            const currency = stock?.currency || 'CHF';
            const startPrice = getNearestPrice(dh.ticker, startDateStr);
            if (startPrice && startPrice > 0) {
              const startPriceCHF = convertToCHFSync(startPrice, currency, startDateStr);
              shares = startPriceCHF > 0 ? allocationCHF / startPriceCHF : 0;
            }
          }
          if (shares > 0) sharesMap.set(dh.ticker, shares);
        }
        demoSharesCache.set(String(portfolio.id), sharesMap);
      }

      // Downsample to max 60 points
      const step = Math.max(1, Math.floor(sortedDates.length / 60));
      const sampledDates = sortedDates.filter((_, i) => i % step === 0 || i === sortedDates.length - 1);
      console.log(`[getPerformanceTimeseries] sampledDates=${sampledDates.length} step=${step} demoSharesCache sizes=${JSON.stringify(Array.from(demoSharesCache.entries()).map(([k,v]) => ({id:k, shares:v.size})))}`);

      // Calculate portfolio value for sampled dates
      const t0 = Date.now();
      let startingValue = 0;

      // Helper: find nearest value from a map for a given date (look back up to 5 days)
      const getNearestValue = (map: Map<string, number>, targetDate: string): number | null => {
        if (map.has(targetDate)) return map.get(targetDate)!;
        const d = new Date(targetDate);
        for (let i = 1; i <= 5; i++) {
          d.setDate(d.getDate() - 1);
          const key = d.toISOString().split('T')[0];
          if (map.has(key)) return map.get(key)!;
        }
        // Also look forward
        const d2 = new Date(targetDate);
        for (let i = 1; i <= 5; i++) {
          d2.setDate(d2.getDate() + 1);
          const key = d2.toISOString().split('T')[0];
          if (map.has(key)) return map.get(key)!;
        }
        return null;
      };

      const smiStart = getNearestValue(smiMap, sampledDates[0]) || 0;
      const msciStart = getNearestValue(msciMap, sampledDates[0]) || 0;

      const points: Array<{ label: string; portfolio: number | null; smi: number; msci: number }> = [];

      for (let i = 0; i < sampledDates.length; i++) {
        const date = sampledDates[i];
        let totalValueCHF = 0;

        for (const portfolio of targetPortfolios) {
          if (portfolio.isLive === 1 && portfolio.liveStartDate) {
            // Live portfolio: calculate from transactions
            const liveStart = new Date(portfolio.liveStartDate).toISOString().split('T')[0];
            if (date < liveStart) continue;
            const transactions = txByPortfolio.get(portfolio.id) || [];
            const holdingsMap = buildHoldings(transactions, date);
            for (const [ticker, { shares }] of Array.from(holdingsMap.entries())) {
              if (shares <= 0) continue;
              const stock = stocksMap.get(ticker) as any;
              if (!stock) continue;
              const currency = stock.currency || 'CHF';
              const price = getNearestPrice(ticker, date);
              if (!price) continue;
              totalValueCHF += shares * convertToCHFSync(price, currency, date);
            }
            totalValueCHF += parseFloat(portfolio.cashBalance || '0');
          } else {
            // Demo portfolio: use pre-computed shares from demoSharesCache
            const sharesMap = demoSharesCache.get(String(portfolio.id));
            if (!sharesMap || sharesMap.size === 0) continue;
            let hasAnyDemoValue = false;
            for (const [ticker, shares] of Array.from(sharesMap.entries())) {
              const stock = stocksMap.get(ticker) as any;
              const currency = stock?.currency || 'CHF';
              const price = getNearestPrice(ticker, date);
              if (!price) continue;
              totalValueCHF += shares * convertToCHFSync(price, currency, date);
              hasAnyDemoValue = true;
            }
            if (hasAnyDemoValue) totalValueCHF += parseFloat(portfolio.cashBalance || '0');
          }
        }

        // Use first point with meaningful value as baseline
        if (startingValue === 0 && totalValueCHF > 0) startingValue = totalValueCHF;
        const portfolioPerf = startingValue > 0 ? ((totalValueCHF - startingValue) / startingValue) * 100 : 0;

        // Benchmark performance (use nearest date matching)
        let smiPerf = 0;
        let msciPerf = 0;
        const smiVal = getNearestValue(smiMap, date);
        const msciVal = getNearestValue(msciMap, date);
        if (smiVal && smiStart > 0) smiPerf = ((smiVal - smiStart) / smiStart) * 100;
        if (msciVal && msciStart > 0) msciPerf = ((msciVal - msciStart) / msciStart) * 100;

        const d = new Date(date);
        const label = d.toLocaleDateString('de-CH', { day: '2-digit', month: 'short' });
        points.push({ label, portfolio: Number(portfolioPerf.toFixed(2)), smi: Number(smiPerf.toFixed(2)), msci: Number(msciPerf.toFixed(2)) });
      }

      console.log(`[getPerformanceTimeseries] calculation loop took ${Date.now()-t0}ms for ${sampledDates.length} dates`);

      // Filter out leading zero points (where no portfolio data exists yet)
      const firstNonZeroIdx = points.findIndex(p => p.portfolio !== 0 || p.smi !== 0 || p.msci !== 0);
      const filteredPoints = firstNonZeroIdx > 0 ? points.slice(firstNonZeroIdx) : points;

      // Selbstheilung: einen Backfill anstoßen für Titel, die am/vor dem Startdatum KEINEN Kurs
      // haben — also gar keine Historie ODER nur Teil-Historie ab einem späteren Datum (z. B. neu
      // hinzugefügte Titel mit Kursen erst ab Juni, während YTD am 1.1. beginnt). Genau das lässt
      // die Portfolio-Linie fehlen. `getNearestPrice(t, startDateStr) === undefined` erfasst beide
      // Fälle (vorher wurde nur auf „gar keine Kurse" geprüft → Teil-Historie fiel durch).
      // autoBackfillNewSymbols prüft den Status (< 100 Punkte ⇒ Backfill über 15 Jahre) und
      // überspringt vorhandene/laufende Symbole. Fire-and-forget; der nächste Aufruf zeichnet die Linie.
      const tickersNeedingHistory = Array.from(allTickers).filter(
        t => getNearestPrice(t, startDateStr) === undefined
      );
      if (tickersNeedingHistory.length > 0) {
        console.log(`[getPerformanceTimeseries] Auto-Backfill angestoßen für ${tickersNeedingHistory.length} Titel ohne Historie am ${startDateStr}: ${tickersNeedingHistory.join(',')}`);
        import("../autoBackfill")
          .then(({ autoBackfillNewSymbols }) => autoBackfillNewSymbols(tickersNeedingHistory))
          .catch(err => console.warn(`[getPerformanceTimeseries] Auto-Backfill fehlgeschlagen: ${err?.message}`));
      }

      // Ehrlichkeit statt Fake-Linie: Konnte für die Titel kein Portfoliowert aus historischen
      // Kursen gebildet werden (startingValue nie > 0, z. B. fehlende historicalPrices für
      // Demo-Titel), zeichnen wir KEINE flache 0 %-Portfolio-Linie. Die Kennzahl-Kachel (YTD)
      // fällt in diesem Fall auf investmentAmount zurück — der Chart kann das nicht und meldet
      // die Lücke offen (portfolioIncomplete), statt +0 % vorzutäuschen. Nach dem Backfill (oben)
      // schließt sich die Lücke beim nächsten Laden.
      const portfolioHasData = startingValue > 0;
      const cleanedPoints = portfolioHasData
        ? filteredPoints
        : filteredPoints.map(p => ({ ...p, portfolio: null }));

      return {
        range: input.range,
        scope: input.scope,
        points: cleanedPoints,
        portfolioIncomplete: !portfolioHasData,
      };
    }),

  // ──────────────────────────────────────────────────────────────────────
  // Aggregated holdings across all live portfolios
  // ──────────────────────────────────────────────────────────────────────
  getAggregatedHoldings: protectedProcedure
    .input(z.object({ scope: z.union([z.literal("aggregate"), z.number()]).default("aggregate") }))
    .query(async ({ ctx, input }) => {
      const { getSavedPortfolios, getPortfolioTransactions } = await import("../db");
      const { batchGetStocks, batchGetHistoricalPrices } = await import("../db-optimized");
      const { convertToCHF } = await import("../fxHelper");

      const portfolios = await getSavedPortfolios(ctx.user.id);
      // Support both live and demo portfolios
      let targetPortfolios: any[];
      if (input.scope === "aggregate") {
        targetPortfolios = portfolios.filter(p => p.isLive === 1 && p.liveStartDate);
      } else {
        targetPortfolios = portfolios.filter(p => p.id === input.scope);
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const ytdStartDate = getYTDStartDate();

      // Aggregate holdings across portfolios
      const holdingsAgg = new Map<string, number>(); // ticker -> total shares
      let totalCash = 0;

      for (const portfolio of targetPortfolios) {
        if (portfolio.isLive === 1 && portfolio.liveStartDate) {
          // Live portfolio: from transactions
          const transactions = await getPortfolioTransactions(portfolio.id);
          for (const [ticker, pos] of Array.from(buildHoldings(transactions).entries())) {
            holdingsAgg.set(ticker, (holdingsAgg.get(ticker) || 0) + pos.shares);
          }
        } else {
          // Demo portfolio: from portfolioData
          try {
            const pd = JSON.parse(portfolio.portfolioData || '{}');
            const stocks = pd.stocks || pd.positions || [];
            const investmentAmount = parseFloat(portfolio.investmentAmount || '0');
            for (const stock of stocks) {
              if (!stock.ticker) continue;
              const weight = parseFloat(stock.weight || '0') / 100;
              let shares = parseFloat(stock.shares || '0');
              if (shares === 0 && investmentAmount > 0 && weight > 0) {
                // Estimate shares from weight and current price (will be recalculated below with actual prices)
                shares = -1; // placeholder
              }
              if (shares > 0) {
                holdingsAgg.set(stock.ticker, (holdingsAgg.get(stock.ticker) || 0) + shares);
              } else {
                // Mark for later calculation
                holdingsAgg.set(stock.ticker, holdingsAgg.get(stock.ticker) || -1);
              }
            }
          } catch (e) { console.warn('[dashboardRouter] Holdings-Aggregation aus portfolioData fehlgeschlagen:', e); }
        }
        totalCash += parseFloat(portfolio.cashBalance || '0');
      }

      // Remove zero holdings (but keep -1 placeholders for demo portfolios)
      for (const [t, s] of Array.from(holdingsAgg.entries())) {
        if (s === 0) holdingsAgg.delete(t);
      }

      const allTickers = Array.from(holdingsAgg.keys());
      if (allTickers.length === 0 && totalCash === 0) return [];

      const stocksMap = allTickers.length > 0 ? await batchGetStocks(allTickers) : new Map();
      const ytdPricesMap = allTickers.length > 0 ? await batchGetHistoricalPrices(allTickers, ytdStartDate) : new Map();

      // Pre-warm FX
      const uniqueCurrencies = new Set<string>();
      for (const s of Array.from(stocksMap.values())) { if ((s as any).currency) uniqueCurrencies.add((s as any).currency); }
      await Promise.all(Array.from(uniqueCurrencies).filter(c => c !== 'CHF').map(c =>
        convertToCHF(1, c, todayStr)
      ));

      // For demo portfolios with -1 placeholder shares, calculate actual shares from weight
      for (const portfolio of targetPortfolios) {
        if (portfolio.isLive === 1 && portfolio.liveStartDate) continue;
        try {
          const pd = JSON.parse(portfolio.portfolioData || '{}');
          const stocks = pd.stocks || pd.positions || [];
          const investmentAmount = parseFloat(portfolio.investmentAmount || '0');
          for (const stockDef of stocks) {
            if (!stockDef.ticker) continue;
            const currentShares = holdingsAgg.get(stockDef.ticker);
            if (currentShares !== undefined && currentShares < 0) {
              const stock = stocksMap.get(stockDef.ticker) as any;
              if (!stock) continue;
              const currentPrice = safeParseFloat(stock.currentPrice);
              const currency = stock.currency || 'CHF';
              const weight = parseFloat(stockDef.weight || '0') / 100;
              const allocationCHF = investmentAmount * weight;
              const priceCHF = await convertToCHF(currentPrice, currency, todayStr);
              const calculatedShares = priceCHF > 0 ? allocationCHF / priceCHF : 0;
              holdingsAgg.set(stockDef.ticker, calculatedShares);
            }
          }
        } catch (e) { console.warn('[dashboardRouter] Demo-Stückzahl-Berechnung aus Gewichten fehlgeschlagen:', e); }
      }

      // Now remove any remaining zero/negative
      for (const [t, s] of Array.from(holdingsAgg.entries())) {
        if (s <= 0) holdingsAgg.delete(t);
      }

      // Calculate values
      let totalValue = 0;
      const holdings: Array<{
        ticker: string; name: string; sector: string; region: string;
        weight: number; value: number; shares: number; currentPrice: number;
        currency: string; change1d: number; ytd: number; dividendYield?: number; color?: string;
      }> = [];

      for (const [ticker, shares] of Array.from(holdingsAgg.entries())) {
        const stock = stocksMap.get(ticker) as any;
        if (!stock) continue;
        const currentPrice = safeParseFloat(stock.currentPrice);
        const currency = stock.currency || 'CHF';
        const priceCHF = await convertToCHF(currentPrice, currency, todayStr);
        const value = shares * priceCHF;
        totalValue += value;

        // Determine region from ticker suffix
        let region = 'Other';
        if (ticker.endsWith('.SW') || ticker.endsWith('.ZU')) region = 'CH';
        else if (ticker.endsWith('.AS') || ticker.endsWith('.DE') || ticker.endsWith('.PA') || ticker.endsWith('.MI') || ticker.endsWith('.L')) region = 'EU';
        else if (!ticker.includes('.') || ticker.endsWith('.US')) region = 'US';

        // YTD performance
        const ytdStartPrice = ytdPricesMap.get(ticker) as number | undefined;
        const ytd = ytdStartPrice && ytdStartPrice > 0 ? ((currentPrice - ytdStartPrice) / ytdStartPrice) * 100 : 0;

        // 1d change: real value comes from the EODHD real-time fetch below;
        // until then stay neutral (0).
        // vorher (R-29): Fake-Proxy ytdPerformance / geschätzte Handelstage —
        // erfand eine "Tagesveränderung" aus der YTD-Zahl; entfernt. Der
        // Client (PositionsView) rendert 0 als neutrales ±0.00 %.
        const change1d = 0;

        holdings.push({
          ticker,
          name: stock.companyName || ticker,
          sector: stock.sector || 'Other',
          region,
          weight: 0, // calculated after totalValue is known
          value,
          shares,
          currentPrice,
          currency,
          change1d: Number(change1d.toFixed(2)),
          ytd: Number(ytd.toFixed(1)),
          dividendYield: stock.dividendYield ? parseFloat(stock.dividendYield) : undefined,
        });
      }

      // Add cash
      totalValue += totalCash;
      if (totalCash > 0) {
        holdings.push({
          ticker: 'CASH', name: 'Liquidität', sector: 'Cash', region: 'CH',
          weight: 0, value: totalCash, shares: 0, currentPrice: 1, currency: 'CHF',
          change1d: 0, ytd: 0,
        });
      }

      // Fetch real-time 1d change from EODHD for top holdings (limit to avoid rate limits)
      try {
        const { fetchEODHDRealTime } = await import("../_core/eodhdApi");
        const tickersToFetch = holdings.filter(h => h.ticker !== 'CASH').slice(0, 20);
        const realTimeResults = await Promise.allSettled(
          tickersToFetch.map(h => fetchEODHDRealTime(h.ticker))
        );
        for (let i = 0; i < tickersToFetch.length; i++) {
          const result = realTimeResults[i];
          if (result.status === 'fulfilled' && result.value.changePercent !== null) {
            tickersToFetch[i].change1d = Number(result.value.changePercent.toFixed(2));
          }
        }
      } catch (e) {
        // Silently fall back to approximation
      }

      // Calculate weights
      for (const h of holdings) {
        h.weight = totalValue > 0 ? Number(((h.value / totalValue) * 100).toFixed(1)) : 0;
      }

      // Sort by weight descending
      holdings.sort((a, b) => b.weight - a.weight);
      return holdings;
    }),

  // ──────────────────────────────────────────────────────────────────────
  // Sector allocation
  // ──────────────────────────────────────────────────────────────────────
  getSectorAllocation: protectedProcedure
    .input(z.object({ scope: z.union([z.literal("aggregate"), z.number()]).default("aggregate") }))
    .query(async ({ ctx, input }) => {
      const { getSavedPortfolios, getPortfolioTransactions } = await import("../db");
      const { batchGetStocks, batchGetHistoricalPrices } = await import("../db-optimized");
      const { convertToCHF } = await import("../fxHelper");

      const SECTOR_COLORS: Record<string, string> = {
        "Healthcare": "#3B82F6", "Tech": "#22D3EE", "Technology": "#22D3EE",
        "Financials": "#A78BFA", "Consumer Staples": "#7BA66C", "Consumer Cyclical": "#F472B6",
        "Industrials": "#F59E0B", "Materials": "#F472B6", "Energy": "#FB923C",
        "Utilities": "#94A3B8", "Real Estate": "#FCD34D", "Communication": "#C084FC",
        "Cash": "#475569",
      };

      const portfolios = await getSavedPortfolios(ctx.user.id);
      // Support both live and demo portfolios
      let targetPortfolios: any[];
      if (input.scope === "aggregate") {
        targetPortfolios = portfolios.filter(p => p.isLive === 1 && p.liveStartDate);
      } else {
        targetPortfolios = portfolios.filter(p => p.id === input.scope);
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const ytdStartDate = getYTDStartDate();

      const holdingsAgg = new Map<string, number>();
      let totalCash = 0;

      for (const portfolio of targetPortfolios) {
        if (portfolio.isLive === 1 && portfolio.liveStartDate) {
          const transactions = await getPortfolioTransactions(portfolio.id);
          for (const [ticker, pos] of Array.from(buildHoldings(transactions).entries())) {
            holdingsAgg.set(ticker, (holdingsAgg.get(ticker) || 0) + pos.shares);
          }
        } else {
          try {
            const pd = JSON.parse(portfolio.portfolioData || '{}');
            const stocks = pd.stocks || pd.positions || [];
            const investmentAmount = parseFloat(portfolio.investmentAmount || '0');
            for (const stock of stocks) {
              if (!stock.ticker) continue;
              let shares = parseFloat(stock.shares || '0');
              if (shares === 0 && investmentAmount > 0) {
                holdingsAgg.set(stock.ticker, holdingsAgg.get(stock.ticker) || -1);
              } else if (shares > 0) {
                holdingsAgg.set(stock.ticker, (holdingsAgg.get(stock.ticker) || 0) + shares);
              }
            }
          } catch (e) { console.warn('[dashboardRouter] Holdings-Aggregation aus portfolioData fehlgeschlagen:', e); }
        }
        totalCash += parseFloat(portfolio.cashBalance || '0');
      }

      // Remove zero entries
      for (const [t, s] of Array.from(holdingsAgg.entries())) {
        if (s === 0) holdingsAgg.delete(t);
      }

      const allTickers = Array.from(holdingsAgg.keys());
      const stocksMap = allTickers.length > 0 ? await batchGetStocks(allTickers) : new Map();
      const ytdPricesMap = allTickers.length > 0 ? await batchGetHistoricalPrices(allTickers, ytdStartDate) : new Map();

      // Pre-warm FX
      const uniqueCurrencies = new Set<string>();
      for (const s of Array.from(stocksMap.values())) { if ((s as any).currency) uniqueCurrencies.add((s as any).currency); }
      await Promise.all(Array.from(uniqueCurrencies).filter(c => c !== 'CHF').map(c =>
        convertToCHF(1, c, todayStr)
      ));

      // Calculate shares for demo portfolios with placeholder -1
      for (const portfolio of targetPortfolios) {
        if (portfolio.isLive === 1 && portfolio.liveStartDate) continue;
        try {
          const pd = JSON.parse(portfolio.portfolioData || '{}');
          const stocks = pd.stocks || pd.positions || [];
          const investmentAmount = parseFloat(portfolio.investmentAmount || '0');
          for (const stockDef of stocks) {
            if (!stockDef.ticker) continue;
            const currentShares = holdingsAgg.get(stockDef.ticker);
            if (currentShares !== undefined && currentShares < 0) {
              const stock = stocksMap.get(stockDef.ticker) as any;
              if (!stock) continue;
              const currentPrice = safeParseFloat(stock.currentPrice);
              const currency = stock.currency || 'CHF';
              const weight = parseFloat(stockDef.weight || '0') / 100;
              const allocationCHF = investmentAmount * weight;
              const priceCHF = await convertToCHF(currentPrice, currency, todayStr);
              const calculatedShares = priceCHF > 0 ? allocationCHF / priceCHF : 0;
              holdingsAgg.set(stockDef.ticker, calculatedShares);
            }
          }
        } catch (e) { console.warn('[dashboardRouter] Demo-Stückzahl-Berechnung aus Gewichten fehlgeschlagen:', e); }
      }

      for (const [t, s] of Array.from(holdingsAgg.entries())) {
        if (s <= 0) holdingsAgg.delete(t);
      }

      // Group by sector
      const sectorData = new Map<string, { value: number; ytdWeighted: number }>();
      let totalValue = 0;

      for (const [ticker, shares] of Array.from(holdingsAgg.entries())) {
        const stock = stocksMap.get(ticker) as any;
        if (!stock) continue;
        const currentPrice = safeParseFloat(stock.currentPrice);
        const currency = stock.currency || 'CHF';
        const priceCHF = await convertToCHF(currentPrice, currency, todayStr);
        const value = shares * priceCHF;
        totalValue += value;

        const sector = stock.sector || 'Other';
        const ytdStartPrice = ytdPricesMap.get(ticker) as number | undefined;
        const ytd = ytdStartPrice && ytdStartPrice > 0 ? ((currentPrice - ytdStartPrice) / ytdStartPrice) * 100 : 0;

        const existing = sectorData.get(sector) || { value: 0, ytdWeighted: 0 };
        existing.value += value;
        existing.ytdWeighted += ytd * value;
        sectorData.set(sector, existing);
      }

      totalValue += totalCash;
      if (totalCash > 0) {
        sectorData.set('Cash', { value: totalCash, ytdWeighted: 0 });
      }

      const sectors = Array.from(sectorData.entries()).map(([name, data]) => ({
        name,
        weight: totalValue > 0 ? Number(((data.value / totalValue) * 100).toFixed(1)) : 0,
        ytd: data.value > 0 ? Number((data.ytdWeighted / data.value).toFixed(1)) : 0,
        color: SECTOR_COLORS[name] || '#94A3B8',
      })).sort((a, b) => b.weight - a.weight);

      return sectors;
    }),

  // ──────────────────────────────────────────────────────────────────────
  // Region allocation
  // ──────────────────────────────────────────────────────────────────────
  getRegionAllocation: protectedProcedure
    .input(z.object({ scope: z.union([z.literal("aggregate"), z.number()]).default("aggregate") }))
    .query(async ({ ctx, input }) => {
      const { getSavedPortfolios, getPortfolioTransactions } = await import("../db");
      const { batchGetStocks } = await import("../db-optimized");
      const { convertToCHF } = await import("../fxHelper");

      const REGION_COLORS: Record<string, string> = {
        "Schweiz": "#00CFC1", "USA": "#A78BFA", "Europa": "#F59E0B", "Cash": "#475569", "Andere": "#94A3B8",
      };

      const portfolios = await getSavedPortfolios(ctx.user.id);
      // Support both live and demo portfolios
      let targetPortfolios: any[];
      if (input.scope === "aggregate") {
        targetPortfolios = portfolios.filter(p => p.isLive === 1 && p.liveStartDate);
      } else {
        targetPortfolios = portfolios.filter(p => p.id === input.scope);
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const holdingsAgg = new Map<string, number>();
      let totalCash = 0;

      for (const portfolio of targetPortfolios) {
        if (portfolio.isLive === 1 && portfolio.liveStartDate) {
          const transactions = await getPortfolioTransactions(portfolio.id);
          for (const [ticker, pos] of Array.from(buildHoldings(transactions).entries())) {
            holdingsAgg.set(ticker, (holdingsAgg.get(ticker) || 0) + pos.shares);
          }
        } else {
          try {
            const pd = JSON.parse(portfolio.portfolioData || '{}');
            const stocks = pd.stocks || pd.positions || [];
            const investmentAmount = parseFloat(portfolio.investmentAmount || '0');
            for (const stock of stocks) {
              if (!stock.ticker) continue;
              let shares = parseFloat(stock.shares || '0');
              if (shares === 0 && investmentAmount > 0) {
                holdingsAgg.set(stock.ticker, holdingsAgg.get(stock.ticker) || -1);
              } else if (shares > 0) {
                holdingsAgg.set(stock.ticker, (holdingsAgg.get(stock.ticker) || 0) + shares);
              }
            }
          } catch (e) { console.warn('[dashboardRouter] Holdings-Aggregation aus portfolioData fehlgeschlagen:', e); }
        }
        totalCash += parseFloat(portfolio.cashBalance || '0');
      }

      for (const [t, s] of Array.from(holdingsAgg.entries())) {
        if (s === 0) holdingsAgg.delete(t);
      }

      const allTickers = Array.from(holdingsAgg.keys());
      const stocksMap = allTickers.length > 0 ? await batchGetStocks(allTickers) : new Map();

      // Pre-warm FX
      const uniqueCurrencies = new Set<string>();
      for (const s of Array.from(stocksMap.values())) { if ((s as any).currency) uniqueCurrencies.add((s as any).currency); }
      await Promise.all(Array.from(uniqueCurrencies).filter(c => c !== 'CHF').map(c =>
        convertToCHF(1, c, todayStr)
      ));

      // Calculate shares for demo portfolios with placeholder -1
      for (const portfolio of targetPortfolios) {
        if (portfolio.isLive === 1 && portfolio.liveStartDate) continue;
        try {
          const pd = JSON.parse(portfolio.portfolioData || '{}');
          const stocks = pd.stocks || pd.positions || [];
          const investmentAmount = parseFloat(portfolio.investmentAmount || '0');
          for (const stockDef of stocks) {
            if (!stockDef.ticker) continue;
            const currentShares = holdingsAgg.get(stockDef.ticker);
            if (currentShares !== undefined && currentShares < 0) {
              const stock = stocksMap.get(stockDef.ticker) as any;
              if (!stock) continue;
              const currentPrice = safeParseFloat(stock.currentPrice);
              const currency = stock.currency || 'CHF';
              const weight = parseFloat(stockDef.weight || '0') / 100;
              const allocationCHF = investmentAmount * weight;
              const priceCHF = await convertToCHF(currentPrice, currency, todayStr);
              const calculatedShares = priceCHF > 0 ? allocationCHF / priceCHF : 0;
              holdingsAgg.set(stockDef.ticker, calculatedShares);
            }
          }
        } catch (e) { console.warn('[dashboardRouter] Demo-Stückzahl-Berechnung aus Gewichten fehlgeschlagen:', e); }
      }

      for (const [t, s] of Array.from(holdingsAgg.entries())) {
        if (s <= 0) holdingsAgg.delete(t);
      }

      const regionData = new Map<string, number>();
      let totalValue = 0;

      for (const [ticker, shares] of Array.from(holdingsAgg.entries())) {
        const stock = stocksMap.get(ticker) as any;
        if (!stock) continue;
        const currentPrice = safeParseFloat(stock.currentPrice);
        const currency = stock.currency || 'CHF';
        const priceCHF = await convertToCHF(currentPrice, currency, todayStr);
        const value = shares * priceCHF;
        totalValue += value;

        let region = 'Andere';
        if (ticker.endsWith('.SW') || ticker.endsWith('.ZU')) region = 'Schweiz';
        else if (ticker.endsWith('.AS') || ticker.endsWith('.DE') || ticker.endsWith('.PA') || ticker.endsWith('.MI') || ticker.endsWith('.L')) region = 'Europa';
        else if (!ticker.includes('.') || ticker.endsWith('.US')) region = 'USA';

        regionData.set(region, (regionData.get(region) || 0) + value);
      }

      totalValue += totalCash;
      if (totalCash > 0) regionData.set('Cash', totalCash);

      const regions = Array.from(regionData.entries()).map(([name, value]) => ({
        name,
        weight: totalValue > 0 ? Number(((value / totalValue) * 100).toFixed(1)) : 0,
        color: REGION_COLORS[name] || '#94A3B8',
      })).sort((a, b) => b.weight - a.weight);

      return regions;
    }),

  // ──────────────────────────────────────────────────────────────────────
  // Risk metrics — volatility, drawdown, VaR, Sharpe, Beta, Concentration
  // ──────────────────────────────────────────────────────────────────────
  getRiskMetrics: protectedProcedure
    .input(z.object({ scope: z.union([z.literal("aggregate"), z.number()]).default("aggregate") }))
    .query(async ({ ctx, input }) => {
      const { getSavedPortfolios, getPortfolioTransactions, getBenchmarkData } = await import("../db");
      const { batchGetStocks } = await import("../db-optimized");
      const { convertToCHF, convertToCHFSync, getFxRate } = await import("../fxHelper");
      const { getDb } = await import("../db");
      const { historicalPrices } = await import("../../drizzle/schema");
      const { inArray, and, gte, lte } = await import("drizzle-orm");

      const db = await getDb();
      if (!db) return { dataAvailable: false, volatility: 0, volBenchmark: 0, maxDrawdown: 0, drawdownBenchmark: 0, var95: 0, concentrationTop3: 0, sharpeRatio: 0, sharpeBenchmark: 0, beta: 0 };

      const portfolios = await getSavedPortfolios(ctx.user.id);
      // Support both live and demo portfolios
      let targetPortfolios: any[];
      if (input.scope === "aggregate") {
        targetPortfolios = portfolios.filter(p => p.isLive === 1 && p.liveStartDate);
      } else {
        targetPortfolios = portfolios.filter(p => p.id === input.scope);
      }
      if (targetPortfolios.length === 0) return { dataAvailable: false, volatility: 0, volBenchmark: 0, maxDrawdown: 0, drawdownBenchmark: 0, var95: 0, concentrationTop3: 0, sharpeRatio: 0, sharpeBenchmark: 0, beta: 0 };

      // Get 1 year of data for risk calculation
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const startDateStr = oneYearAgo.toISOString().split('T')[0];

      // Get all tickers (live: from transactions, demo: from portfolioData)
      const allTickers = new Set<string>();
      const txByPortfolio = new Map<number, any[]>();
      const demoHoldingsByPortfolio = new Map<number, Array<{ticker: string; shares: number}>>();

      for (const p of targetPortfolios) {
        if (p.isLive === 1 && p.liveStartDate) {
          const txs = await getPortfolioTransactions(p.id);
          txByPortfolio.set(p.id, txs);
          txs.forEach((tx: any) => { if (tx.ticker) allTickers.add(tx.ticker); });
        } else {
          try {
            const pd = JSON.parse(p.portfolioData || '{}');
            const stocks = pd.stocks || pd.positions || [];
            const demoHoldings: Array<{ticker: string; shares: number}> = [];
            for (const stock of stocks) {
              if (stock.ticker) {
                allTickers.add(stock.ticker);
                demoHoldings.push({ ticker: stock.ticker, shares: parseFloat(stock.shares || '0') });
              }
            }
            demoHoldingsByPortfolio.set(p.id, demoHoldings);
          } catch (e) { console.warn('[dashboardRouter] Parsen der Demo-Portfolio-Holdings fehlgeschlagen:', e); }
        }
      }

      if (allTickers.size === 0) return { dataAvailable: false, volatility: 0, volBenchmark: 0, maxDrawdown: 0, drawdownBenchmark: 0, var95: 0, concentrationTop3: 0, sharpeRatio: 0, sharpeBenchmark: 0, beta: 0 };

      const stocksMap = await batchGetStocks(Array.from(allTickers));

      // Get historical prices for 1 year
      const pricesResult = await db.select().from(historicalPrices)
        .where(and(
          inArray(historicalPrices.ticker, Array.from(allTickers)),
          gte(historicalPrices.date, startDateStr),
          lte(historicalPrices.date, todayStr)
        ));

      const priceMap = new Map<string, Map<string, number>>();
      for (const p of pricesResult) {
        if (!priceMap.has(p.ticker)) priceMap.set(p.ticker, new Map());
        priceMap.get(p.ticker)!.set(p.date, parseFloat(p.close));
      }

      // Get all unique dates
      const allDates = new Set<string>();
      for (const tp of Array.from(priceMap.values())) {
        for (const d of Array.from(tp.keys())) allDates.add(d);
      }
      const sortedDates = Array.from(allDates).sort();

      // Pre-warm FX
      const uniqueCurrencies = new Set<string>();
      for (const s of Array.from(stocksMap.values())) { if ((s as any).currency) uniqueCurrencies.add((s as any).currency); }
      await Promise.all(Array.from(uniqueCurrencies).filter(c => c !== 'CHF').map(c =>
        convertToCHF(1, c, todayStr)
      ));

      // Pre-calculate demo portfolio shares (using first available price)
      const demoSharesCalc = new Map<number, Map<string, number>>(); // portfolioId -> ticker -> shares
      for (const portfolio of targetPortfolios) {
        if (portfolio.isLive === 1 && portfolio.liveStartDate) continue;
        const demoHoldings = demoHoldingsByPortfolio.get(portfolio.id) || [];
        const investmentAmount = parseFloat(portfolio.investmentAmount || '0');
        const sharesMap = new Map<string, number>();
        for (const dh of demoHoldings) {
          let shares = dh.shares;
          if (shares <= 0 && investmentAmount > 0) {
            const stock = stocksMap.get(dh.ticker) as any;
            if (!stock) continue;
            const pd = JSON.parse(portfolio.portfolioData || '{}');
            const stocks = pd.stocks || pd.positions || [];
            const stockDef = stocks.find((s: any) => s.ticker === dh.ticker);
            const weight = stockDef ? parseFloat(stockDef.weight || '0') / 100 : 0;
            const allocationCHF = investmentAmount * weight;
            const currentPrice = safeParseFloat(stock.currentPrice);
            const currency = stock.currency || 'CHF';
            const priceCHF = await convertToCHF(currentPrice, currency, todayStr);
            shares = priceCHF > 0 ? allocationCHF / priceCHF : 0;
          }
          if (shares > 0) sharesMap.set(dh.ticker, shares);
        }
        demoSharesCalc.set(portfolio.id, sharesMap);
      }

      // Calculate daily portfolio values
      const dailyValues: number[] = [];
      for (const date of sortedDates) {
        let totalValueCHF = 0;
        for (const portfolio of targetPortfolios) {
          if (portfolio.isLive === 1 && portfolio.liveStartDate) {
            const transactions = txByPortfolio.get(portfolio.id) || [];
            const holdingsMap = buildHoldings(transactions, date);
            for (const [ticker, { shares }] of Array.from(holdingsMap.entries())) {
              if (shares <= 0) continue;
              const tickerPrices = priceMap.get(ticker);
              if (!tickerPrices) continue;
              let price = tickerPrices.get(date);
              if (!price) {
                const avail = Array.from(tickerPrices.keys()).sort();
                for (let j = avail.length - 1; j >= 0; j--) {
                  if (avail[j] <= date) { price = tickerPrices.get(avail[j]); break; }
                }
              }
              if (!price) continue;
              const stock = stocksMap.get(ticker) as any;
              const currency = stock?.currency || 'CHF';
              const priceCHF = await convertToCHF(price, currency, date);
              totalValueCHF += shares * priceCHF;
            }
          } else {
            // Demo portfolio: use pre-calculated shares
            const sharesMap = demoSharesCalc.get(portfolio.id) || new Map();
            for (const [ticker, shares] of Array.from(sharesMap.entries())) {
              const tickerPrices = priceMap.get(ticker);
              if (!tickerPrices) continue;
              let price = tickerPrices.get(date);
              if (!price) {
                const avail = Array.from(tickerPrices.keys()).sort();
                for (let j = avail.length - 1; j >= 0; j--) {
                  if (avail[j] <= date) { price = tickerPrices.get(avail[j]); break; }
                }
              }
              if (!price) continue;
              const stock = stocksMap.get(ticker) as any;
              const currency = stock?.currency || 'CHF';
              const priceCHF = await convertToCHF(price, currency, date);
              totalValueCHF += shares * priceCHF;
            }
          }
        }
        dailyValues.push(totalValueCHF);
      }

      // Calculate daily returns
      const dailyReturns: number[] = [];
      for (let i = 1; i < dailyValues.length; i++) {
        if (dailyValues[i - 1] > 0) {
          dailyReturns.push((dailyValues[i] - dailyValues[i - 1]) / dailyValues[i - 1]);
        }
      }

      if (dailyReturns.length < 10) return { dataAvailable: false, volatility: 0, volBenchmark: 0, maxDrawdown: 0, drawdownBenchmark: 0, var95: 0, concentrationTop3: 0, sharpeRatio: 0, sharpeBenchmark: 0, beta: 0 };

      // Volatility (annualized)
      const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
      const variance = dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (dailyReturns.length - 1);
      const volatility = Math.sqrt(variance) * Math.sqrt(252) * 100;

      // Max Drawdown
      let maxDrawdown = 0;
      let peak = dailyValues[0];
      for (const val of dailyValues) {
        if (val > peak) peak = val;
        const dd = (val - peak) / peak;
        if (dd < maxDrawdown) maxDrawdown = dd;
      }

      // VaR 95%
      const sortedReturns = [...dailyReturns].sort((a, b) => a - b);
      const var95Index = Math.floor(dailyReturns.length * 0.05);
      const var95 = sortedReturns[var95Index] * 100;

      // Sharpe Ratio (rf = 1.5% annual = 0.006 daily)
      const rf = 0.015 / 252;
      const excessMean = mean - rf;
      const sharpeRatio = variance > 0 ? (excessMean / Math.sqrt(variance)) * Math.sqrt(252) : 0;

      // Benchmark metrics (SMI)
      const smiData = await getBenchmarkData("SMI", startDateStr, todayStr);
      let volBenchmark = 0;
      let drawdownBenchmark = 0;
      let beta = 0;
      let sharpeBenchmark = 0;

      if (smiData.length > 10) {
        const smiPrices = smiData.map(d => parseFloat(d.close));
        const smiReturns: number[] = [];
        for (let i = 1; i < smiPrices.length; i++) {
          if (smiPrices[i - 1] > 0) smiReturns.push((smiPrices[i] - smiPrices[i - 1]) / smiPrices[i - 1]);
        }

        const smiMean = smiReturns.reduce((s, r) => s + r, 0) / smiReturns.length;
        const smiVariance = smiReturns.reduce((s, r) => s + (r - smiMean) ** 2, 0) / (smiReturns.length - 1);
        volBenchmark = Math.sqrt(smiVariance) * Math.sqrt(252) * 100;
        // Benchmark Sharpe (same rf and annualization as the portfolio Sharpe above)
        sharpeBenchmark = smiVariance > 0 ? ((smiMean - rf) / Math.sqrt(smiVariance)) * Math.sqrt(252) : 0;

        let smiPeak = smiPrices[0];
        for (const val of smiPrices) {
          if (val > smiPeak) smiPeak = val;
          const dd = (val - smiPeak) / smiPeak;
          if (dd < drawdownBenchmark) drawdownBenchmark = dd;
        }

        // Beta = cov(portfolio, benchmark) / var(benchmark)
        const minLen = Math.min(dailyReturns.length, smiReturns.length);
        if (minLen > 10 && smiVariance > 0) {
          let cov = 0;
          for (let i = 0; i < minLen; i++) {
            cov += (dailyReturns[i] - mean) * (smiReturns[i] - smiMean);
          }
          cov /= (minLen - 1);
          beta = cov / smiVariance;
        }
      }

      // Concentration top 3 — use current holdings
      const holdingsAgg = new Map<string, number>();
      for (const portfolio of targetPortfolios) {
        const transactions = txByPortfolio.get(portfolio.id) || [];
        for (const [ticker, pos] of Array.from(buildHoldings(transactions).entries())) {
          holdingsAgg.set(ticker, (holdingsAgg.get(ticker) || 0) + pos.shares);
        }
      }
      const holdingValues: number[] = [];
      let totalVal = 0;
      for (const [ticker, shares] of Array.from(holdingsAgg.entries())) {
        if (shares <= 0) continue;
        const stock = stocksMap.get(ticker) as any;
        if (!stock) continue;
        const price = safeParseFloat(stock.currentPrice);
        const currency = stock.currency || 'CHF';
        const priceCHF = await convertToCHF(price, currency, todayStr);
        const val = shares * priceCHF;
        holdingValues.push(val);
        totalVal += val;
      }
      holdingValues.sort((a, b) => b - a);
      const concentrationTop3 = totalVal > 0 ? (holdingValues.slice(0, 3).reduce((s, v) => s + v, 0) / totalVal) * 100 : 0;

      return {
        dataAvailable: true,
        volatility: Number(volatility.toFixed(1)),
        volBenchmark: Number(volBenchmark.toFixed(1)),
        maxDrawdown: Number((maxDrawdown * 100).toFixed(1)),
        drawdownBenchmark: Number((drawdownBenchmark * 100).toFixed(1)),
        var95: Number(var95.toFixed(1)),
        concentrationTop3: Number(concentrationTop3.toFixed(1)),
        sharpeRatio: Number(sharpeRatio.toFixed(2)),
        sharpeBenchmark: Number(sharpeBenchmark.toFixed(2)),
        beta: Number(beta.toFixed(2)),
      };
    }),

  // ──────────────────────────────────────────────────────────────────────
  // LPPL Bubble indicator
  // ──────────────────────────────────────────────────────────────────────
    getBubbleIndicator: protectedProcedure
    .input(z.object({ scope: z.union([z.literal("aggregate"), z.number()]).default("aggregate") }))
    .query(async ({ ctx }) => {
      // ── Primary: Sornette Finance API (FCO/ETH Zurich LPPLS data) ──────────
      try {
        const { getMarketBubbleScore, formatBubbleIndicatorResponse } = await import("../analytics/sornetteApi");
        const sornetteScore = await getMarketBubbleScore();
        if (sornetteScore) {
          const formatted = formatBubbleIndicatorResponse(sornetteScore);
          // History best-effort from the same source as the DB fallback
          // (lpplResults, own LPPL engine). If unavailable, [] — the client
          // hides the sparkline for an empty history.
          let sornetteHistory: number[] = [];
          try {
            const { getDb } = await import("../db");
            const { lpplResults } = await import("../../drizzle/schema");
            const { desc, eq } = await import("drizzle-orm");
            const db = await getDb();
            if (db) {
              const rows = await db.select().from(lpplResults)
                .where(eq(lpplResults.indexSymbol, '^GSPC'))
                .orderBy(desc(lpplResults.checkedAt))
                .limit(8);
              sornetteHistory = rows.reverse().map(r => r.bubbleConfidence);
            }
          } catch (histErr) {
            console.warn('[getBubbleIndicator] History-Fallback aus lpplResults fehlgeschlagen:', histErr);
          }
          return {
            score: formatted.score,
            label: formatted.label,
            history: sornetteHistory,
            interpretation: formatted.interpretation,
            source: 'sornette_api' as const,
            dataDate: formatted.dataDate,
            longTermBubble: formatted.longTermBubble,
            bestPositiveT1_2_6y: formatted.bestPositiveT1_2_6y,
            positiveByScale: formatted.positiveByScale,
            negativeByScale: formatted.negativeByScale,
          };
        }
      } catch (err) {
        console.warn('[getBubbleIndicator] Sornette API failed, falling back to DB:', err);
      }
      // ── Fallback: local DB (lpplResults from own LPPL engine) ─────────────
      const { getDb } = await import("../db");
      const { lpplResults } = await import("../../drizzle/schema");
      const { desc, eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return { score: 50, label: "Mittel" as const, history: [] as number[], interpretation: "Keine Daten verfügbar.", source: 'fallback' as const };
      const latest = await db.select().from(lpplResults)
        .where(eq(lpplResults.indexSymbol, '^GSPC'))
        .orderBy(desc(lpplResults.checkedAt))
        .limit(1);
      const history = await db.select().from(lpplResults)
        .where(eq(lpplResults.indexSymbol, '^GSPC'))
        .orderBy(desc(lpplResults.checkedAt))
        .limit(8);
      if (latest.length === 0) {
        return { score: 50, label: "Mittel" as const, history: [] as number[], interpretation: "Keine Sornette API-Verbindung. Kein lokaler LPPL-Check verfügbar.", source: 'fallback' as const };
      }
      const score = latest[0].bubbleConfidence;
      const label = score < 33 ? "Niedrig" : score < 66 ? "Mittel" : "Hoch";
      const historyScores = history.reverse().map(r => r.bubbleConfidence);
      let interpretation = "";
      if (score < 33) interpretation = "Markt zeigt keine Überhitzung. Strategie kann beibehalten werden.";
      else if (score < 66) interpretation = "Moderate Überhitzungssignale. Risikomanagement überprüfen.";
      else interpretation = "Starke Bubble-Signale erkannt. Defensive Positionierung empfohlen.";
      return { score, label: label as "Niedrig" | "Mittel" | "Hoch", history: historyScores, interpretation, source: 'local_db' as const };
    }),

  // ──────────────────────────────────────────────────────────────────────
  // Copilot insights — top 3-5 actionable items
  // ──────────────────────────────────────────────────────────────────────
  getCopilotInsights: protectedProcedure
    .input(z.object({ scope: z.union([z.literal("aggregate"), z.number()]).default("aggregate") }))
    .query(async ({ ctx, input }) => {
      const { getSavedPortfolios, getPortfolioTransactions } = await import("../db");
      const { batchGetStocks, batchGetHistoricalPrices } = await import("../db-optimized");
      const { convertToCHF } = await import("../fxHelper");

      const portfolios = await getSavedPortfolios(ctx.user.id);
      // Support both live and demo portfolios
      let targetPortfolios: any[];
      if (input.scope === "aggregate") {
        targetPortfolios = portfolios; // Include all portfolios for copilot analysis
      } else {
        targetPortfolios = portfolios.filter(p => p.id === input.scope);
      }

      const insights: Array<{ id: string; severity: "positive" | "watch" | "info"; title: string; body: string; action: string; actionHref?: string }> = [];

      if (targetPortfolios.length === 0) {
        insights.push({ id: 'no-live', severity: 'info', title: 'Kein Live-Portfolio', body: 'Aktiviere ein Portfolio um personalisierte Insights zu erhalten.', action: 'Portfolio aktivieren', actionHref: '/portfolios' });
        return insights;
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const ytdStartDate = getYTDStartDate();

      // Get holdings for analysis
      const holdingsAgg = new Map<string, number>();
      let totalCash = 0;

      for (const portfolio of targetPortfolios) {
        if (portfolio.isLive === 1 && portfolio.liveStartDate) {
          const transactions = await getPortfolioTransactions(portfolio.id);
          for (const [ticker, pos] of Array.from(buildHoldings(transactions).entries())) {
            holdingsAgg.set(ticker, (holdingsAgg.get(ticker) || 0) + pos.shares);
          }
        } else {
          try {
            const pd = JSON.parse(portfolio.portfolioData || '{}');
            const stocks = pd.stocks || pd.positions || [];
            const investmentAmount = parseFloat(portfolio.investmentAmount || '0');
            for (const stock of stocks) {
              if (!stock.ticker) continue;
              let shares = parseFloat(stock.shares || '0');
              if (shares === 0 && investmentAmount > 0) {
                holdingsAgg.set(stock.ticker, holdingsAgg.get(stock.ticker) || -1);
              } else if (shares > 0) {
                holdingsAgg.set(stock.ticker, (holdingsAgg.get(stock.ticker) || 0) + shares);
              }
            }
          } catch (e) { console.warn('[dashboardRouter] Holdings-Aggregation aus portfolioData fehlgeschlagen:', e); }
        }
        totalCash += parseFloat(portfolio.cashBalance || '0');
      }

      for (const [t, s] of Array.from(holdingsAgg.entries())) {
        if (s === 0) holdingsAgg.delete(t);
      }

      const allTickers = Array.from(holdingsAgg.keys());
      const stocksMap = allTickers.length > 0 ? await batchGetStocks(allTickers) : new Map();

      // Pre-warm FX
      const uniqueCurrencies = new Set<string>();
      for (const s of Array.from(stocksMap.values())) { if ((s as any).currency) uniqueCurrencies.add((s as any).currency); }
      await Promise.all(Array.from(uniqueCurrencies).filter(c => c !== 'CHF').map(c =>
        convertToCHF(1, c, todayStr)
      ));

      // Calculate shares for demo portfolios with placeholder -1
      for (const portfolio of targetPortfolios) {
        if (portfolio.isLive === 1 && portfolio.liveStartDate) continue;
        try {
          const pd = JSON.parse(portfolio.portfolioData || '{}');
          const stocks = pd.stocks || pd.positions || [];
          const investmentAmount = parseFloat(portfolio.investmentAmount || '0');
          for (const stockDef of stocks) {
            if (!stockDef.ticker) continue;
            const currentShares = holdingsAgg.get(stockDef.ticker);
            if (currentShares !== undefined && currentShares < 0) {
              const stock = stocksMap.get(stockDef.ticker) as any;
              if (!stock) continue;
              const currentPrice = safeParseFloat(stock.currentPrice);
              const currency = stock.currency || 'CHF';
              const weight = parseFloat(stockDef.weight || '0') / 100;
              const allocationCHF = investmentAmount * weight;
              const priceCHF = await convertToCHF(currentPrice, currency, todayStr);
              const calculatedShares = priceCHF > 0 ? allocationCHF / priceCHF : 0;
              holdingsAgg.set(stockDef.ticker, calculatedShares);
            }
          }
        } catch (e) { console.warn('[dashboardRouter] Demo-Stückzahl-Berechnung aus Gewichten fehlgeschlagen:', e); }
      }
      for (const [t, s] of Array.from(holdingsAgg.entries())) {
        if (s <= 0) holdingsAgg.delete(t);
      }

      // Calculate values and weights
      const holdingData: Array<{ ticker: string; sector: string; value: number; weight: number }> = [];
      let totalValue = 0;

      for (const [ticker, shares] of Array.from(holdingsAgg.entries())) {
        const stock = stocksMap.get(ticker) as any;
        if (!stock) continue;
        const currentPrice = safeParseFloat(stock.currentPrice);
        const currency = stock.currency || 'CHF';
        const priceCHF = await convertToCHF(currentPrice, currency, todayStr);
        const value = shares * priceCHF;
        totalValue += value;
        holdingData.push({ ticker, sector: stock.sector || 'Other', value, weight: 0 });
      }
      totalValue += totalCash;
      for (const h of holdingData) {
        h.weight = totalValue > 0 ? (h.value / totalValue) * 100 : 0;
      }
      holdingData.sort((a, b) => b.weight - a.weight);

      // Generate insights using LLM for personalized recommendations
      const { invokeLLM } = await import("../_core/llm");

      // Prepare portfolio context for LLM
      const cashWeight = totalValue > 0 ? (totalCash / totalValue) * 100 : 0;
      const sectorWeights = new Map<string, number>();
      for (const h of holdingData) {
        sectorWeights.set(h.sector, (sectorWeights.get(h.sector) || 0) + h.weight);
      }
      const top5Holdings = holdingData.slice(0, 5).map(h => `${h.ticker} (${h.weight.toFixed(1)}%, ${h.sector})`);
      const sectorSummary = Array.from(sectorWeights.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([s, w]) => `${s}: ${w.toFixed(1)}%`);

      const portfolioContext = [
        `Gesamtwert: CHF ${totalValue.toFixed(0)}`,
        `Cash-Quote: ${cashWeight.toFixed(1)}%`,
        `Anzahl Positionen: ${holdingData.length}`,
        `Top 5: ${top5Holdings.join(', ')}`,
        `Sektoren: ${sectorSummary.join(', ')}`,
        `Portfolios: ${targetPortfolios.length} (${targetPortfolios.map(p => p.name).join(', ')})`,
      ].join('\n');

      try {
        const llmResponse = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: `Du bist ein Schweizer Finanzberater-Copilot. Analysiere das Portfolio und gib 3-4 konkrete, actionable Empfehlungen auf Deutsch. Jede Empfehlung hat:
- severity: "positive" (Stärke), "watch" (Risiko/Warnung), oder "info" (neutral/Tipp)
- title: Kurzer Titel (max 30 Zeichen)
- body: 1-2 Sätze Erklärung (max 120 Zeichen)
- action: Button-Text (max 25 Zeichen)

Fokussiere auf:
1. Diversifikation (Sektor, Region, Einzeltitel-Konzentration)
2. Cash-Management (zu viel/wenig Liquidität)
3. Markt-Timing (aktuelle Marktlage berücksichtigen)
4. Spezifische Handlungsempfehlungen

Antworte NUR mit validem JSON-Array. Keine Erklärungen ausserhalb des JSON.`
            },
            {
              role: 'user',
              content: `Analysiere dieses Portfolio (Stand ${todayStr}):\n${portfolioContext}`
            }
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'copilot_insights',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  insights: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        severity: { type: 'string', enum: ['positive', 'watch', 'info'] },
                        title: { type: 'string' },
                        body: { type: 'string' },
                        action: { type: 'string' }
                      },
                      required: ['severity', 'title', 'body', 'action'],
                      additionalProperties: false
                    }
                  }
                },
                required: ['insights'],
                additionalProperties: false
              }
            }
          }
        });

        const content = llmResponse.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(typeof content === 'string' ? content : '');
          if (parsed.insights && Array.isArray(parsed.insights)) {
            for (const insight of parsed.insights.slice(0, 4)) {
              // Derive actionHref from the insight content/action text
              const actionText = (insight.action || '').toLowerCase();
              const titleText = (insight.title || '').toLowerCase();
              const bodyText = (insight.body || '').toLowerCase();
              let actionHref = '/portfolios'; // default fallback
              if (actionText.includes('diversif') || titleText.includes('sektor') || titleText.includes('konzentration') || bodyText.includes('sektor')) {
                actionHref = '/portfolios';
              } else if (actionText.includes('position') || titleText.includes('klumpen') || titleText.includes('einzeltitel')) {
                actionHref = '/portfolios';
              } else if (actionText.includes('cash') || titleText.includes('liquidit') || titleText.includes('cash')) {
                actionHref = '/portfolios';
              } else if (actionText.includes('markt') || actionText.includes('global') || titleText.includes('region')) {
                actionHref = '/markt';
              } else if (actionText.includes('optim') || actionText.includes('anpass')) {
                actionHref = '/portfolios';
              }
              insights.push({
                id: `llm-${insights.length}`,
                severity: insight.severity || 'info',
                title: insight.title || 'Empfehlung',
                body: insight.body || '',
                action: insight.action || 'Details',
                actionHref,
              });
            }
          }
        }
      } catch (llmError) {
        console.error('[getCopilotInsights] LLM error, falling back to rules:', llmError);
        // Fallback to rule-based insights
        const top3Weight = holdingData.slice(0, 3).reduce((s, h) => s + h.weight, 0);
        if (top3Weight > 40) {
          insights.push({
            id: 'high-concentration',
            severity: 'watch',
            title: 'Hohe Konzentration',
            body: `Top 3 Positionen machen ${top3Weight.toFixed(0)}% aus. Diversifikation prüfen.`,
            action: 'Im Optimizer prüfen',
            actionHref: '/portfolio-optimizer',
          });
        }
        if (cashWeight > 15) {
          insights.push({
            id: 'high-cash',
            severity: 'info',
            title: `Cash-Quote ${cashWeight.toFixed(0)}%`,
            body: 'Hohe Liquidität — Staffel-Einstieg in defensive Werte möglich.',
            action: 'Vorschläge anzeigen',
            actionHref: '/invest',
          });
        }
        for (const [sector, weight] of Array.from(sectorWeights.entries())) {
          if (weight > 30 && sector !== 'Cash') {
            insights.push({
              id: `sector-${sector.toLowerCase()}`,
              severity: 'watch',
              title: `${sector}-Übergewicht`,
              body: `${sector} macht ${weight.toFixed(0)}% aus. Sektor-Risiko beachten.`,
              action: 'Allokation anpassen',
              actionHref: '/portfolio-optimizer',
            });
            break;
          }
        }
      }

      // Always add a positive insight if we have multiple portfolios
      if (targetPortfolios.length >= 2 && !insights.some(i => i.severity === 'positive')) {
        insights.push({
          id: 'multi-portfolio',
          severity: 'positive',
          title: `${targetPortfolios.length} aktive Portfolios`,
          body: 'Gute Diversifikation über mehrere Strategien.',
          action: 'Detail-Report',
          actionHref: '/analysis',
        });
      }

      return insights.slice(0, 5);
    }),

  /** Scoring Watchlist: batch-score all portfolio tickers with Momentum+Quality+LPPL */
  getScoringWatchlist: protectedProcedure.query(async ({ ctx }) => {
    const { getSavedPortfolios, getPortfolioTransactions } = await import('../db');
    const portfolios = await getSavedPortfolios(ctx.user.id);
    if (portfolios.length === 0) return [];
    const allTickers = new Set<string>();
    for (const portfolio of portfolios) {
      if (portfolio.isLive && portfolio.liveStartDate) {
        const txs = await getPortfolioTransactions(portfolio.id);
        txs.forEach((tx: any) => { if (tx.ticker) allTickers.add(tx.ticker); });
      } else {
        try {
          const pd = JSON.parse(portfolio.portfolioData || '{}');
          const stocks = pd.stocks || pd.positions || [];
          stocks.forEach((s: any) => { if (s.ticker) allTickers.add(s.ticker); });
        } catch (e) { console.warn('[dashboardRouter] Parsen von portfolioData (Ticker-Sammlung) fehlgeschlagen:', e); }
      }
    }
    const symbols = Array.from(allTickers).slice(0, 15);
    if (symbols.length === 0) return [];
    const YahooFinanceClass = (await import('yahoo-finance2')).default;
    const yahooFinance = new (YahooFinanceClass as any)();
    const { calculateQualityScore, calculateMomentumScore, extractQualityFromYahoo } = await import('../analytics/qualityMomentumEngine');
    const { detectBubble } = await import('../analytics/lpplsEngine');
    const results: any[] = [];
    for (const rawSymbol of symbols) {
      const ticker = rawSymbol.toUpperCase();
      try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        const chartResult: any = await yahooFinance.chart(ticker, {
          period1: startDate.toISOString().split('T')[0],
          period2: endDate.toISOString().split('T')[0],
          interval: '1d',
        });
        const quotes = (chartResult?.quotes ?? []).filter((q: any) => q.close != null);
        const prices: number[] = quotes.map((q: any) => q.close as number);
        let qualityMetrics: any = {};
        try {
          const summary: any = await yahooFinance.quoteSummary(ticker, { modules: ['financialData', 'defaultKeyStatistics', 'summaryDetail'] });
          qualityMetrics = extractQualityFromYahoo(summary);
        } catch (e) { console.warn('[dashboardRouter] Yahoo quoteSummary (Quality-Metriken) fehlgeschlagen:', e); }
        let momentumResult: any = { score: 0, grade: 'C', trend: 'neutral' };
        if (prices.length >= 60) { try { momentumResult = calculateMomentumScore({ prices }); } catch (e) { console.warn('[dashboardRouter] calculateMomentumScore fehlgeschlagen:', e); } }
        let qualityResult: any = { score: 0, grade: 'C' };
        try { qualityResult = calculateQualityScore(qualityMetrics); } catch (e) { console.warn('[dashboardRouter] calculateQualityScore fehlgeschlagen:', e); }
        let bubbleScore = 0, bubbleRegime = 'normal';
        if (prices.length >= 60) { try { const b = detectBubble({ prices }); bubbleScore = b.bubbleScore ?? 0; bubbleRegime = b.regime ?? 'normal'; } catch (e) { console.warn('[dashboardRouter] detectBubble fehlgeschlagen:', e); } }
        const mNorm = (momentumResult.score + 1) / 2;
        const qNorm = (qualityResult.score + 1) / 2;
        const lpplPenalty = bubbleRegime === 'bubble' ? bubbleScore * 0.5 : 0;
        const combined = Math.max(0, Math.min(1, 0.4 * mNorm + 0.4 * qNorm - lpplPenalty));
        results.push({
          ticker,
          combinedScore: parseFloat((combined * 100).toFixed(1)),
          overallGrade: combined >= 0.75 ? 'A' : combined >= 0.60 ? 'B' : combined >= 0.45 ? 'C' : combined >= 0.30 ? 'D' : 'F',
          signal: combined >= 0.70 ? 'STRONG BUY' : combined >= 0.55 ? 'BUY' : combined >= 0.45 ? 'HOLD' : combined >= 0.30 ? 'SELL' : 'STRONG SELL',
          momentum: { grade: momentumResult.grade, trend: momentumResult.trend },
          quality: { grade: qualityResult.grade },
          lppl: { regime: bubbleRegime },
          error: null,
        });
      } catch (err: any) {
        results.push({ ticker, combinedScore: 0, overallGrade: 'F', signal: 'ERROR', error: (err as Error).message });
      }
    }
        return results.sort((a, b) => b.combinedScore - a.combinedScore);
  }),

  // ============================================================
  // HEUTE DASHBOARD — neue Prozeduren
  // ============================================================

  /** Markt-Snapshot: Indizes + Sektor-Heatmap + Top-Movers */
  getMarketSnapshot: protectedProcedure.query(async ({ ctx }) => {
    const { fetchEODHDRealTime } = await import('../_core/eodhdApi');

    // Indizes via EODHD
    const indexDefs = [
      { key: 'smi',    label: 'SPI',     ticker: 'SSMI.INDX',  currency: 'CHF' },
      { key: 'sp500',  label: 'S&P 500', ticker: 'GSPC.INDX',  currency: 'USD' },
      { key: 'nasdaq', label: 'Nasdaq',  ticker: 'IXIC.INDX',  currency: 'USD' },
      { key: 'dax',    label: 'DAX',     ticker: 'GDAXI.INDX', currency: 'EUR' },
      { key: 'gold',   label: 'Gold',    ticker: 'GLD.US',     currency: 'USD' },
    ];
    const indexResults = await Promise.allSettled(
      indexDefs.map(async (def) => {
        const rt = await fetchEODHDRealTime(def.ticker);
        return { key: def.key, label: def.label, currency: def.currency, price: rt.close, change: rt.changePercent };
      })
    );
    const indices = indexResults.map((r, i) =>
      r.status === 'fulfilled' ? r.value : { ...indexDefs[i], price: null, change: null }
    );

    // Sektor-ETF Heatmap (11 GICS Sektoren)
    const sectorDefs = [
      { key: 'XLK',  label: 'Technologie' },
      { key: 'XLF',  label: 'Finanzen' },
      { key: 'XLV',  label: 'Gesundheit' },
      { key: 'XLE',  label: 'Energie' },
      { key: 'XLI',  label: 'Industrie' },
      { key: 'XLY',  label: 'Konsum zyklisch' },
      { key: 'XLP',  label: 'Konsum defensiv' },
      { key: 'XLU',  label: 'Versorger' },
      { key: 'XLRE', label: 'Immobilien' },
      { key: 'XLB',  label: 'Materialien' },
      { key: 'XLC',  label: 'Kommunikation' },
    ];
    const sectorResults = await Promise.allSettled(
      sectorDefs.map(async (def) => {
        const rt = await fetchEODHDRealTime(`${def.key}.US`);
        return { key: def.key, label: def.label, change: rt.changePercent };
      })
    );
    const sectors = sectorResults.map((r, i) =>
      r.status === 'fulfilled' ? r.value : { ...sectorDefs[i], change: null }
    );

    // Top-Movers aus Watchlist/Portfolio des Users
    const { getSavedPortfolios, getDb } = await import('../db');
    const { watchlistStocks } = await import('../../drizzle/schema');
    const portfolios = await getSavedPortfolios(ctx.user.id);
    const db2 = await getDb();
    const watchlist = db2 ? await db2.select({ ticker: watchlistStocks.ticker }).from(watchlistStocks).limit(50) : [];
    const portfolioTickers = new Set<string>();
    portfolios.forEach(p => {
      try {
        const data = JSON.parse(p.portfolioData || '{}');
        const stocks = data.stocks || data.positions || (Array.isArray(data) ? data : []);
        stocks.forEach((s: any) => { if (s.ticker) portfolioTickers.add(s.ticker); });
      } catch (e) { console.warn('[dashboardRouter] Parsen von portfolioData (Ticker-Sammlung) fehlgeschlagen:', e); }
    });
    watchlist.forEach((w: any) => { if (w.ticker) portfolioTickers.add(w.ticker); });
    const tickerList = Array.from(portfolioTickers).slice(0, 30);
    const moverResults = await Promise.allSettled(
      tickerList.map(async (ticker) => {
        const rt = await fetchEODHDRealTime(ticker);
        return { ticker, change: rt.changePercent, price: rt.close };
      })
    );
    const movers = moverResults
      .filter(r => r.status === 'fulfilled' && (r as PromiseFulfilledResult<any>).value.change !== null)
      .map(r => (r as PromiseFulfilledResult<any>).value)
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    const gainers = movers.filter(m => m.change > 0).slice(0, 3);
    const losers = movers.filter(m => m.change < 0).slice(0, 3);

    return { indices, sectors, gainers, losers, asOf: new Date().toISOString() };
  }),

  /** Letzter KI-Marktbericht aus DB */
  getLatestMarketAnalysis: protectedProcedure
    .input(z.object({ period: z.enum(['day', 'week']).default('day') }))
    .query(async ({ input }) => {
      const { getDb } = await import('../db');
      const { marketAnalysis } = await import('../../drizzle/schema');
      const { eq, desc } = await import('drizzle-orm');
      const db = await getDb();
      if (!db) return null;
      const rows = await db
        .select()
        .from(marketAnalysis)
        .where(eq(marketAnalysis.period, input.period))
        .orderBy(desc(marketAnalysis.generatedAt))
        .limit(1);
      return rows[0] ?? null;
    }),

  /** Anstehende Termine: Earnings + Dividenden für Portfolio-Aktien (nächste 14 Tage) */
  getUpcomingEvents: protectedProcedure.query(async ({ ctx }) => {
    const { getSavedPortfolios } = await import('../db');
    const portfolios = await getSavedPortfolios(ctx.user.id);
    const tickers = new Set<string>();
    portfolios.forEach(p => {
      try {
        const data = JSON.parse(p.portfolioData || '{}');
        const stocks = data.stocks || data.positions || (Array.isArray(data) ? data : []);
        stocks.forEach((s: any) => { if (s.ticker) tickers.add(s.ticker); });
      } catch (e) { console.warn('[dashboardRouter] Parsen von portfolioData (Ticker-Sammlung) fehlgeschlagen:', e); }
    });
    const tickerList = Array.from(tickers).slice(0, 30);
    const today = new Date();
    const in14 = new Date(today);
    in14.setDate(in14.getDate() + 14);
    const todayStr = today.toISOString().split('T')[0];
    const in14Str = in14.toISOString().split('T')[0];
    const EODHD_API_KEY = ENV.eodhdApiKey;
    const events: Array<{ type: string; ticker?: string; date: string; label: string; description?: string; time?: string; importance?: string; amount?: number }> = [];

    // 1. Fetch ECONOMIC CALENDAR (macro events like PMI, NFP, etc.)
    if (EODHD_API_KEY) {
      try {
        const url = `https://eodhd.com/api/economic-events?api_token=${EODHD_API_KEY}&from=${todayStr}&to=${in14Str}&country=US&fmt=json`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json() as any;
          const ecoArr = Array.isArray(data) ? data : [];
          ecoArr.forEach((e: any) => {
            const eventName = e.type || e.event;
            if (eventName && e.date) {
              // EODHD uses 'type' field for event name, importance is not provided so we infer
              const highImportance = ['Non-Farm', 'NFP', 'CPI', 'GDP', 'FOMC', 'Fed Interest', 'PMI', 'Unemployment', 'Retail Sales', 'Consumer Confidence', 'ISM'];
              const medImportance = ['ADP', 'Jobless Claims', 'PPI', 'Housing', 'Durable Goods', 'Trade Balance', 'Industrial Production'];
              const isHigh = highImportance.some(k => eventName.includes(k));
              const isMed = medImportance.some(k => eventName.includes(k));
              const importance = isHigh ? 'HOCH' : isMed ? 'MITTEL' : 'INFO';
              // Date format from EODHD: "2026-07-09 17:00:00"
              const datePart = e.date.split(' ')[0];
              const timePart = e.date.includes(' ') ? e.date.split(' ')[1]?.substring(0, 5) : undefined;
              events.push({
                type: 'macro',
                date: datePart,
                label: eventName,
                description: e.comparison || (e.period ? `Periode: ${e.period}` : ''),
                time: timePart,
                importance,
              });
            }
          });
        }
      } catch (e) { console.warn('[dashboardRouter] Wirtschaftskalender-Events fehlgeschlagen:', e); }
    }

    // 2. Fetch EARNINGS calendar for portfolio tickers
    if (EODHD_API_KEY && tickerList.length > 0) {
      try {
        const url = `https://eodhd.com/api/calendar/earnings?api_token=${EODHD_API_KEY}&from=${todayStr}&to=${in14Str}&symbols=${tickerList.join(',')}&fmt=json`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json() as any;
          const earningsArr = data?.earnings ?? data ?? [];
          if (Array.isArray(earningsArr)) {
            earningsArr.forEach((e: any) => {
              if (e.code && e.report_date) {
                events.push({ type: 'earnings', ticker: e.code, date: e.report_date, label: `${e.code} Earnings`, importance: 'MITTEL' });
              }
            });
          }
        }
      } catch (e) { console.warn('[dashboardRouter] Earnings-Kalender-Events fehlgeschlagen:', e); }

      // 3. Fetch DIVIDENDS calendar
      try {
        const url = `https://eodhd.com/api/calendar/dividends?api_token=${EODHD_API_KEY}&from=${todayStr}&to=${in14Str}&symbols=${tickerList.join(',')}&fmt=json`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json() as any;
          const divArr = data?.dividends ?? data ?? [];
          if (Array.isArray(divArr)) {
            divArr.forEach((d: any) => {
              if (d.code && d.ex_dividend_date) {
                events.push({ type: 'dividend', ticker: d.code, date: d.ex_dividend_date, label: `${d.code} Ex-Dividende`, amount: d.amount, importance: 'INFO' });
              }
            });
          }
        }
      } catch (e) { console.warn('[dashboardRouter] Dividenden-Kalender-Events fehlgeschlagen:', e); }
    }

    // Sort by date, then importance
    const importanceOrder: Record<string, number> = { 'HOCH': 0, 'MITTEL': 1, 'INFO': 2 };
    return events
      .sort((a, b) => {
        const dateCmp = a.date.localeCompare(b.date);
        if (dateCmp !== 0) return dateCmp;
        return (importanceOrder[a.importance || 'INFO'] ?? 2) - (importanceOrder[b.importance || 'INFO'] ?? 2);
      })
      .slice(0, 15); // Limit to 15 most relevant events
  }),

  /** Portfolio-Kompakt-Übersicht für Dashboard-Header */
  getPortfolioCompact: protectedProcedure.query(async ({ ctx }) => {
    const { getSavedPortfolios, getStockByTicker } = await import('../db');
    const { convertToCHF } = await import('../fxHelper');
    const portfolios = await getSavedPortfolios(ctx.user.id);
    const todayStr = new Date().toISOString().split('T')[0];
    
    const results = await Promise.all(portfolios.map(async (p) => {
      let numberOfPositions = 0;
      let currentValue = 0;
      try {
        const data = JSON.parse(p.portfolioData || '{}');
        const stocks = data.stocks || data.positions || (Array.isArray(data) ? data : []);
        numberOfPositions = stocks.length;
        const investmentAmount = parseFloat(p.investmentAmount || '0');
        
        for (const stock of stocks) {
          const ticker = stock.ticker;
          if (!ticker) continue;
          const stockData = await getStockByTicker(ticker);
          if (!stockData) {
            console.warn(`[getPortfolioCompact] ${p.name}: ticker ${ticker} not found in stocks table`);
            continue;
          }
          const currentLivePrice = parseFloat(stockData.currentPrice || '0');
          if (!currentLivePrice || isNaN(currentLivePrice)) continue; // Skip stocks with invalid prices
          const currency = stockData.currency || 'CHF';
          const weight = parseFloat(stock.weight || '0') / 100;
          let shares = parseFloat(stock.shares || '0') || 0;
          if (shares === 0 && investmentAmount > 0 && weight > 0) {
            // Use ORIGINAL price from portfolioData for share calculation (purchase price)
            const originalPrice = parseFloat(stock.currentPrice || stock.purchasePrice || '0');
            const originalPriceCHF = originalPrice > 0 ? await convertToCHF(originalPrice, stock.currency || currency, todayStr) : 0;
            if (originalPriceCHF > 0) {
              shares = (investmentAmount * weight) / originalPriceCHF;
            } else {
              // Fallback: use current price (will result in value = investmentAmount * weight)
              const priceCHF = await convertToCHF(currentLivePrice, currency, todayStr);
              shares = priceCHF > 0 ? (investmentAmount * weight) / priceCHF : 0;
            }
          }
          // Value shares at CURRENT live price
          const priceCHF = await convertToCHF(currentLivePrice, currency, todayStr);
          currentValue += shares * priceCHF;

        }
        const cashBalance = parseFloat(p.cashBalance || '0') || 0;
        currentValue += cashBalance;
      } catch (err: any) {
        console.error(`[getPortfolioCompact] Error for ${p.name}:`, err?.message || err);
      }
      return {
        id: p.id,
        name: p.name,
        isLive: p.isLive,
        investmentAmount: parseFloat(p.investmentAmount || '0'),
        currentValue: currentValue > 0 ? currentValue : parseFloat(p.investmentAmount || '0'),
        livePerformance: p.livePerformance ? parseFloat(p.livePerformance) : null,
        numberOfPositions,
        benchmark: p.benchmark,
      };
    }));
    return results;
  }),

  /** KI-Insight-Aktion ausführen: Sektoren überprüfen / Top-Positionen analysieren */
  executeInsightAction: protectedProcedure
    .input(z.object({
      actionType: z.enum(['sektoren', 'top_positionen', 'diversifikation', 'rebalancing', 'generic']),
      portfolioId: z.number().optional(),
      context: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { getSavedPortfolios, getPortfolioTransactions } = await import('../db');
      const { batchGetStocks } = await import('../db-optimized');
      const { invokeLLM } = await import('../_core/llm');

      const portfolios = await getSavedPortfolios(ctx.user.id);
      const targetPortfolios = input.portfolioId
        ? portfolios.filter(p => p.id === input.portfolioId)
        : portfolios;

      if (targetPortfolios.length === 0) {
        return { result: 'Kein Portfolio gefunden.', holdingsCount: 0 };
      }

      // Collect holdings across all target portfolios
      const holdingsMap = new Map<string, { shares: number; portfolioName: string }>();
      for (const portfolio of targetPortfolios) {
        try {
          let stocks: any[] = [];
          if (portfolio.isLive === 1 && portfolio.liveStartDate) {
            const txs = await getPortfolioTransactions(portfolio.id);
            stocks = Array.from(buildHoldings(txs).entries())
              .filter(([, h]) => h.shares > 0)
              .map(([ticker, h]) => ({ ticker, shares: h.shares }));
          } else {
            const pd = JSON.parse(portfolio.portfolioData || '{}');
            stocks = (pd.stocks || pd.positions || []).filter((s: any) => s.ticker);
          }
          for (const stock of stocks) {
            if (!stock.ticker) continue;
            const existing = holdingsMap.get(stock.ticker);
            holdingsMap.set(stock.ticker, {
              shares: (existing?.shares || 0) + parseFloat(stock.shares || '1'),
              portfolioName: portfolio.name,
            });
          }
        } catch (e) { console.warn('[dashboardRouter] Parsen von portfolioData (Holdings-Map) fehlgeschlagen:', e); }
      }

      const allTickers = Array.from(holdingsMap.keys()).slice(0, 30);
      const stocksMap = allTickers.length > 0 ? await batchGetStocks(allTickers) : new Map();

      // Build holdings summary for LLM
      const holdingsSummary = allTickers.map(ticker => {
        const stock = stocksMap.get(ticker) as any;
        return `${ticker} (${stock?.name || ticker}, Sektor: ${stock?.sector || 'unbekannt'}, Branche: ${stock?.industry || 'unbekannt'})`;
      }).join('\n');

      let systemPrompt = '';
      let userPrompt = '';

      if (input.actionType === 'sektoren') {
        systemPrompt = 'Du bist ein erfahrener Portfolio-Manager. Analysiere die Sektorverteilung und gib konkrete Empfehlungen auf Deutsch. Antworte strukturiert mit Markdown.';
        userPrompt = `Analysiere die Sektorverteilung dieses Portfolios und gib konkrete Empfehlungen:\n\nPositionen:\n${holdingsSummary}\n\nStrukturiere deine Antwort:\n## Aktuelle Sektorverteilung (geschätzt)\n## Über-/Untergewichtungen\n## Empfehlungen (welche Sektoren erhöhen/reduzieren)\n## Konkrete Titel-Vorschläge für untervertretene Sektoren`;
      } else if (input.actionType === 'top_positionen') {
        systemPrompt = 'Du bist ein erfahrener Portfolio-Manager. Analysiere die Top-Positionen und gib konkrete Kauf/Verkauf-Empfehlungen auf Deutsch. Antworte strukturiert mit Markdown.';
        userPrompt = `Analysiere die Positionen dieses Portfolios:\n\nPositionen:\n${holdingsSummary}\n\nStrukturiere deine Antwort:\n## Positionen zum Reduzieren\n## Positionen zum Erhöhen\n## Neue Titel-Vorschläge\n## Risiko-Hinweise`;
      } else if (input.actionType === 'diversifikation') {
        systemPrompt = 'Du bist ein erfahrener Portfolio-Manager. Analysiere die Diversifikation und gib Empfehlungen auf Deutsch. Antworte strukturiert mit Markdown.';
        userPrompt = `Analysiere die Diversifikation dieses Portfolios:\n\nPositionen:\n${holdingsSummary}\n\nStrukturiere deine Antwort:\n## Klumpenrisiken\n## Korrelationsrisiken\n## Empfehlungen zur Verbesserung\n## Konkrete Titel-Vorschläge`;
      } else {
        systemPrompt = 'Du bist ein erfahrener Portfolio-Manager. Beantworte auf Deutsch mit Markdown-Formatierung.';
        userPrompt = `Portfolio-Analyse:\n\nPositionen:\n${holdingsSummary}\n\nKontext: ${input.context || 'Allgemeine Analyse'}\n\nGib 3-5 konkrete Handlungsempfehlungen.`;
      }

      const response = await invokeLLM({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      const content = response.choices?.[0]?.message?.content || 'Keine Antwort erhalten.';
      return { result: content, holdingsCount: allTickers.length };
    }),

  /** KI-Marktanalyse manuell triggern (Admin) */
  triggerMarketAnalysis: protectedProcedure
    .input(z.object({ period: z.enum(['day', 'week']).default('day') }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Nur Admins können die KI-Analyse triggern');
      const { runMarketAnalysis } = await import('../cron/marketAnalysisCron');
      await runMarketAnalysis(input.period);
      return { success: true };
    }),

  /** Analyse eines Copilot-Insights: generiert konkrete Vorschläge */
  analyzeInsight: protectedProcedure
    .input(z.object({
      insightType: z.enum(['sector_check', 'top_positions', 'diversification', 'cash_management', 'general']),
      portfolioId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { getSavedPortfolios, getPortfolioTransactions } = await import('../db');
      const { batchGetStocks, batchGetHistoricalPrices } = await import('../db-optimized');
      const { convertToCHF } = await import('../fxHelper');
      const { runCopilotAnalysis, calculateRebalancingSuggestions, calculateRankings } = await import('../analytics/portfolioCopilot');
      const { getDb } = await import('../db');
      const { appSettings } = await import('../../drizzle/schema');
      const { invokeLLM } = await import('../_core/llm');

      // Load diversification rules from admin settings
      let maxWeight = 0.10, minWeight = 0.01, minTitles = 15;
      try {
        const db = await getDb();
        if (db) {
          const rows = await db.select().from(appSettings);
          const divRow = rows.find((r: any) => r.key === 'diversification_rules');
          if (divRow?.value) {
            const rules = divRow.value as any;
            maxWeight = (rules.maxPositionPercent || 10) / 100;
            minWeight = (rules.minPositionPercent || 1) / 100;
            minTitles = rules.minTitles || 15;
          }
        }
      } catch (e) { console.warn('[dashboardRouter] Laden der Rebalancing-Regeln fehlgeschlagen:', e); }

      const portfolios = await getSavedPortfolios(ctx.user.id);
      let targetPortfolios = portfolios;
      if (input.portfolioId) {
        targetPortfolios = portfolios.filter(p => p.id === input.portfolioId);
      }
      if (targetPortfolios.length === 0) {
        return { suggestions: [], summary: 'Kein Portfolio gefunden.', newTickers: [] };
      }

      // Build holdings
      const holdingsMap = new Map<string, number>();
      const todayStr = new Date().toISOString().split('T')[0];

      for (const portfolio of targetPortfolios) {
        if (portfolio.isLive === 1 && portfolio.liveStartDate) {
          const transactions = await getPortfolioTransactions(portfolio.id);
          for (const [ticker, pos] of Array.from(buildHoldings(transactions).entries())) {
            holdingsMap.set(ticker, (holdingsMap.get(ticker) || 0) + pos.shares);
          }
        } else {
          try {
            const pd = JSON.parse(portfolio.portfolioData || '{}');
            const stocks = pd.stocks || pd.positions || [];
            for (const stock of stocks) {
              if (!stock.ticker) continue;
              // Store weight directly (0-1) for demo portfolios; we'll handle in value calc
              const weight = parseFloat(stock.weight || '0') / 100;
              holdingsMap.set(stock.ticker, weight); // store weight as placeholder
            }
          } catch (e) { console.warn('[dashboardRouter] Parsen der Demo-Portfolio-Gewichte fehlgeschlagen:', e); }
        }
      }

      // Remove zero/negative holdings
      for (const [t, s] of Array.from(holdingsMap.entries())) {
        if (s <= 0) holdingsMap.delete(t);
      }

      const allTickers = Array.from(holdingsMap.keys());
      if (allTickers.length === 0) {
        return { suggestions: [], summary: 'Keine Positionen gefunden.', newTickers: [] };
      }

      const stocksMap = await batchGetStocks(allTickers);

      // Calculate current values and weights
      let totalValue = 0;
      const holdingValues: Array<{ ticker: string; value: number; sector: string; name: string }> = [];

      // For demo portfolios, holdingsMap stores weights (0-1); for live, actual shares
      const isLivePortfolio = targetPortfolios.some(p => p.isLive === 1);
      for (const [ticker, sharesOrWeight] of Array.from(holdingsMap.entries())) {
        const stock = stocksMap.get(ticker) as any;
        if (!stock) continue;
        const price = parseFloat(stock.currentPrice || '0');
        if (!price || isNaN(price)) continue;
        const currency = stock.currency || 'CHF';
        const priceCHF = await convertToCHF(price, currency, todayStr);
        let value: number;
        if (isLivePortfolio) {
          value = sharesOrWeight * priceCHF;
        } else {
          // sharesOrWeight is actually a weight (0-1), use investmentAmount
          const investmentAmount = parseFloat(targetPortfolios[0]?.investmentAmount || '100000');
          value = sharesOrWeight * investmentAmount;
        }
        totalValue += value;
        holdingValues.push({ ticker, value, sector: stock.sector || 'Other', name: stock.companyName || ticker });
      }

      for (const h of holdingValues) {
        (h as any).weight = totalValue > 0 ? h.value / totalValue : 0;
      }

      // Sector analysis
      const sectorWeights = new Map<string, number>();
      for (const h of holdingValues) {
        const w = (h as any).weight;
        sectorWeights.set(h.sector, (sectorWeights.get(h.sector) || 0) + w);
      }

      // Use LLM to generate specific suggestions based on insight type
      const portfolioContext = holdingValues.map(h => 
        `${h.ticker} (${h.name}): ${((h as any).weight * 100).toFixed(1)}%, Sektor: ${h.sector}`
      ).join('\n');
      const sectorContext = Array.from(sectorWeights.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([s, w]) => `${s}: ${(w * 100).toFixed(1)}%`)
        .join(', ');


      let prompt = '';
      if (input.insightType === 'sector_check') {
        prompt = `Analysiere die Sektorverteilung dieses Portfolios und schlage konkrete Umschichtungen vor.
Sektoren: ${sectorContext}
Positionen:\n${portfolioContext}\n\nRegeln: Max ${(maxWeight*100).toFixed(0)}% pro Position, Min ${(minWeight*100).toFixed(0)}% pro Position, Min ${minTitles} Titel.
Schlage vor: Welche Sektoren sind über-/untervertreten? Welche Positionen reduzieren? Welche NEUEN Aktien aus untervertretenen Sektoren aufnehmen?`;
      } else if (input.insightType === 'top_positions') {
        prompt = `Analysiere die Top-Positionen dieses Portfolios auf Klumpenrisiken.
Positionen:\n${portfolioContext}\n\nRegeln: Max ${(maxWeight*100).toFixed(0)}% pro Position, Min ${(minWeight*100).toFixed(0)}% pro Position, Min ${minTitles} Titel.
Schlage vor: Welche Positionen sind zu gross? Welche neuen Titel mit ähnlichem/besserem Rendite-Risiko-Profil können zur Diversifikation aufgenommen werden?`;
      } else if (input.insightType === 'diversification') {
        prompt = `Analysiere die Diversifikation dieses Portfolios.
Sektoren: ${sectorContext}
Positionen:\n${portfolioContext}\n\nRegeln: Max ${(maxWeight*100).toFixed(0)}% pro Position, Min ${(minWeight*100).toFixed(0)}% pro Position, Min ${minTitles} Titel.
Aktuell ${holdingValues.length} Positionen. Minimum sind ${minTitles}. Schlage konkrete neue Titel vor, die die Diversifikation verbessern.`;
      } else {
        prompt = `Analysiere dieses Portfolio und gib konkrete Optimierungsvorschläge.
Sektoren: ${sectorContext}
Positionen:\n${portfolioContext}\n\nRegeln: Max ${(maxWeight*100).toFixed(0)}% pro Position, Min ${(minWeight*100).toFixed(0)}% pro Position, Min ${minTitles} Titel.`;
      }

      try {
        const response = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: `Du bist ein Schweizer Portfolio-Berater. Gib konkrete, umsetzbare Vorschläge als JSON.
Jeder Vorschlag hat: ticker, action ("reduce", "increase", "add_new", "exit"), currentWeightPercent (0 für neue), targetWeightPercent, reason (1 Satz).
Bei "add_new" verwende echte Ticker von der Schweizer Börse (SIX: .SW) oder US-Börsen.
Halte dich strikt an die Diversifikationsregeln. Maximal 8 Vorschläge.`
            },
            { role: 'user', content: prompt }
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'portfolio_suggestions',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  summary: { type: 'string', description: 'Zusammenfassung in 2-3 Sätzen' },
                  suggestions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        ticker: { type: 'string' },
                        companyName: { type: 'string' },
                        action: { type: 'string', enum: ['reduce', 'increase', 'add_new', 'exit'] },
                        currentWeightPercent: { type: 'number' },
                        targetWeightPercent: { type: 'number' },
                        reason: { type: 'string' }
                      },
                      required: ['ticker', 'companyName', 'action', 'currentWeightPercent', 'targetWeightPercent', 'reason'],
                      additionalProperties: false
                    }
                  }
                },
                required: ['summary', 'suggestions'],
                additionalProperties: false
              }
            }
          }
        });

        const content = response.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(typeof content === 'string' ? content : '');
          return {
            summary: parsed.summary || '',
            suggestions: (parsed.suggestions || []).map((s: any) => ({
              ticker: s.ticker,
              companyName: s.companyName || s.ticker,
              action: s.action,
              currentWeightPercent: s.currentWeightPercent,
              targetWeightPercent: s.targetWeightPercent,
              reason: s.reason,
            })),
            newTickers: (parsed.suggestions || []).filter((s: any) => s.action === 'add_new').map((s: any) => s.ticker),
          };
        }
      } catch (e: any) {
        console.error('[analyzeInsight] LLM error:', e?.message || e);
        return { suggestions: [], summary: `Fehler bei der KI-Analyse: ${e?.message || 'Unbekannter Fehler'}`, newTickers: [] };
      }

      return { suggestions: [], summary: 'Analyse konnte nicht durchgeführt werden.', newTickers: [] };
    }),

  /** Vorschläge umsetzen: Positionen im Portfolio anpassen */
  applySuggestions: protectedProcedure
    .input(z.object({
      portfolioId: z.number(),
      suggestions: z.array(z.object({
        ticker: z.string(),
        action: z.enum(['reduce', 'increase', 'add_new', 'exit']),
        targetWeightPercent: z.number(),
      })),
      autoCalculateFees: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const { getSavedPortfolios, getPortfolioTransactions } = await import('../db');
      const { getDb } = await import('../db');
      const { savedPortfolios, portfolioTransactions, appSettings } = await import('../../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const { batchGetStocks } = await import('../db-optimized');
      const { convertToCHF } = await import('../fxHelper');

      const portfolios = await getSavedPortfolios(ctx.user.id);
      const portfolio = portfolios.find(p => p.id === input.portfolioId);
      if (!portfolio) throw new Error('Portfolio nicht gefunden');

      const isLive = portfolio.isLive === 1 && portfolio.liveStartDate;
      const todayStr = new Date().toISOString().split('T')[0];
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Load fee structure
      let fees = { buyFeePercent: 0.25, sellFeePercent: 0.25, minFeeCHF: 9.90, maxFeeCHF: 50, stampDutyPercent: 0.075, fxSpreadPercent: 0.5 };
      if (input.autoCalculateFees) {
        try {
          const rows = await db.select().from(appSettings);
          const feeRow = rows.find((r: any) => r.key === 'fee_structure');
          if (feeRow?.value) fees = { ...fees, ...(feeRow.value as any) };
        } catch (e) { console.warn('[dashboardRouter] Laden der Gebührenstruktur fehlgeschlagen:', e); }
      }

      if (isLive) {
        // Live portfolio: create actual transactions
        const allTickers = input.suggestions.map(s => s.ticker);
        const stocksMap = await batchGetStocks(allTickers);

        // Get current holdings
        const transactions = await getPortfolioTransactions(portfolio.id);
        const holdingsMap = new Map<string, number>(
          Array.from(buildHoldings(transactions).entries()).map(([ticker, pos]) => [ticker, pos.shares])
        );

        // Calculate total portfolio value
        let totalValue = 0;
        for (const [ticker, shares] of Array.from(holdingsMap.entries())) {
          const stock = stocksMap.get(ticker) as any;
          if (!stock) continue;
          const price = parseFloat(stock.currentPrice || '0');
          const currency = stock.currency || 'CHF';
          const priceCHF = await convertToCHF(price, currency, todayStr);
          totalValue += shares * priceCHF;
        }
        totalValue += parseFloat(portfolio.cashBalance || '0');

        const createdTransactions: string[] = [];

        for (const suggestion of input.suggestions) {
          const stock = stocksMap.get(suggestion.ticker) as any;
          if (!stock) continue;
          const price = parseFloat(stock.currentPrice || '0');
          if (!price) continue;
          const currency = stock.currency || 'CHF';
          const priceCHF = await convertToCHF(price, currency, todayStr);

          const currentShares = holdingsMap.get(suggestion.ticker) || 0;
          const currentValue = currentShares * priceCHF;
          const targetValue = totalValue * (suggestion.targetWeightPercent / 100);
          const deltaValue = targetValue - currentValue;
          const deltaShares = Math.abs(deltaValue / priceCHF);

          if (deltaShares < 0.01) continue;

          const txType = deltaValue > 0 ? 'buy' : 'sell';
          const shares = deltaShares.toFixed(4);
          const total = Math.abs(deltaValue);

          // Calculate fees
          let fee = 0;
          if (input.autoCalculateFees) {
            const feePercent = txType === 'buy' ? fees.buyFeePercent : fees.sellFeePercent;
            fee = Math.max(fees.minFeeCHF, Math.min(fees.maxFeeCHF, total * feePercent / 100));
            fee += total * fees.stampDutyPercent / 100;
            if (currency !== 'CHF') fee += total * fees.fxSpreadPercent / 100;
          }

          await db.insert(portfolioTransactions).values({
            portfolioId: portfolio.id,
            transactionType: txType,
            ticker: suggestion.ticker,
            shares,
            pricePerShare: price.toString(),
            totalAmount: total.toFixed(2),
            currency,
            fees: fee > 0 ? fee.toFixed(2) : null,
            transactionDate: todayStr,
            notes: `KI-Vorschlag: ${suggestion.action}`,
          } as any);

          createdTransactions.push(`${txType.toUpperCase()} ${shares} ${suggestion.ticker}`);
        }

        return { success: true, mode: 'live', transactions: createdTransactions };
      } else {
        // Demo portfolio: just update the portfolioData weights
        try {
          const pd = JSON.parse(portfolio.portfolioData || '{}');
          const stocks = pd.stocks || pd.positions || [];

          for (const suggestion of input.suggestions) {
            if (suggestion.action === 'add_new') {
              // Add new position
              stocks.push({
                ticker: suggestion.ticker,
                weight: suggestion.targetWeightPercent.toString(),
              });
            } else if (suggestion.action === 'exit') {
              // Remove position
              const idx = stocks.findIndex((s: any) => s.ticker === suggestion.ticker);
              if (idx >= 0) stocks.splice(idx, 1);
            } else {
              // Update weight
              const existing = stocks.find((s: any) => s.ticker === suggestion.ticker);
              if (existing) {
                existing.weight = suggestion.targetWeightPercent.toString();
              }
            }
          }

          // Normalize weights to 100%
          const totalWeight = stocks.reduce((sum: number, s: any) => sum + parseFloat(s.weight || '0'), 0);
          if (totalWeight > 0 && Math.abs(totalWeight - 100) > 1) {
            const scale = 100 / totalWeight;
            for (const s of stocks) {
              s.weight = (parseFloat(s.weight || '0') * scale).toFixed(2);
            }
          }

          pd.stocks = stocks;
          pd.positions = stocks;

          await db.update(savedPortfolios)
            .set({ portfolioData: JSON.stringify(pd) })
            .where(eq(savedPortfolios.id, portfolio.id));

          return { success: true, mode: 'demo', updatedPositions: stocks.length };
        } catch (e) {
          throw new Error(`Fehler beim Aktualisieren: ${(e as Error).message}`);
        }
      }
    }),
});
