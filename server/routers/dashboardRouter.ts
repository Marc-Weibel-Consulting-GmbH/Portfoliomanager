import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

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
      const { convertToCHF } = await import("../fxHelper");
      const { getDb } = await import("../db");
      const { historicalPrices } = await import("../../drizzle/schema");
      const { inArray, and, gte, lte } = await import("drizzle-orm");

      const db = await getDb();
      if (!db) return { range: input.range, scope: input.scope, points: [] };

      const portfolios = await getSavedPortfolios(ctx.user.id);
      let targetPortfolios = portfolios.filter(p => p.isLive === 1 && p.liveStartDate);
      if (input.scope !== "aggregate") {
        targetPortfolios = targetPortfolios.filter(p => p.id === input.scope);
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
        case 'Max': startDate = new Date('2020-01-01'); break;
      }
      const startDateStr = startDate.toISOString().split('T')[0];

      // Get all tickers from target portfolios
      const allTickers = new Set<string>();
      const txByPortfolio = new Map<number, any[]>();
      for (const p of targetPortfolios) {
        const txs = await getPortfolioTransactions(p.id);
        txByPortfolio.set(p.id, txs);
        txs.forEach((tx: any) => { if (tx.ticker) allTickers.add(tx.ticker); });
      }
      if (allTickers.size === 0) return { range: input.range, scope: input.scope, points: [] };

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
      if (sortedDates.length === 0) return { range: input.range, scope: input.scope, points: [] };

      // Get benchmark data (SMI + MSCI World)
      const smiData = await getBenchmarkData("SMI", startDateStr, todayStr);
      const msciData = await getBenchmarkData("MSCI_WORLD", startDateStr, todayStr);
      const smiMap = new Map(smiData.map(d => [d.date, parseFloat(d.close)]));
      const msciMap = new Map(msciData.map(d => [d.date, parseFloat(d.close)]));

      // Pre-warm FX
      const uniqueCurrencies = new Set<string>();
      for (const s of Array.from(stocksMap.values())) { if ((s as any).currency) uniqueCurrencies.add((s as any).currency); }
      await Promise.all(Array.from(uniqueCurrencies).filter(c => c !== 'CHF').map(c =>
        !getCachedFxRate(c, todayStr) ? convertToCHF(1, c, todayStr).then(r => setCachedFxRate(c, todayStr, r)) : Promise.resolve()
      ));

      // Downsample to max 60 points
      const step = Math.max(1, Math.floor(sortedDates.length / 60));
      const sampledDates = sortedDates.filter((_, i) => i % step === 0 || i === sortedDates.length - 1);

      // Calculate portfolio value for sampled dates
      let startingValue = 0;
      const smiStart = smiMap.get(sampledDates[0]) || smiMap.get(sortedDates[0]) || 0;
      const msciStart = msciMap.get(sampledDates[0]) || msciMap.get(sortedDates[0]) || 0;

      const points: Array<{ label: string; portfolio: number; smi: number; msci: number }> = [];

      for (let i = 0; i < sampledDates.length; i++) {
        const date = sampledDates[i];
        let totalValueCHF = 0;

        for (const portfolio of targetPortfolios) {
          const transactions = txByPortfolio.get(portfolio.id) || [];
          const holdingsMap = new Map<string, number>();
          for (const tx of transactions) {
            const txDate = new Date(tx.transactionDate).toISOString().split('T')[0];
            if (txDate > date) break;
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
            const priceCHF = await convertToCHF(price, currency, date);
            totalValueCHF += shares * priceCHF;
          }
          totalValueCHF += parseFloat(portfolio.cashBalance || '0');
        }

        if (i === 0) startingValue = totalValueCHF;
        const portfolioPerf = startingValue > 0 ? ((totalValueCHF - startingValue) / startingValue) * 100 : 0;

        // Benchmark performance
        let smiPerf = 0;
        let msciPerf = 0;
        const smiVal = smiMap.get(date);
        const msciVal = msciMap.get(date);
        if (smiVal && smiStart > 0) smiPerf = ((smiVal - smiStart) / smiStart) * 100;
        if (msciVal && msciStart > 0) msciPerf = ((msciVal - msciStart) / msciStart) * 100;

        const d = new Date(date);
        const label = d.toLocaleDateString('de-CH', { day: '2-digit', month: 'short' });
        points.push({ label, portfolio: Number(portfolioPerf.toFixed(2)), smi: Number(smiPerf.toFixed(2)), msci: Number(msciPerf.toFixed(2)) });
      }

      return { range: input.range, scope: input.scope, points };
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
      let targetPortfolios = portfolios.filter(p => p.isLive === 1 && p.liveStartDate);
      if (input.scope !== "aggregate") {
        targetPortfolios = targetPortfolios.filter(p => p.id === input.scope);
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const ytdStartDate = getYTDStartDate();

      // Aggregate holdings across portfolios
      const holdingsAgg = new Map<string, number>(); // ticker -> total shares
      let totalCash = 0;

      for (const portfolio of targetPortfolios) {
        const transactions = await getPortfolioTransactions(portfolio.id);
        for (const tx of transactions) {
          const ticker = tx.ticker;
          if (!ticker) continue;
          const shares = parseFloat(tx.shares || '0');
          if (tx.transactionType === 'buy') holdingsAgg.set(ticker, (holdingsAgg.get(ticker) || 0) + shares);
          else if (tx.transactionType === 'sell') holdingsAgg.set(ticker, (holdingsAgg.get(ticker) || 0) - shares);
        }
        totalCash += parseFloat(portfolio.cashBalance || '0');
      }

      // Remove zero/negative holdings
      for (const [t, s] of Array.from(holdingsAgg.entries())) {
        if (s <= 0) holdingsAgg.delete(t);
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
        const currentPrice = parseFloat(stock.currentPrice || '0');
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

        // 1d change from previousClose or ytdPerformance
        const prevClose = parseFloat(stock.week52Low || '0'); // approximate
        const change1d = stock.ytdPerformance ? parseFloat(stock.ytdPerformance) / 252 : 0; // rough daily

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
      let targetPortfolios = portfolios.filter(p => p.isLive === 1 && p.liveStartDate);
      if (input.scope !== "aggregate") {
        targetPortfolios = targetPortfolios.filter(p => p.id === input.scope);
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const ytdStartDate = getYTDStartDate();

      const holdingsAgg = new Map<string, number>();
      let totalCash = 0;

      for (const portfolio of targetPortfolios) {
        const transactions = await getPortfolioTransactions(portfolio.id);
        for (const tx of transactions) {
          const ticker = tx.ticker;
          if (!ticker) continue;
          const shares = parseFloat(tx.shares || '0');
          if (tx.transactionType === 'buy') holdingsAgg.set(ticker, (holdingsAgg.get(ticker) || 0) + shares);
          else if (tx.transactionType === 'sell') holdingsAgg.set(ticker, (holdingsAgg.get(ticker) || 0) - shares);
        }
        totalCash += parseFloat(portfolio.cashBalance || '0');
      }

      for (const [t, s] of Array.from(holdingsAgg.entries())) {
        if (s <= 0) holdingsAgg.delete(t);
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

      // Group by sector
      const sectorData = new Map<string, { value: number; ytdWeighted: number }>();
      let totalValue = 0;

      for (const [ticker, shares] of Array.from(holdingsAgg.entries())) {
        const stock = stocksMap.get(ticker) as any;
        if (!stock) continue;
        const currentPrice = parseFloat(stock.currentPrice || '0');
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
      let targetPortfolios = portfolios.filter(p => p.isLive === 1 && p.liveStartDate);
      if (input.scope !== "aggregate") {
        targetPortfolios = targetPortfolios.filter(p => p.id === input.scope);
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const holdingsAgg = new Map<string, number>();
      let totalCash = 0;

      for (const portfolio of targetPortfolios) {
        const transactions = await getPortfolioTransactions(portfolio.id);
        for (const tx of transactions) {
          const ticker = tx.ticker;
          if (!ticker) continue;
          const shares = parseFloat(tx.shares || '0');
          if (tx.transactionType === 'buy') holdingsAgg.set(ticker, (holdingsAgg.get(ticker) || 0) + shares);
          else if (tx.transactionType === 'sell') holdingsAgg.set(ticker, (holdingsAgg.get(ticker) || 0) - shares);
        }
        totalCash += parseFloat(portfolio.cashBalance || '0');
      }

      for (const [t, s] of Array.from(holdingsAgg.entries())) {
        if (s <= 0) holdingsAgg.delete(t);
      }

      const allTickers = Array.from(holdingsAgg.keys());
      const stocksMap = allTickers.length > 0 ? await batchGetStocks(allTickers) : new Map();

      // Pre-warm FX
      const uniqueCurrencies = new Set<string>();
      for (const s of Array.from(stocksMap.values())) { if ((s as any).currency) uniqueCurrencies.add((s as any).currency); }
      await Promise.all(Array.from(uniqueCurrencies).filter(c => c !== 'CHF').map(c =>
        !getCachedFxRate(c, todayStr) ? convertToCHF(1, c, todayStr).then(r => setCachedFxRate(c, todayStr, r)) : Promise.resolve()
      ));

      const regionData = new Map<string, number>();
      let totalValue = 0;

      for (const [ticker, shares] of Array.from(holdingsAgg.entries())) {
        const stock = stocksMap.get(ticker) as any;
        if (!stock) continue;
        const currentPrice = parseFloat(stock.currentPrice || '0');
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
      const { convertToCHF } = await import("../fxHelper");
      const { getDb } = await import("../db");
      const { historicalPrices } = await import("../../drizzle/schema");
      const { inArray, and, gte, lte } = await import("drizzle-orm");

      const db = await getDb();
      if (!db) return { volatility: 0, volBenchmark: 0, maxDrawdown: 0, drawdownBenchmark: 0, var95: 0, concentrationTop3: 0, sharpeRatio: 0, beta: 0 };

      const portfolios = await getSavedPortfolios(ctx.user.id);
      let targetPortfolios = portfolios.filter(p => p.isLive === 1 && p.liveStartDate);
      if (input.scope !== "aggregate") {
        targetPortfolios = targetPortfolios.filter(p => p.id === input.scope);
      }
      if (targetPortfolios.length === 0) return { volatility: 0, volBenchmark: 0, maxDrawdown: 0, drawdownBenchmark: 0, var95: 0, concentrationTop3: 0, sharpeRatio: 0, beta: 0 };

      // Get 1 year of data for risk calculation
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const startDateStr = oneYearAgo.toISOString().split('T')[0];

      // Get all tickers
      const allTickers = new Set<string>();
      const txByPortfolio = new Map<number, any[]>();
      for (const p of targetPortfolios) {
        const txs = await getPortfolioTransactions(p.id);
        txByPortfolio.set(p.id, txs);
        txs.forEach((tx: any) => { if (tx.ticker) allTickers.add(tx.ticker); });
      }

      if (allTickers.size === 0) return { volatility: 0, volBenchmark: 0, maxDrawdown: 0, drawdownBenchmark: 0, var95: 0, concentrationTop3: 0, sharpeRatio: 0, beta: 0 };

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

      // Calculate daily portfolio values
      const dailyValues: number[] = [];
      for (const date of sortedDates) {
        let totalValueCHF = 0;
        for (const portfolio of targetPortfolios) {
          const transactions = txByPortfolio.get(portfolio.id) || [];
          const holdingsMap = new Map<string, number>();
          for (const tx of transactions) {
            const txDate = new Date(tx.transactionDate).toISOString().split('T')[0];
            if (txDate > date) break;
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

      if (dailyReturns.length < 10) return { volatility: 0, volBenchmark: 0, maxDrawdown: 0, drawdownBenchmark: 0, var95: 0, concentrationTop3: 0, sharpeRatio: 0, beta: 0 };

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

      if (smiData.length > 10) {
        const smiPrices = smiData.map(d => parseFloat(d.close));
        const smiReturns: number[] = [];
        for (let i = 1; i < smiPrices.length; i++) {
          if (smiPrices[i - 1] > 0) smiReturns.push((smiPrices[i] - smiPrices[i - 1]) / smiPrices[i - 1]);
        }

        const smiMean = smiReturns.reduce((s, r) => s + r, 0) / smiReturns.length;
        const smiVariance = smiReturns.reduce((s, r) => s + (r - smiMean) ** 2, 0) / (smiReturns.length - 1);
        volBenchmark = Math.sqrt(smiVariance) * Math.sqrt(252) * 100;

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
        const price = parseFloat(stock.currentPrice || '0');
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
        beta: Number(beta.toFixed(2)),
      };
    }),

  // ──────────────────────────────────────────────────────────────────────
  // LPPL Bubble indicator
  // ──────────────────────────────────────────────────────────────────────
  getBubbleIndicator: protectedProcedure
    .input(z.object({ scope: z.union([z.literal("aggregate"), z.number()]).default("aggregate") }))
    .query(async ({ ctx }) => {
      const { getDb } = await import("../db");
      const { lpplResults } = await import("../../drizzle/schema");
      const { desc, eq } = await import("drizzle-orm");

      const db = await getDb();
      if (!db) return { score: 0, label: "Niedrig" as const, history: [] as number[], interpretation: "Keine Daten verfügbar." };

      // Get latest LPPL result for S&P 500 (most representative)
      const latest = await db.select().from(lpplResults)
        .where(eq(lpplResults.indexSymbol, '^GSPC'))
        .orderBy(desc(lpplResults.checkedAt))
        .limit(1);

      // Get last 8 results for history sparkline
      const history = await db.select().from(lpplResults)
        .where(eq(lpplResults.indexSymbol, '^GSPC'))
        .orderBy(desc(lpplResults.checkedAt))
        .limit(8);

      if (latest.length === 0) {
        return { score: 0, label: "Niedrig" as const, history: [] as number[], interpretation: "Noch kein LPPL-Check durchgeführt. Starte einen Live-Check im Monitoring-Tab." };
      }

      const score = latest[0].bubbleConfidence;
      const label = score < 33 ? "Niedrig" : score < 66 ? "Mittel" : "Hoch";
      const historyScores = history.reverse().map(r => r.bubbleConfidence);

      let interpretation = "";
      if (score < 33) interpretation = "Markt zeigt keine Überhitzung. Strategie kann beibehalten werden.";
      else if (score < 66) interpretation = "Moderate Überhitzungssignale. Risikomanagement überprüfen.";
      else interpretation = "Starke Bubble-Signale erkannt. Defensive Positionierung empfohlen.";

      return { score, label: label as "Niedrig" | "Mittel" | "Hoch", history: historyScores, interpretation };
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
      let targetPortfolios = portfolios.filter(p => p.isLive === 1 && p.liveStartDate);
      if (input.scope !== "aggregate") {
        targetPortfolios = targetPortfolios.filter(p => p.id === input.scope);
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
        const transactions = await getPortfolioTransactions(portfolio.id);
        for (const tx of transactions) {
          const ticker = tx.ticker;
          if (!ticker) continue;
          const shares = parseFloat(tx.shares || '0');
          if (tx.transactionType === 'buy') holdingsAgg.set(ticker, (holdingsAgg.get(ticker) || 0) + shares);
          else if (tx.transactionType === 'sell') holdingsAgg.set(ticker, (holdingsAgg.get(ticker) || 0) - shares);
        }
        totalCash += parseFloat(portfolio.cashBalance || '0');
      }

      for (const [t, s] of Array.from(holdingsAgg.entries())) {
        if (s <= 0) holdingsAgg.delete(t);
      }

      const allTickers = Array.from(holdingsAgg.keys());
      const stocksMap = allTickers.length > 0 ? await batchGetStocks(allTickers) : new Map();

      // Pre-warm FX
      const uniqueCurrencies = new Set<string>();
      for (const s of Array.from(stocksMap.values())) { if ((s as any).currency) uniqueCurrencies.add((s as any).currency); }
      await Promise.all(Array.from(uniqueCurrencies).filter(c => c !== 'CHF').map(c =>
        !getCachedFxRate(c, todayStr) ? convertToCHF(1, c, todayStr).then(r => setCachedFxRate(c, todayStr, r)) : Promise.resolve()
      ));

      // Calculate values and weights
      const holdingData: Array<{ ticker: string; sector: string; value: number; weight: number }> = [];
      let totalValue = 0;

      for (const [ticker, shares] of Array.from(holdingsAgg.entries())) {
        const stock = stocksMap.get(ticker) as any;
        if (!stock) continue;
        const currentPrice = parseFloat(stock.currentPrice || '0');
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

      // Generate insights based on portfolio analysis
      // 1. Concentration check
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

      // 2. Cash position
      const cashWeight = totalValue > 0 ? (totalCash / totalValue) * 100 : 0;
      if (cashWeight > 15) {
        insights.push({
          id: 'high-cash',
          severity: 'info',
          title: `Cash-Quote ${cashWeight.toFixed(0)}%`,
          body: 'Hohe Liquidität — Staffel-Einstieg in defensive Werte möglich.',
          action: 'Vorschläge anzeigen',
          actionHref: '/invest',
        });
      } else if (cashWeight < 5) {
        insights.push({
          id: 'low-cash',
          severity: 'watch',
          title: `Cash-Quote nur ${cashWeight.toFixed(0)}%`,
          body: 'Geringe Liquiditätsreserve. Bei Korrekturen fehlt Handlungsspielraum.',
          action: 'Cash-Strategie prüfen',
        });
      }

      // 3. Sector concentration
      const sectorWeights = new Map<string, number>();
      for (const h of holdingData) {
        sectorWeights.set(h.sector, (sectorWeights.get(h.sector) || 0) + h.weight);
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
          break; // Only one sector warning
        }
      }

      // 4. Positive: portfolio count
      if (targetPortfolios.length >= 2) {
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
});
