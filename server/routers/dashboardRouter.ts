import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

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
    const { batchGetPortfolioTransactions, batchGetStocks, batchGetHistoricalPrices, getCachedFxRate, setCachedFxRate } = await import("../db-optimized");
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
    const calculatePortfolioValueFromData = async (portfolio: any): Promise<number> => {
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
    
    // Load yesterday's prices for dayChange calculation
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const yesterdayPricesMap = await batchGetHistoricalPrices(Array.from(allTickers), yesterdayStr);
    
    // OPTIMIZATION: Pre-warm FX cache
    const uniqueCurrencies = new Set<string>();
    for (const stock of Array.from(stocksMap.values())) {
      if (stock.currency) uniqueCurrencies.add(stock.currency);
    }
    
    const fxPromises = [];
    for (const currency of Array.from(uniqueCurrencies)) {
      if (currency !== 'CHF') {
        if (!getCachedFxRate(currency, today)) {
          fxPromises.push(
            convertToCHF(1, currency, today).then(rate => {
              setCachedFxRate(currency, today, rate);
              return rate;
            })
          );
        }
        if (!getCachedFxRate(currency, ytdStartDate)) {
          fxPromises.push(
            convertToCHF(1, currency, ytdStartDate).then(rate => {
              setCachedFxRate(currency, ytdStartDate, rate);
              return rate;
            })
          );
        }
      }
    }
    await Promise.all(fxPromises);
    
    let totalValueCHF = 0;
    let totalValueYTDStartCHF = 0;
    let totalValueYesterdayCHF = 0;
    let totalDividendsCHF = 0;
    let totalInvestedCHF = 0;
    
    // Helper: Calculate portfolio value at YTD start date using historical prices
    const calculatePortfolioValueAtDate = async (portfolio: any, dateStr: string, pricesMap?: Map<string, number>): Promise<number> => {
      try {
        const portfolioData = JSON.parse(portfolio.portfolioData || '{}');
        const stocks = portfolioData.stocks || portfolioData.positions || [];
        if (stocks.length === 0) return 0;
        
        let totalValueAtDate = 0;
        const investmentAmount = parseFloat(portfolio.investmentAmount || '0');
        const usePricesMap = pricesMap || ytdPricesMap;
        
        for (const stock of stocks) {
          const ticker = stock.ticker;
          if (!ticker) continue;
          
          const stockData = stocksMap.get(ticker);
          if (!stockData) continue;
          
          const currency = stockData.currency || 'CHF';
          const weight = parseFloat(stock.weight || '0') / 100;
          
          // Get historical price at the given date
          const historicalPrice = usePricesMap.get(ticker);
          if (!historicalPrice) continue;
          
          let shares = parseFloat(stock.shares || '0') || 0;
          if (shares === 0 && investmentAmount > 0 && weight > 0) {
            // Calculate shares from weight and investment amount
            const allocationCHF = investmentAmount * weight;
            const priceCHF = await convertToCHF(historicalPrice, currency, dateStr);
            shares = (priceCHF > 0 ? allocationCHF / priceCHF : 0) || 0;
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
      const portfolioValueCHF = await calculatePortfolioValueFromData(portfolio);
      const investmentAmount = parseFloat(portfolio.investmentAmount || '0');
      
      // Calculate YTD start value using actual historical prices (same method as portfoliosRouter.list)
      const ytdStartValue = await calculatePortfolioValueAtDate(portfolio, ytdStartDate);
      // If we couldn't get historical prices, fall back to investmentAmount
      const portfolioValueYTDStartCHF = ytdStartValue > 0 ? ytdStartValue : (investmentAmount || portfolioValueCHF);
      
      // Calculate yesterday value for dayChange
      const portfolioValueYesterdayCHF = await calculatePortfolioValueAtDate(portfolio, yesterdayStr, yesterdayPricesMap);
      
      totalValueCHF += portfolioValueCHF;
      totalValueYTDStartCHF += portfolioValueYTDStartCHF;
      totalValueYesterdayCHF += portfolioValueYesterdayCHF > 0 ? portfolioValueYesterdayCHF : portfolioValueCHF;
      totalInvestedCHF += investmentAmount;
    }
    
    // Also calculate values for demo portfolios
    for (const portfolio of demoPortfolios) {
      const portfolioValueCHF = await calculatePortfolioValueFromData(portfolio);
      const investmentAmount = parseFloat(portfolio.investmentAmount || '0');
      
      // Calculate YTD start value using actual historical prices
      const ytdStartValue = await calculatePortfolioValueAtDate(portfolio, ytdStartDate);
      const portfolioValueYTDStartCHF = ytdStartValue > 0 ? ytdStartValue : (investmentAmount || portfolioValueCHF);
      
      // Calculate yesterday value for dayChange
      const portfolioValueYesterdayCHF = await calculatePortfolioValueAtDate(portfolio, yesterdayStr, yesterdayPricesMap);
      
      totalValueCHF += portfolioValueCHF;
      totalValueYTDStartCHF += portfolioValueYTDStartCHF;
      totalValueYesterdayCHF += portfolioValueYesterdayCHF > 0 ? portfolioValueYesterdayCHF : portfolioValueCHF;
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
    const { eq, and, lte, desc } = await import("drizzle-orm");
    
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
    
    // Calculate day change
    const dayChangeCHF = totalValueCHF - totalValueYesterdayCHF;
    const dayChangePercent = totalValueYesterdayCHF > 0 ? (dayChangeCHF / totalValueYesterdayCHF) * 100 : 0;
    
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
    const { batchGetStocks, batchGetHistoricalPrices, getCachedFxRate, setCachedFxRate } = await import("../db-optimized");
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
        } catch {}
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
      !getCachedFxRate(c, todayStr) ? convertToCHF(1, c, todayStr).then(r => setCachedFxRate(c, todayStr, r)) : Promise.resolve(),
      !getCachedFxRate(c, ytdStartDate) ? convertToCHF(1, c, ytdStartDate).then(r => setCachedFxRate(c, ytdStartDate, r)) : Promise.resolve(),
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
          const holdings: Record<string, number> = {};
          transactions.forEach((tx: any) => {
            const shares = parseFloat(tx.shares || '0');
            const ticker = tx.ticker;
            if (!ticker) return;
            if (tx.transactionType === 'buy') holdings[ticker] = (holdings[ticker] || 0) + shares;
            else if (tx.transactionType === 'sell') holdings[ticker] = (holdings[ticker] || 0) - shares;
          });

          let currentValueForPerf = 0;
          let ytdStartValueCHF = 0;
          let hasHistoricalData = false;

          for (const [ticker, shares] of Object.entries(holdings)) {
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
          const holdings: Record<string, number> = {};
          transactions.forEach((tx: any) => {
            const shares = parseFloat(tx.shares || '0');
            const ticker = tx.ticker;
            if (!ticker) return;
            if (tx.transactionType === 'buy') holdings[ticker] = (holdings[ticker] || 0) + shares;
            else if (tx.transactionType === 'sell') holdings[ticker] = (holdings[ticker] || 0) - shares;
          });
          positionCount = Object.values(holdings).filter(s => s > 0).length;
        } else {
          try {
            const pd = JSON.parse(portfolio.portfolioData || '{}');
            const stocks = pd.stocks || pd.positions || [];
            positionCount = stocks.length;
          } catch {}
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
      const { batchGetStocks, getCachedFxRate, setCachedFxRate } = await import("../db-optimized");
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
        !getCachedFxRate(c, todayStr) ? convertToCHF(1, c, todayStr).then(r => setCachedFxRate(c, todayStr, r)) : Promise.resolve()
      ));

      const pricesCHF = new Map<string, Map<string, number>>();
      for (const [ticker, datePrices] of rawPriceMap.entries()) {
        const currency = currencyByTicker.get(ticker) || 'CHF';
        const chfPrices = new Map<string, number>();
        if (currency === 'CHF') {
          for (const [date, price] of datePrices.entries()) chfPrices.set(date, price);
        } else {
          const fxRate = getCachedFxRate(currency, todayStr) || await convertToCHF(1, currency, todayStr);
          for (const [date, price] of datePrices.entries()) chfPrices.set(date, price * fxRate);
        }
        pricesCHF.set(ticker, chfPrices);
      }

      // Build holdings timeline
      const holdingsTimeline = buildHoldingsTimeline(allTransactions, sortedDates);

      // Build cash balances
      const cashBalances = new Map<string, number>();
      const sortedTxs = [...allTransactions].sort((a, b) => {
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
          case 'deposit': case 'entry': change = amountCHF; break;
          case 'withdrawal': change = -amountCHF; break;
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
      const cashFlows = extractPortfolioCashFlows(allTransactions);

      // Calculate TTWROR
      const ttwrorResult = calculateTTWROR(valuations, cashFlows);

      // Calculate IRR
      const mvb = valuations.length > 0 ? valuations[0].marketValue : 0;
      const mve = valuations.length > 0 ? valuations[valuations.length - 1].marketValue : 0;
      const irrCashFlows = cashFlows.map(cf => ({
        ...cf,
        amount: cf.type === 'withdrawal' ? -Math.abs(cf.amount) : Math.abs(cf.amount),
      }));
      const irrResult = calculateIRR(mvb, mve, irrCashFlows, startDateStr, todayStr);

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
      const { batchGetStocks, getCachedFxRate, setCachedFxRate } = await import("../db-optimized");
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
          } catch {}
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
      if (sortedDates.length === 0) return { range: input.range, scope: input.scope, points: [] };

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
        return best >= 0 ? tp.get(dates[best]) : undefined;
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

      const points: Array<{ label: string; portfolio: number; smi: number; msci: number }> = [];

      for (let i = 0; i < sampledDates.length; i++) {
        const date = sampledDates[i];
        let totalValueCHF = 0;

        for (const portfolio of targetPortfolios) {
          if (portfolio.isLive === 1 && portfolio.liveStartDate) {
            // Live portfolio: calculate from transactions
            const liveStart = new Date(portfolio.liveStartDate).toISOString().split('T')[0];
            if (date < liveStart) continue;
            const transactions = txByPortfolio.get(portfolio.id) || [];
            const holdingsMap = new Map<string, number>();
            for (const tx of transactions) {
              const txDate = new Date(tx.transactionDate).toISOString().split('T')[0];
              if (txDate > date) continue;
              const ticker = tx.ticker;
              if (!ticker) continue;
              if (tx.transactionType === 'buy') holdingsMap.set(ticker, (holdingsMap.get(ticker) || 0) + parseFloat(tx.shares || '0'));
              else if (tx.transactionType === 'sell') holdingsMap.set(ticker, (holdingsMap.get(ticker) || 0) - parseFloat(tx.shares || '0'));
            }
            for (const [ticker, shares] of Array.from(holdingsMap.entries())) {
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

      return { range: input.range, scope: input.scope, points: filteredPoints };
    }),

  // ──────────────────────────────────────────────────────────────────────
  // Aggregated holdings across all live portfolios
  // ──────────────────────────────────────────────────────────────────────
  getAggregatedHoldings: protectedProcedure
    .input(z.object({ scope: z.union([z.literal("aggregate"), z.number()]).default("aggregate") }))
    .query(async ({ ctx, input }) => {
      const { getSavedPortfolios, getPortfolioTransactions } = await import("../db");
      const { batchGetStocks, batchGetHistoricalPrices, getCachedFxRate, setCachedFxRate } = await import("../db-optimized");
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
          for (const tx of transactions) {
            const ticker = tx.ticker;
            if (!ticker) continue;
            const shares = parseFloat(tx.shares || '0');
            if (tx.transactionType === 'buy') holdingsAgg.set(ticker, (holdingsAgg.get(ticker) || 0) + shares);
            else if (tx.transactionType === 'sell') holdingsAgg.set(ticker, (holdingsAgg.get(ticker) || 0) - shares);
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
          } catch {}
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
        !getCachedFxRate(c, todayStr) ? convertToCHF(1, c, todayStr).then(r => setCachedFxRate(c, todayStr, r)) : Promise.resolve()
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
        } catch {}
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

        // 1d change: use ytdPerformance as a rough proxy if no real-time data
        // The real-time change will be fetched via EODHD in getHoldings1dChange below
        let change1d = 0;
        if (stock.ytdPerformance) {
          // Rough daily: ytd% / trading days elapsed this year
          const now = new Date();
          const yearStart = new Date(now.getFullYear(), 0, 1);
          const daysSinceYearStart = Math.max(1, Math.floor((now.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)));
          const tradingDays = Math.floor(daysSinceYearStart * 5 / 7); // approximate
          change1d = parseFloat(stock.ytdPerformance) / Math.max(tradingDays, 1);
        }

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
      const { batchGetStocks, batchGetHistoricalPrices, getCachedFxRate, setCachedFxRate } = await import("../db-optimized");
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
          for (const tx of transactions) {
            const ticker = tx.ticker;
            if (!ticker) continue;
            const shares = parseFloat(tx.shares || '0');
            if (tx.transactionType === 'buy') holdingsAgg.set(ticker, (holdingsAgg.get(ticker) || 0) + shares);
            else if (tx.transactionType === 'sell') holdingsAgg.set(ticker, (holdingsAgg.get(ticker) || 0) - shares);
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
          } catch {}
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
        !getCachedFxRate(c, todayStr) ? convertToCHF(1, c, todayStr).then(r => setCachedFxRate(c, todayStr, r)) : Promise.resolve()
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
        } catch {}
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
      const { batchGetStocks, getCachedFxRate, setCachedFxRate } = await import("../db-optimized");
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
          for (const tx of transactions) {
            const ticker = tx.ticker;
            if (!ticker) continue;
            const shares = parseFloat(tx.shares || '0');
            if (tx.transactionType === 'buy') holdingsAgg.set(ticker, (holdingsAgg.get(ticker) || 0) + shares);
            else if (tx.transactionType === 'sell') holdingsAgg.set(ticker, (holdingsAgg.get(ticker) || 0) - shares);
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
          } catch {}
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
        !getCachedFxRate(c, todayStr) ? convertToCHF(1, c, todayStr).then(r => setCachedFxRate(c, todayStr, r)) : Promise.resolve()
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
        } catch {}
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
      const { batchGetStocks, getCachedFxRate, setCachedFxRate } = await import("../db-optimized");
      const { convertToCHF, convertToCHFSync, getFxRate } = await import("../fxHelper");
      const { getDb } = await import("../db");
      const { historicalPrices } = await import("../../drizzle/schema");
      const { inArray, and, gte, lte } = await import("drizzle-orm");

      const db = await getDb();
      if (!db) return { volatility: 0, volBenchmark: 0, maxDrawdown: 0, drawdownBenchmark: 0, var95: 0, concentrationTop3: 0, sharpeRatio: 0, sharpeBenchmark: 0, beta: 0 };

      const portfolios = await getSavedPortfolios(ctx.user.id);
      // Support both live and demo portfolios
      let targetPortfolios: any[];
      if (input.scope === "aggregate") {
        targetPortfolios = portfolios.filter(p => p.isLive === 1 && p.liveStartDate);
      } else {
        targetPortfolios = portfolios.filter(p => p.id === input.scope);
      }
      if (targetPortfolios.length === 0) return { volatility: 0, volBenchmark: 0, maxDrawdown: 0, drawdownBenchmark: 0, var95: 0, concentrationTop3: 0, sharpeRatio: 0, sharpeBenchmark: 0, beta: 0 };

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
          } catch {}
        }
      }

      if (allTickers.size === 0) return { volatility: 0, volBenchmark: 0, maxDrawdown: 0, drawdownBenchmark: 0, var95: 0, concentrationTop3: 0, sharpeRatio: 0, sharpeBenchmark: 0, beta: 0 };

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
        !getCachedFxRate(c, todayStr) ? convertToCHF(1, c, todayStr).then(r => setCachedFxRate(c, todayStr, r)) : Promise.resolve()
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
            const holdingsMap = new Map<string, number>();
            for (const tx of transactions) {
              const txDate = new Date(tx.transactionDate).toISOString().split('T')[0];
              if (txDate > date) continue;
              const ticker = tx.ticker;
              if (!ticker) continue;
              if (tx.transactionType === 'buy') holdingsMap.set(ticker, (holdingsMap.get(ticker) || 0) + parseFloat(tx.shares || '0'));
              else if (tx.transactionType === 'sell') holdingsMap.set(ticker, (holdingsMap.get(ticker) || 0) - parseFloat(tx.shares || '0'));
            }
            for (const [ticker, shares] of Array.from(holdingsMap.entries())) {
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

      if (dailyReturns.length < 10) return { volatility: 0, volBenchmark: 0, maxDrawdown: 0, drawdownBenchmark: 0, var95: 0, concentrationTop3: 0, sharpeRatio: 0, sharpeBenchmark: 0, beta: 0 };

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
        for (const tx of transactions) {
          const ticker = tx.ticker;
          if (!ticker) continue;
          const shares = parseFloat(tx.shares || '0');
          if (tx.transactionType === 'buy') holdingsAgg.set(ticker, (holdingsAgg.get(ticker) || 0) + shares);
          else if (tx.transactionType === 'sell') holdingsAgg.set(ticker, (holdingsAgg.get(ticker) || 0) - shares);
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
          return {
            score: formatted.score,
            label: formatted.label,
            history: [] as number[],
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
      const { batchGetStocks, batchGetHistoricalPrices, getCachedFxRate, setCachedFxRate } = await import("../db-optimized");
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
          for (const tx of transactions) {
            const ticker = tx.ticker;
            if (!ticker) continue;
            const shares = parseFloat(tx.shares || '0');
            if (tx.transactionType === 'buy') holdingsAgg.set(ticker, (holdingsAgg.get(ticker) || 0) + shares);
            else if (tx.transactionType === 'sell') holdingsAgg.set(ticker, (holdingsAgg.get(ticker) || 0) - shares);
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
          } catch {}
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
        !getCachedFxRate(c, todayStr) ? convertToCHF(1, c, todayStr).then(r => setCachedFxRate(c, todayStr, r)) : Promise.resolve()
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
        } catch {}
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
        } catch {}
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
        } catch (_) {}
        let momentumResult: any = { score: 0, grade: 'C', trend: 'neutral' };
        if (prices.length >= 60) { try { momentumResult = calculateMomentumScore({ prices }); } catch (_) {} }
        let qualityResult: any = { score: 0, grade: 'C' };
        try { qualityResult = calculateQualityScore(qualityMetrics); } catch (_) {}
        let bubbleScore = 0, bubbleRegime = 'normal';
        if (prices.length >= 60) { try { const b = detectBubble({ prices }); bubbleScore = b.bubbleScore ?? 0; bubbleRegime = b.regime ?? 'normal'; } catch (_) {} }
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
});

