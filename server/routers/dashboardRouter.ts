import { protectedProcedure, router } from "../_core/trpc";

// Helper to get YTD start date (January 1st of current year)
function getYTDStartDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-01-01`;
}

export const dashboardRouter = router({
  // Get aggregated metrics across all live portfolios - OPTIMIZED with batch loading
  getAggregatedMetrics: protectedProcedure.query(async ({ ctx }) => {
    const { getSavedPortfolios, getStockByTicker } = await import("../db");
    const { batchGetPortfolioTransactions, batchGetStocks, batchGetHistoricalPrices, getCachedFxRate, setCachedFxRate } = await import("../db-optimized");
    const { convertToCHF } = await import("../fxHelper");
    
    const portfolios = await getSavedPortfolios(ctx.user.id);
    const livePortfolios = portfolios.filter(p => p.isLive === 1 && p.liveStartDate);
    
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
          
          const currentPrice = parseFloat(stockData.currentPrice || '0');
          const currency = stockData.currency || 'CHF';
          const weight = parseFloat(stock.weight || '0') / 100;
          
          let shares = parseFloat(stock.shares || '0');
          if (shares === 0 && investmentAmount > 0 && weight > 0) {
            const allocationCHF = investmentAmount * weight;
            const priceCHF = await convertToCHF(currentPrice, currency, todayStr);
            shares = priceCHF > 0 ? allocationCHF / priceCHF : 0;
          }
          
          const priceCHF = await convertToCHF(currentPrice, currency, todayStr);
          totalValueCHF += shares * priceCHF;
        }
        
        const cashBalance = parseFloat(portfolio.cashBalance || '0');
        totalValueCHF += cashBalance;
        
        return totalValueCHF;
      } catch (error) {
        console.error(`[dashboard.getAggregatedMetrics] Error calculating value from portfolioData:`, error);
        return 0;
      }
    };
    
    if (livePortfolios.length === 0) {
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
    
    // OPTIMIZATION: Collect all unique tickers
    const allTickers = new Set<string>();
    for (const transactions of Array.from(transactionsByPortfolio.values())) {
      transactions.forEach(tx => {
        if (tx.ticker) allTickers.add(tx.ticker);
      });
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
    let totalDividendsCHF = 0;
    let totalInvestedCHF = 0;
    
    // Calculate metrics for each live portfolio - ALWAYS use portfolioData for consistent values
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
      
      // ALWAYS calculate value from portfolioData for consistency with portfolio list and detail pages
      const portfolioValueCHF = await calculatePortfolioValueFromData(portfolio);
      const investmentAmount = parseFloat(portfolio.investmentAmount || '0');
      const portfolioValueYTDStartCHF = investmentAmount || portfolioValueCHF;
      
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
    const { eq, and, lte, desc } = await import("drizzle-orm");
    
    let benchmarkPerformance = 0;
    try {
      const db = await getDb();
      if (db) {
        // Get benchmark price at YTD start
        const ytdBenchmarkPrices = await db
          .select()
          .from(historicalPrices)
          .where(
            and(
              eq(historicalPrices.ticker, benchmarkTicker),
              lte(historicalPrices.date, ytdStartDate)
            )
          )
          .orderBy(desc(historicalPrices.date))
          .limit(1);
        
        // Get current benchmark price
        const currentBenchmarkPrices = await db
          .select()
          .from(historicalPrices)
          .where(
            and(
              eq(historicalPrices.ticker, benchmarkTicker),
              lte(historicalPrices.date, today)
            )
          )
          .orderBy(desc(historicalPrices.date))
          .limit(1);
        
        if (ytdBenchmarkPrices.length > 0 && currentBenchmarkPrices.length > 0) {
          const ytdPrice = parseFloat(ytdBenchmarkPrices[0].close || '0');
          const currentPrice = parseFloat(currentBenchmarkPrices[0].close || '0');
          
          if (ytdPrice > 0) {
            benchmarkPerformance = ((currentPrice - ytdPrice) / ytdPrice) * 100;
          }
        }
      }
    } catch (error) {
      console.error('[dashboard.getAggregatedMetrics] Error calculating benchmark performance:', error);
    }
    
    // Calculate average dividend yield across all stocks in live portfolios
    let totalDividendYield = 0;
    let stockCount = 0;
    
    for (const portfolio of livePortfolios) {
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
    
    return {
      totalValue: totalValueCHF,
      totalInvested: totalInvestedCHF,
      totalPerformance: totalPerformanceCHF,
      totalPerformancePercent: totalPerformancePercent,
      totalDividends: totalDividendsCHF,
      portfolioCount: portfolios.length,
      livePortfolioCount: livePortfolios.length,
      benchmarkPerformance: benchmarkPerformance,
      avgDividendYield: avgDividendYield,
    };
  }),
  
  // Get all portfolios with YTD performance
  getTopPortfolios: protectedProcedure.query(async ({ ctx }) => {
    const { getSavedPortfolios, getPortfolioTransactions } = await import("../db");
    const { batchGetStocks, batchGetHistoricalPrices, getCachedFxRate, setCachedFxRate } = await import("../db-optimized");
    const { convertToCHF } = await import("../fxHelper");
    
    const portfolios = await getSavedPortfolios(ctx.user.id);
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
            const currentPrice = parseFloat(stock.currentPrice || '0');
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
          // Demo portfolio: calculate from portfolioData
          const pd = JSON.parse(portfolio.portfolioData || '{}');
          const stocks = pd.stocks || pd.positions || [];
          const investmentAmount = parseFloat(portfolio.investmentAmount || '0');
          for (const stock of stocks) {
            const ticker = stock.ticker;
            if (!ticker) continue;
            const stockData = stocksMap.get(ticker) as any;
            if (!stockData) continue;
            const currentPrice = parseFloat(stockData.currentPrice || '0');
            const currency = stockData.currency || 'CHF';
            const weight = parseFloat(stock.weight || '0') / 100;
            let shares = parseFloat(stock.shares || '0');
            if (shares === 0 && investmentAmount > 0 && weight > 0) {
              const allocationCHF = investmentAmount * weight;
              const priceCHF = await convertToCHF(currentPrice, currency, todayStr);
              shares = priceCHF > 0 ? allocationCHF / priceCHF : 0;
            }
            const priceCHF = await convertToCHF(currentPrice, currency, todayStr);
            portfolioValueCHF += shares * priceCHF;
          }
          const cashBalance = parseFloat(portfolio.cashBalance || '0');
          portfolioValueCHF += cashBalance;
          if (investmentAmount > 0) {
            performancePercent = ((portfolioValueCHF - investmentAmount) / investmentAmount) * 100;
          }
        }

        portfolioMetrics.push({
          id: portfolio.id,
          name: portfolio.name,
          description: portfolio.description,
          isLive,
          value: portfolioValueCHF,
          performance: Number(performancePercent.toFixed(2)),
          performanceCHF: Number((portfolioValueCHF - parseFloat(portfolio.investmentAmount || '0')).toFixed(2)),
        });
      } catch (error) {
        console.error(`[dashboard.getTopPortfolios] Error for portfolio ${portfolio.id}:`, error);
      }
    }

    portfolioMetrics.sort((a, b) => b.performance - a.performance);
    return portfolioMetrics;
  }),
});
