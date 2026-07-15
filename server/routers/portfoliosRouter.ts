import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { computeWeightedReturnSeries } from "../lib/weightedReturnSeries";
import { applyCashDrag } from "../lib/cashAdjust";
import { toChfPriceMap as toChfPriceMapCore, deriveStocksValueChf } from "../lib/performanceCore";

// Parse a possibly-string/null DB numeric field to number|undefined for scoring.
function parseNum(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : undefined;
}

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

export const portfoliosRouter = router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getSavedPortfolios, getStockByTicker } = await import("../db");
      const { batchGetPortfolioTransactions, batchGetStocks, batchGetHistoricalPrices } = await import("../db-optimized");
      const { convertToCHF, tryConvertToCHF } = await import("../fxHelper");

      // Step 1: Get all portfolios for user (include snapshots for sidebar access)
      const portfolios = await getSavedPortfolios(ctx.user.id, { includeSnapshots: true });
      const livePortfolios = portfolios.filter(p => p.isLive && p.liveStartDate);

      // U-13: Datenqualität je Position — Kurs fehlt (priceMissing) bzw. kein
      // FX-Kurs auffindbar (fxMissing). Positionen mit fehlenden Daten werden
      // (wie bisher) mit 0 bewertet, aber geflaggt, damit das UI sie ausweisen
      // kann (Client-Badges: Phase 4). Rein additive Felder.
      type HoldingDataQuality = { ticker: string; priceMissing: boolean; fxMissing: boolean };

      // Helper function to calculate portfolio value from portfolioData
      const calculatePortfolioValueFromData = async (portfolio: any): Promise<{ currentValue: number; positionCount: number; livePerformance: number; dataQuality: HoldingDataQuality[] }> => {
        const dataQuality: HoldingDataQuality[] = [];
        try {
          const portfolioData = JSON.parse(portfolio.portfolioData || '{}');
          const stocks = portfolioData.stocks || portfolioData.positions || [];

          if (stocks.length === 0) {
            return { currentValue: 0, positionCount: 0, livePerformance: 0, dataQuality };
          }

          let totalValueCHF = 0;
          const investmentAmount = parseFloat(portfolio.investmentAmount || '0');
          const todayStr = new Date().toISOString().split('T')[0];

          for (const stock of stocks) {
            const ticker = stock.ticker;
            if (!ticker) continue;

            // Get current stock data
            const stockData = await getStockByTicker(ticker);
            if (!stockData) {
              dataQuality.push({ ticker, priceMissing: true, fxMissing: false });
              continue;
            }

            const rawPrice = stockData.currentPrice;
            const currentPrice = (rawPrice && rawPrice !== 'NA') ? parseFloat(rawPrice) : 0;
            if (isNaN(currentPrice) || currentPrice <= 0) {
              dataQuality.push({ ticker, priceMissing: true, fxMissing: false });
              continue;
            }
            const currency = stockData.currency || 'CHF';
            const weight = parseFloat(stock.weight || '0') / 100;

            // Calculate value in CHF (U-13: fehlender FX-Kurs → Wert 0 wie
            // bisher, aber mit fxMissing-Flag statt stillschweigend)
            // Fallback: use exchangeRateToChf from stocks table if exchangeRates table has no entry
            let priceCHFOrNull = await tryConvertToCHF(currentPrice, currency, todayStr);
            if (priceCHFOrNull === null) {
              // Fallback: use stored exchangeRateToChf from stocks table
              const storedFxRate = parseFloat((stockData as any).exchangeRateToChf || '0');
              if (storedFxRate > 0 && currency !== 'CHF') {
                priceCHFOrNull = currentPrice * storedFxRate;
                console.warn(`[portfolios.list] Using stored exchangeRateToChf=${storedFxRate} for ${ticker} (${currency}) — no rate in exchangeRates table`);
              } else if (currency === 'CHF') {
                priceCHFOrNull = currentPrice;
              } else {
                dataQuality.push({ ticker, priceMissing: false, fxMissing: true });
                continue;
              }
            }
            const priceCHF = priceCHFOrNull;

            // Calculate shares:
            // - For demo portfolios: ALWAYS use weight-based calculation to ensure
            //   totalValueCHF = investmentAmount (stored shares may be wrong due to FX issues at creation)
            // - For live portfolios: use stored shares from real transactions
            let shares: number;
            const isDemo = portfolio.portfolioType === 'demo' || !portfolio.portfolioType;
            if (isDemo && investmentAmount > 0 && weight > 0) {
              shares = priceCHF > 0 ? (investmentAmount * weight) / priceCHF : 0;
            } else {
              shares = parseFloat(stock.shares || '0');
              if (shares === 0 && investmentAmount > 0 && weight > 0) {
                shares = priceCHF > 0 ? (investmentAmount * weight) / priceCHF : 0;
              }
            }

            totalValueCHF += shares * priceCHF;
          }

          // Add cash balance if exists
          const cashBalance = parseFloat(portfolio.cashBalance || '0');
          totalValueCHF += cashBalance;

          // Calculate performance
          let performance = 0;
          if (investmentAmount > 0) {
            performance = ((totalValueCHF - investmentAmount) / investmentAmount) * 100;
          }

          return {
            currentValue: totalValueCHF,
            positionCount: stocks.length,
            livePerformance: performance,
            dataQuality
          };
        } catch (error) {
          console.error(`[portfolios.list] Error calculating value from portfolioData for portfolio ${portfolio.id}:`, error);
          return { currentValue: 0, positionCount: 0, livePerformance: 0, dataQuality };
        }
      };
      
      // If no live portfolios, calculate values from portfolioData for all portfolios
      if (livePortfolios.length === 0) {
        const portfoliosWithValues = await Promise.all(
          portfolios.map(async (portfolio) => {
            const values = await calculatePortfolioValueFromData(portfolio);
            return { ...portfolio, ...values };
          })
        );
        return portfoliosWithValues;
      }
      
      // Step 2: Batch load ALL transactions for ALL portfolios in ONE query
      const portfolioIds = livePortfolios.map(p => p.id);
      const transactionsByPortfolio = await batchGetPortfolioTransactions(portfolioIds);
      
      // Step 3: Collect all unique tickers (from live portfolio transactions AND demo portfolio data)
      const allTickers = new Set<string>();
      for (const transactions of Array.from(transactionsByPortfolio.values())) {
        transactions.forEach(tx => {
          if (tx.ticker) allTickers.add(tx.ticker);
        });
      }
      // Also collect tickers from demo portfolios
      const demoPortfolios = portfolios.filter(p => !p.isLive || !p.liveStartDate);
      for (const portfolio of demoPortfolios) {
        try {
          const pd = JSON.parse(portfolio.portfolioData || '{}');
          const stocks = pd.stocks || pd.positions || [];
          stocks.forEach((s: any) => { if (s.ticker) allTickers.add(s.ticker); });
        } catch {}
      }
      
      if (allTickers.size === 0) {
        return portfolios;
      }
      
      // Step 4: Batch load ALL stocks in ONE query
      const stocksMap = await batchGetStocks(Array.from(allTickers));
      
      // Step 5: Batch load ALL historical prices in ONE query
      const ytdStartDate = getYTDStartDate();
      const todayStr = new Date().toISOString().split('T')[0];
      const ytdPricesMap = await batchGetHistoricalPrices(Array.from(allTickers), ytdStartDate);
      
      // Step 6: Pre-fetch FX rates for all unique currencies
      const uniqueCurrencies = new Set<string>();
      for (const stock of Array.from(stocksMap.values())) {
        if (stock.currency) uniqueCurrencies.add(stock.currency);
      }
      
      // Pre-warm FX cache (fxHelper caches in-memory; the first call bulk-loads
      // the exchangeRates table — D-02)
      const fxPromises = [];
      for (const currency of Array.from(uniqueCurrencies)) {
        if (currency !== 'CHF') {
          fxPromises.push(convertToCHF(1, currency, todayStr));
          fxPromises.push(convertToCHF(1, currency, ytdStartDate));
        }
      }

      // Wait for all FX rates to be cached
      await Promise.all(fxPromises);
      
      // Step 7: Calculate current value for each portfolio using portfolioData
      // This ensures consistency with the detail page (getWithCurrency)
      const portfoliosWithValues = await Promise.all(
        portfolios.map(async (portfolio) => {
          try {
            // Calculate current value from portfolioData (same as detail page)
            const values = await calculatePortfolioValueFromData(portfolio);
            
            // For live portfolios, also calculate YTD performance from historical prices
            if (portfolio.isLive && portfolio.liveStartDate) {
              const transactions = transactionsByPortfolio.get(portfolio.id) || [];
              
              // Calculate holdings from transactions for YTD performance
              const holdings: Record<string, number> = {};
              transactions.forEach(tx => {
                const shares = parseFloat(tx.shares || '0');
                const ticker = tx.ticker;
                if (!ticker) return;
                if (tx.transactionType === 'buy') {
                  holdings[ticker] = (holdings[ticker] || 0) + shares;
                } else if (tx.transactionType === 'sell') {
                  holdings[ticker] = (holdings[ticker] || 0) - shares;
                }
              });
              
              // Calculate YTD performance
              let ytdStartValueCHF = 0;
              let currentValueForPerf = 0;
              let hasHistoricalData = false;
              
              for (const [ticker, shares] of Object.entries(holdings)) {
                if (shares <= 0) continue;
                const stock = stocksMap.get(ticker);
                if (!stock) continue;
                
                const currency = stock.currency || 'CHF';
                const currentPrice = safeParseFloat(stock.currentPrice);
                const ytdStartPrice = ytdPricesMap.get(ticker);
                
                if (ytdStartPrice) {
                  hasHistoricalData = true;
                  const currentPriceCHF = await convertToCHF(currentPrice, currency, todayStr);
                  const ytdStartPriceCHF = await convertToCHF(ytdStartPrice, currency, ytdStartDate);
                  currentValueForPerf += shares * currentPriceCHF;
                  ytdStartValueCHF += shares * ytdStartPriceCHF;
                }
              }
              
              let performancePercent = 0;
              if (hasHistoricalData && ytdStartValueCHF > 0) {
                performancePercent = ((currentValueForPerf - ytdStartValueCHF) / ytdStartValueCHF) * 100;
              }
              
              return { ...portfolio, ...values, livePerformance: performancePercent };
            }
            
            // For demo portfolios, also calculate YTD performance from historical prices
            const pd = JSON.parse(portfolio.portfolioData || '{}');
            const stocks = pd.stocks || pd.positions || [];
            const investmentAmount = parseFloat(portfolio.investmentAmount || '0');
            
            let ytdStartValueCHF = 0;
            let currentValueForPerf = 0;
            let hasHistoricalData = false;
            
            for (const stock of stocks) {
              const ticker = stock.ticker;
              if (!ticker) continue;
              const stockData = stocksMap.get(ticker) as any;
              if (!stockData) continue;
              const currentPrice = safeParseFloat(stockData.currentPrice);
              const currency = stockData.currency || 'CHF';
              const weight = parseFloat(stock.weight || '0') / 100;
              const ytdStartPrice = ytdPricesMap.get(ticker);
              
              let shares = parseFloat(stock.shares || '0');
              if (shares === 0 && weight > 0) {
                if (ytdStartPrice) {
                  const ytdPriceCHF = await convertToCHF(ytdStartPrice, currency, ytdStartDate);
                  const allocationCHF = investmentAmount > 0 ? investmentAmount * weight : 100000 * weight;
                  shares = ytdPriceCHF > 0 ? allocationCHF / ytdPriceCHF : 0;
                } else if (investmentAmount > 0) {
                  const priceCHF = await convertToCHF(currentPrice, currency, todayStr);
                  shares = priceCHF > 0 ? (investmentAmount * weight) / priceCHF : 0;
                }
              }
              
              if (ytdStartPrice && shares > 0) {
                hasHistoricalData = true;
                const currentPriceCHF = await convertToCHF(currentPrice, currency, todayStr);
                const ytdStartPriceCHF = await convertToCHF(ytdStartPrice, currency, ytdStartDate);
                currentValueForPerf += shares * currentPriceCHF;
                ytdStartValueCHF += shares * ytdStartPriceCHF;
              }
            }
            
            let demoYtdPerf = values.livePerformance; // fallback to total return
            if (hasHistoricalData && ytdStartValueCHF > 0) {
              demoYtdPerf = ((currentValueForPerf - ytdStartValueCHF) / ytdStartValueCHF) * 100;
            }
            
            return { ...portfolio, ...values, livePerformance: demoYtdPerf };
          } catch (error) {
            console.error(`Error calculating values for portfolio ${portfolio.id}:`, error);
            return portfolio;
          }
        })
      );
      
      return portfoliosWithValues;
    }),

    get: protectedProcedure
      .input(z.number().int().positive())
      .query(async ({ input, ctx }) => {
        const { getSavedPortfolioById } = await import("../db");
        const result = await getSavedPortfolioById(input, ctx.user.id);
        console.log('[portfolios.get] result:', result ? 'found' : 'not found');
        return result;
      }),

    // Get portfolio with currency conversion data
    getWithCurrency: protectedProcedure
      .input(z.number().int().positive())
      .query(async ({ input, ctx }) => {
        // PERF: Check Redis cache first (2-minute TTL) to avoid recomputing on every page visit
        try {
          const { cacheGet } = await import('../redisClient');
          const cached = await cacheGet<any>(`portfolio:detail:${input}:${ctx.user.id}`);
          if (cached) return cached;
        } catch { /* non-critical — fall through to compute */ }

        const { getSavedPortfolioById, getStockByTicker, getStocksByTickers, getPortfolioTransactions } = await import("../db");
        const { getStockCurrency, tryConvertToCHF, getHistoricalPrice } = await import("../fxHelper");
        const { calculateStockScore } = await import("../scoring");

        const portfolio = await getSavedPortfolioById(input, ctx.user.id);
        if (!portfolio) return null;

        // Get earliest buy/entry transaction date for display
        let earliestBuyDate: Date | null = null;
        // Per-ticker maps for price vs FX return breakdown
        // avgBuyPriceLocalMap: weighted avg purchase price in local currency
        // avgFxRateAtPurchaseMap: weighted avg FX rate at purchase time
        const avgBuyPriceLocalMap = new Map<string, number>();
        const avgFxRateAtPurchaseMap = new Map<string, number>();
        try {
          const transactions = await getPortfolioTransactions(input);
          const buyTxs = transactions.filter((t: any) => t.transactionType === 'buy' || t.transactionType === 'entry');
          if (buyTxs.length > 0) {
            buyTxs.sort((a: any, b: any) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime());
            earliestBuyDate = new Date(buyTxs[0].transactionDate);
            // Build per-ticker weighted average buy price (local currency) and FX rate
            const byTicker = new Map<string, { totalShares: number; totalCostLocal: number; totalCostCHF: number }>();
            for (const tx of buyTxs) {
              const tk = tx.ticker;
              const qty = parseFloat(tx.shares) || 0;
              const priceLocal = parseFloat(tx.pricePerShare) || 0;
              const fxAtPurchase = parseFloat(tx.fxRate) || 1;
              if (!tk || qty <= 0 || priceLocal <= 0) continue;
              const existing = byTicker.get(tk) || { totalShares: 0, totalCostLocal: 0, totalCostCHF: 0 };
              existing.totalShares += qty;
              existing.totalCostLocal += qty * priceLocal;
              existing.totalCostCHF += qty * priceLocal * fxAtPurchase;
              byTicker.set(tk, existing);
            }
            for (const [tk, data] of byTicker.entries()) {
              if (data.totalShares > 0) {
                avgBuyPriceLocalMap.set(tk, data.totalCostLocal / data.totalShares);
                // Implied avg FX rate at purchase = totalCostCHF / totalCostLocal
                avgFxRateAtPurchaseMap.set(tk, data.totalCostLocal > 0 ? data.totalCostCHF / data.totalCostLocal : 1);
              }
            }
          }
        } catch (e) {
          // ignore — not critical
        }
        
        // Parse portfolio data
        let portfolioData: { stocks: any[] } = { stocks: [] };
        try {
          portfolioData = JSON.parse(portfolio.portfolioData || '{}');
        } catch (e) {
          console.error('[getWithCurrency] Failed to parse portfolio data:', e);
        }
        
        const todayStr = new Date().toISOString().split('T')[0];
        
        // Filter out CASH ticker from portfolioData (cash is tracked separately in cashBalance field)
        const stocksWithoutCash = (portfolioData.stocks || []).filter((s: any) => s.ticker !== 'CASH');
        
        // PERF: Batch-fetch all stocks in a single DB query instead of N+1 individual queries
        const allTickers = stocksWithoutCash.map((s: any) => s.ticker);
        const dbStockMap = await getStocksByTickers(allTickers);
        
        // Enrich stocks with currency and FX data
        const enrichedStocks = await Promise.all(
          stocksWithoutCash.map(async (stock: any) => {
            const ticker = stock.ticker;
            const dbStock = dbStockMap.get(ticker) || await getStockByTicker(ticker); // fallback for alias resolution
            const currency = dbStock?.currency || await getStockCurrency(ticker);
            // Single source of truth: DB price + convertToCHF — identical to
            // portfolios.list and dashboard.getAggregatedMetrics so the WERT
            // matches across list, detail and dashboard.
            const currentPrice = safeParseFloat(dbStock?.currentPrice || stock.currentPrice);
            // U-13: fehlender Kurs/FX-Kurs → Wert 0 (wie bisher), aber mit
            // Datenqualitäts-Flags, damit das UI die Position ausweisen kann.
            const priceMissing = !(currentPrice > 0);
            let priceCHF = currentPrice;
            let fxMissing = false;
            if (currency !== 'CHF') {
              const converted = await tryConvertToCHF(currentPrice, currency, todayStr);
              if (converted === null) {
                fxMissing = true;
                priceCHF = 0;
              } else {
                priceCHF = converted;
              }
            }
            const fxRate = currentPrice > 0 ? priceCHF / currentPrice : 1;
            
            // Calculate weight - for test portfolios, use equal weight if not specified
            const stockCount = portfolioData.stocks?.length || 1;
            const defaultWeight = 100 / stockCount;
            const rawWeight = stock.portfolioWeight || stock.weight || defaultWeight;
            // Ensure weight is a number before calling toFixed
            const weight = typeof rawWeight === 'number' ? rawWeight : parseFloat(String(rawWeight)) || defaultWeight;
            
            // Calculate shares:
            // - For ALL portfolios: prefer stored shares (from portfolioData.stocks[].shares)
            //   These are the actual share counts and reflect real market value when multiplied by current price.
            // - Fallback to weight-based calculation ONLY when shares are 0/missing
            //   (e.g., old portfolios created before shares were stored)
            // NOTE: Previously demo portfolios always used weight-based calc, which always returned
            // investmentAmount as total value (ignoring price changes). This caused the Dashboard vs
            // Portfolio Detail discrepancy (Dashboard used stored shares, Detail used weight-based).
            let shares = parseFloat(stock.shares) || 0;
            if (shares === 0 && portfolio.investmentAmount && priceCHF > 0) {
              const investmentAmount = parseFloat(portfolio.investmentAmount) || 0;
              const allocationAmount = investmentAmount * (weight / 100);
              // allocationAmount is in CHF, priceCHF is in CHF → shares = allocationAmount / priceCHF
              shares = allocationAmount / priceCHF;
              // Don't round - keep decimal precision for accurate value calculation
            }
            
            // Calculate avgBuyPrice in CHF.
            //
            // STANDARDIZED STORAGE (since fix R-CHF-PRICE):
            // avgBuyPrice is ALWAYS stored as CHF per share in portfolioData.
            // - PortfolioBuilderWizard: stores priceCHF directly
            // - portfolios.create (live): stores actualInvestedCHF / shares
            // - toggleLive: entry transactions use priceCHF
            //
            // LEGACY FALLBACK for portfolios created before R-CHF-PRICE:
            // If avgBuyPriceCHF field is present, use it directly (explicit CHF marker).
            // Otherwise fall back to the old heuristic (FX conversion for live/foreign).
            //
            // Detection: stock.avgBuyPriceCHF is set by the new code path.
            // If it's missing, assume legacy and apply old conversion logic.
            const storedAvgBuyPrice = parseFloat(stock.avgBuyPrice) || 0;
            const storedAvgBuyPriceCHF = parseFloat(stock.avgBuyPriceCHF) || 0;
            let avgBuyPriceCHF: number;
            if (storedAvgBuyPriceCHF > 0) {
              // New path: avgBuyPriceCHF is explicitly stored as CHF — use directly
              avgBuyPriceCHF = storedAvgBuyPriceCHF;
            } else if (storedAvgBuyPrice > 0) {
              // Legacy path: apply old heuristic for backward compatibility
              const isDemo = portfolio.portfolioType === 'demo' || !portfolio.portfolioType;
              if (currency === 'CHF' || isDemo) {
                // CHF stocks or demo portfolios: avgBuyPrice was stored as CHF
                avgBuyPriceCHF = storedAvgBuyPrice;
              } else {
                // Legacy live portfolios with foreign currency: avgBuyPrice was in local currency
                avgBuyPriceCHF = storedAvgBuyPrice * fxRate;
              }
            } else {
              // No avgBuyPrice stored → try transaction-derived price first
              const txAvgLocal = avgBuyPriceLocalMap.get(ticker);
              const txFxRate = avgFxRateAtPurchaseMap.get(ticker);
              if (txAvgLocal && txAvgLocal > 0) {
                // Use transaction-derived local price × FX rate at purchase for CHF value
                avgBuyPriceCHF = txAvgLocal * (txFxRate ?? fxRate);
              } else {
                // Absolute fallback: use current CHF price (0% performance)
                avgBuyPriceCHF = priceCHF;
              }
            }
            // Keep backward-compat field name (used by client)
            const avgBuyPrice = avgBuyPriceCHF;
            
            // Calculate totalValue
            const totalValue = shares * priceCHF;
            
            return {
              ...stock,
              currency,
              fxRate,
              currentPrice,
              currentPriceLocal: currentPrice,
              priceCHF,
              currentPriceCHF: priceCHF,
              // U-13: Datenqualitäts-Flags (additiv, Client-Badges Phase 4)
              priceMissing,
              fxMissing,
              weight: parseFloat(weight.toFixed(2)),
              shares: shares.toFixed(2),
              avgBuyPrice: avgBuyPrice.toFixed(2),
              totalValue: totalValue.toFixed(2),
              valueCHF: totalValue,
              // Add missing fields from database
              sector: dbStock?.sector || stock.sector || 'Other',
              // Dynamic YTD fallback: if DB field is missing/zero, compute from historicalPrices
              ytdPerformance: await (async () => {
                const stored = dbStock?.ytdPerformance || stock.ytdPerformance;
                if (stored && stored !== '0' && stored !== '0.00') return stored;
                // Fallback: compute from historical price on Jan 1
                try {
                  const ytdStart = `${new Date().getFullYear()}-01-01`;
                  const ytdStartPrice = await getHistoricalPrice(ticker, ytdStart);
                  if (ytdStartPrice && ytdStartPrice > 0 && currentPrice > 0) {
                    const ytdPct = ((currentPrice - ytdStartPrice) / ytdStartPrice) * 100;
                    return ytdPct.toFixed(2);
                  }
                } catch { /* non-critical */ }
                return stored || '0';
              })(),
              // totalReturn = performance since purchase (Seit Kauf)
              // IMPORTANT: Compare priceCHF (current CHF price) vs avgBuyPriceCHF (purchase CHF price)
              // Using currentPrice (local currency) vs avgBuyPrice (CHF) caused massive FX distortion
              // e.g. DGE.L: currentPrice=1547 GBp vs avgBuyPrice=270 CHF → +472% (WRONG!)
              // Correct: priceCHF=19.83 CHF vs avgBuyPriceCHF=19.50 CHF → +1.7% (RIGHT)
              totalReturn: (avgBuyPriceCHF > 0 && priceCHF > 0)
                ? (((priceCHF - avgBuyPriceCHF) / avgBuyPriceCHF) * 100).toFixed(4)
                : '0',
              // FX breakdown: price gain (local currency) vs FX gain (exchange rate effect)
              // For CHF positions, both values equal totalReturn (no FX effect).
              // For foreign currency positions:
              //   priceReturnPct = pure stock price movement in local currency
              //   fxReturnPct    = exchange rate effect (totalReturn - priceReturnPct)
              // Data source priority: transaction-derived avgBuyPriceLocal > demo portfolio approximation
              ...(() => {
                if (currency === 'CHF') {
                  // No FX effect for CHF positions
                  const tr = (avgBuyPriceCHF > 0 && priceCHF > 0)
                    ? ((priceCHF - avgBuyPriceCHF) / avgBuyPriceCHF) * 100 : 0;
                  return { priceReturnPct: tr.toFixed(4), fxReturnPct: '0', avgBuyPriceLocal: avgBuyPriceCHF.toFixed(4) };
                }
                const totalReturnNum = (avgBuyPriceCHF > 0 && priceCHF > 0)
                  ? ((priceCHF - avgBuyPriceCHF) / avgBuyPriceCHF) * 100 : 0;
                // Use transaction-derived local price if available, otherwise approximate
                const txAvgLocal = avgBuyPriceLocalMap.get(ticker);
                const buyPriceLocal = txAvgLocal && txAvgLocal > 0
                  ? txAvgLocal
                  : (avgBuyPriceCHF > 0 && fxRate > 0 ? avgBuyPriceCHF / fxRate : 0);
                const priceReturnNum = (buyPriceLocal > 0 && currentPrice > 0)
                  ? ((currentPrice - buyPriceLocal) / buyPriceLocal) * 100 : 0;
                const fxReturnNum = totalReturnNum - priceReturnNum;
                return {
                  priceReturnPct: priceReturnNum.toFixed(4),
                  fxReturnPct: fxReturnNum.toFixed(4),
                  avgBuyPriceLocal: buyPriceLocal.toFixed(4),
                };
              })(),
              dividendYield: dbStock?.dividendYield || stock.dividendYield || '0',
              companyName: dbStock?.companyName || stock.companyName || ticker,
              category: dbStock?.category || stock.category || 'Aktien',
              // Fundamentals + composite score — drive the Konstellation view.
              // marketCap is stored in CHF billions (see stocksRouter.refreshStock).
              peRatio: dbStock?.peRatio ?? stock.peRatio ?? null,
              pegRatio: dbStock?.pegRatio ?? stock.pegRatio ?? null,
              marketCap: dbStock?.marketCap ?? stock.marketCap ?? null,
              beta: dbStock?.beta ?? stock.beta ?? null,
              volatility: dbStock?.volatility ?? stock.volatility ?? null,
              sharpeRatio: dbStock?.sharpeRatio ?? stock.sharpeRatio ?? null,
              qualityScore: calculateStockScore(ticker, {
                dividendYield: parseNum(dbStock?.dividendYield),
                peRatio: parseNum(dbStock?.peRatio),
                pegRatio: parseNum(dbStock?.pegRatio),
                beta: parseNum(dbStock?.beta),
                volatility: parseNum(dbStock?.volatility),
                sharpeRatio: parseNum(dbStock?.sharpeRatio),
                ytdPerformance: parseNum(dbStock?.ytdPerformance ?? stock.ytdPerformance),
              }, undefined, dbStock?.category).totalScore,
            };
          })
        );
        
        // Calculate total value and weighted avg dividend yield
        let totalValueCHF = 0;
        enrichedStocks.forEach((stock: any) => {
          const shares = parseFloat(stock.shares) || 0;
          const priceCHF = stock.priceCHF || 0;
          totalValueCHF += shares * priceCHF;
        });
        // Weighted dividend yield: sum(weight_i × dividendYield_i) where weight_i = stockValue_i / totalStocksValue
        let weightedDividendYield = 0;
        if (totalValueCHF > 0) {
          enrichedStocks.forEach((stock: any) => {
            const shares = parseFloat(stock.shares) || 0;
            const priceCHF = stock.priceCHF || 0;
            const stockValue = shares * priceCHF;
            const weight = stockValue / totalValueCHF;
            weightedDividendYield += weight * (parseFloat(stock.dividendYield) || 0);
          });
        }
        const avgDividendYield = weightedDividendYield;
        
        // Add cash position if cashBalance exists
        const finalEnrichedStocks = [...enrichedStocks];
        
        // Fix Decimal/Number type issue: explicitly convert cashBalance to number
        const cashBalance = portfolio.cashBalance == null
          ? 0
          : typeof portfolio.cashBalance === 'number'
            ? portfolio.cashBalance
            : Number(portfolio.cashBalance); // Decimal/String -> number
        
        // Add cash to total value BEFORE calculating weights
        totalValueCHF += cashBalance;
        
        // Calculate weight for each stock position
        enrichedStocks.forEach((stock: any) => {
          const stockValue = parseFloat(stock.shares || 0) * (stock.priceCHF || 0);
          stock.weight = totalValueCHF > 0 ? (stockValue / totalValueCHF) * 100 : 0;
        });
        
        // Note: Cash position is displayed separately in the UI via portfolio.cashBalance
        // Do NOT add CASH to finalEnrichedStocks to avoid duplicate display
        
        // Calculate performance for demo portfolios (without transactions)
        let performancePercent = 0;
        let performanceAbsolute = 0;
        if (portfolio.portfolioType === 'demo' && portfolio.investmentAmount) {
          const investmentAmount = parseFloat(portfolio.investmentAmount);
          if (investmentAmount > 0) {
            performanceAbsolute = totalValueCHF - investmentAmount;
            performancePercent = (performanceAbsolute / investmentAmount) * 100;
          }
        }
        
        const result = {
          ...portfolio,
          portfolioData: JSON.stringify({ ...portfolioData, stocks: finalEnrichedStocks }),
          enrichedStocks: finalEnrichedStocks,
          totalValueCHF: Number(totalValueCHF), // Ensure it's a primitive number, not Decimal
          avgDividendYield: Number(avgDividendYield),
          performancePercent: Number(performancePercent.toFixed(2)),
          performanceAbsolute: Number(performanceAbsolute.toFixed(2)),
          earliestBuyDate: earliestBuyDate?.toISOString() ?? null,
          _debug: {
            originalStockCount: portfolioData.stocks?.length || 0,
            filteredStockCount: stocksWithoutCash.length,
            enrichedStockCount: enrichedStocks.length,
            finalEnrichedStockCount: finalEnrichedStocks.length,
            cashBalance,
            stocksValue: totalValueCHF - cashBalance,
            totalWithCash: totalValueCHF,
            performancePercent,
            performanceAbsolute,
          },
        };
        
        // PERF: Cache result in Redis for 2 minutes to avoid recomputing on every page visit
        try {
          const { cacheSet } = await import('../redisClient');
          await cacheSet(`portfolio:detail:${input}:${ctx.user.id}`, result, 120);
        } catch { /* non-critical */ }
        
        return result;
      }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          portfolioData: z.string(),
          investmentAmount: z.coerce.number().positive(),
          portfolioType: z.enum(["demo", "live"]).default("demo"),
          isAiOptimized: z.boolean().optional().default(false),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const debugId = crypto.randomUUID();
        console.log(`[portfolios.create ${debugId}] Starting...`);
        console.log(`[portfolios.create ${debugId}] ctx.user:`, ctx.user);
        
        // HARD AUTH GUARD: No fallback, fail-fast on missing user
        if (!ctx.user || !ctx.user.id || ctx.user.id === 1) {
          console.error(`[portfolios.create ${debugId}] AUTH GUARD FAILED:`, {
            hasUser: !!ctx.user,
            userId: ctx.user?.id,
            userIdType: typeof ctx.user?.id,
          });
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: `Authentication required: ctx.user.id is missing or invalid (debugId=${debugId})`,
          });
        }
        
        console.log(`[portfolios.create ${debugId}] Auth OK - userId:`, ctx.user.id, 'type:', typeof ctx.user.id);
        console.log(`[portfolios.create ${debugId}] Input received (name: ${input?.name ?? 'n/a'})`);
        
        try {
          const { getDb } = await import("../db");
          const { savedPortfolios } = await import("../../drizzle/schema");
          const { sql, eq } = await import("drizzle-orm");
          
          const db = await getDb();
          if (!db) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Database connection not available (debugId=${debugId})`,
            });
          }
          
          // 1) DB Ping Test
          console.log(`[portfolios.create ${debugId}] DB Ping...`);
          await db.execute(sql`SELECT 1`);
          console.log(`[portfolios.create ${debugId}] DB Ping OK`);
          
          // 2) Insert portfolio
          const userId = ctx.user.id;
          console.log(`[portfolios.create ${debugId}] Using userId for insert:`, userId, 'type:', typeof userId);
          
          const portfolioData = {
            userId: userId,
            name: input.name,
            description: input.description || null,
            portfolioData: input.portfolioData,
            investmentAmount: String(input.investmentAmount),
            portfolioType: input.portfolioType,
            isLive: input.portfolioType === "live" ? 1 : 0,
            liveStartDate: input.portfolioType === "live" ? new Date() : null,
            isAiOptimized: input.isAiOptimized ? 1 : 0,
          };
                 console.log(`[portfolios.create ${debugId}] Inserting portfolio...`);
          await db.insert(savedPortfolios).values(portfolioData);
          console.log(`[portfolios.create ${debugId}] Insert OK`);
          // 3) Get the last inserted ID using MySQL's LAST_INSERT_ID()
          console.log(`[portfolios.create ${debugId}] Getting LAST_INSERT_ID...`);
          const lastIdResult = await db.execute(sql`SELECT LAST_INSERT_ID() as id`);
          console.log(`[portfolios.create ${debugId}] LAST_INSERT_ID result:`, JSON.stringify(lastIdResult[0], null, 2));
          const lastId = (lastIdResult as any)[0]?.[0]?.id;
          console.log(`[portfolios.create ${debugId}] Extracted lastId:`, lastId);
          
          if (!lastId) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Failed to get LAST_INSERT_ID (debugId=${debugId})`,
            });
          }
          
          // 4) Fetch the inserted portfolio using the ID
          const inserted = await db
            .select()
            .from(savedPortfolios)
            .where(eq(savedPortfolios.id, Number(lastId)))
            .limit(1);
          
          if (!inserted || inserted.length === 0) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Failed to fetch inserted portfolio (debugId=${debugId})`,
            });
          }
          
          console.log(`[portfolios.create ${debugId}] Returning portfolio:`, inserted[0].id);
          
          // 5) Calculate and store cash balance for all portfolios
          if (input.portfolioData && input.investmentAmount) {
            console.log(`[portfolios.create ${debugId}] Calculating cash balance...`);
            try {
              const portfolioData = JSON.parse(input.portfolioData);
              const holdings = portfolioData.stocks || [];
              const capitalNum = parseFloat(String(input.investmentAmount));
              
              // Check if user specified a cash percentage
              const cashPercentage = parseFloat(portfolioData.cashPercentage || "0");
              
              // Calculate cash position based on user's preference
              let cashPosition = 0;
              if (cashPercentage > 0) {
                // User explicitly set a cash reserve percentage
                cashPosition = capitalNum * (cashPercentage / 100);
                console.log(`[portfolios.create ${debugId}] User requested ${cashPercentage}% cash reserve: CHF ${cashPosition.toFixed(2)}`);
              } else {
                // Legacy behavior: calculate based on actual weights
                let totalInvestedCHF = 0;
                for (const holding of holdings) {
                  const weight = parseFloat(holding.weight || "0") / 100;
                  const allocationAmount = capitalNum * weight;
                  totalInvestedCHF += allocationAmount;
                }
                cashPosition = capitalNum - totalInvestedCHF;
                console.log(`[portfolios.create ${debugId}] Legacy calculation - Total invested: CHF ${totalInvestedCHF.toFixed(2)}, Cash position: CHF ${cashPosition.toFixed(2)}`);
              }
              
              // Update portfolio with cash balance
              const { updateSavedPortfolio } = await import("../db");
              await updateSavedPortfolio(inserted[0].id, userId, {
                cashBalance: cashPosition.toFixed(2)
              });
              console.log(`[portfolios.create ${debugId}] Updated portfolio with cash balance: CHF ${cashPosition.toFixed(2)}`);
              
              // If it's a live portfolio, also create transactions
              if (input.portfolioType === "live") {
                console.log(`[portfolios.create ${debugId}] Creating initial transactions for live portfolio...`);
                const { createPortfolioTransaction } = await import("../db");
                
                // 1) Create deposit transaction
                await createPortfolioTransaction({
                  portfolioId: inserted[0].id,
                  transactionType: "deposit",
                  ticker: null,
                  shares: "0",
                  pricePerShare: "0",
                  currency: "CHF",
                  totalAmount: capitalNum.toFixed(2),
                  fxRate: "1.0",
                  totalAmountCHF: capitalNum.toFixed(2),
                  fees: "0",
                  notes: `Initial deposit`,
                  transactionDate: new Date(),
                });
                console.log(`[portfolios.create ${debugId}] Created deposit transaction: CHF ${capitalNum}`);
                
                // 2) Create buy transactions for each holding and collect updated holdings with shares
                const updatedHoldings: any[] = [];
                for (const holding of holdings) {
                  console.log(`[portfolios.create ${debugId}] Processing holding:`, JSON.stringify({
                    ticker: holding.ticker,
                    currency: holding.currency,
                    exchangeRateToChf: holding.exchangeRateToChf,
                    currentPrice: holding.currentPrice,
                    weight: holding.weight
                  }));
                  const weight = parseFloat(holding.weight || "0") / 100;
                  const allocationAmountCHF = capitalNum * weight;
                  const currentPrice = parseFloat(holding.currentPrice || "0");
                  const currency = holding.currency || "CHF";
                  
                  // Get FX rate - use provided rate, or fetch from exchangeRates table if not available
                  let fxRate = parseFloat(holding.exchangeRateToChf || "1.0");
                  if (currency !== "CHF" && (fxRate === 1 || !holding.exchangeRateToChf)) {
                    // Fetch current FX rate from exchangeRates table
                    const { getCurrentFxRate } = await import('../fxHelper');
                    const currencyPair = `${currency}CHF`;
                    const currentFxRate = await getCurrentFxRate(currencyPair);
                    // exchangeRates stores rate as "1 USD = X CHF", but we need "1 CHF = X USD"
                    // So we need to invert: if USDCHF = 0.80, then 1 CHF = 1/0.80 = 1.25 USD
                    if (currentFxRate > 0 && currentFxRate !== 1) {
                      fxRate = 1 / currentFxRate;
                      console.log(`[portfolios.create] Fetched FX rate for ${currency}: ${currencyPair}=${currentFxRate}, inverted=${fxRate}`);
                    }
                  }
                  
                  if (currentPrice > 0) {
                    // exchangeRateToChf is stored as "1 CHF = X foreign currency"
                    // e.g., for USD: fxRate = 1.26 means 1 CHF = 1.26 USD
                    // To convert CHF to foreign currency: multiply by fxRate
                    // To convert foreign currency to CHF: divide by fxRate
                    
                    let allocationInLocalCurrency: number;
                    let actualInvestedCHF: number;
                    
                    if (currency === "CHF" || fxRate === 1) {
                      // CHF stocks: no conversion needed
                      allocationInLocalCurrency = allocationAmountCHF;
                      actualInvestedCHF = allocationAmountCHF;
                    } else {
                      // Foreign currency stocks: convert CHF to local currency
                      // CHF * fxRate = foreign currency amount
                      allocationInLocalCurrency = allocationAmountCHF * fxRate;
                    }
                    
                    const shares = (allocationInLocalCurrency / currentPrice).toFixed(6);
                    const actualInvestedInCurrency = parseFloat(shares) * currentPrice;
                    
                    if (currency === "CHF" || fxRate === 1) {
                      actualInvestedCHF = actualInvestedInCurrency;
                    } else {
                      // Convert back to CHF: foreign currency / fxRate = CHF
                      actualInvestedCHF = actualInvestedInCurrency / fxRate;
                    }
                    
                    await createPortfolioTransaction({
                      portfolioId: inserted[0].id,
                      transactionType: "buy",
                      ticker: holding.ticker,
                      shares,
                      pricePerShare: holding.currentPrice,
                      currency: holding.currency || "CHF",
                      totalAmount: actualInvestedInCurrency.toFixed(2),
                      fxRate: holding.exchangeRateToChf || "1.0",
                      totalAmountCHF: actualInvestedCHF.toFixed(2),
                      fees: "0",
                      notes: `Initial purchase`,
                      transactionDate: new Date(),
                    });
                    
                    // Store the updated holding with calculated shares.
                    // avgBuyPrice is ALWAYS stored in CHF (not local currency) so the
                    // portfoliosRouter.detail can use it directly without FX conversion.
                    // avgBuyPriceCHF = totalInvestedCHF / sharesCount
                    const avgBuyPriceCHF_creation = parseFloat(shares) > 0
                      ? actualInvestedCHF / parseFloat(shares)
                      : 0;
                    updatedHoldings.push({
                      ...holding,
                      shares: shares,
                      avgBuyPrice: avgBuyPriceCHF_creation.toFixed(4), // CHF per share
                      avgBuyPriceCHF: avgBuyPriceCHF_creation.toFixed(4), // explicit CHF field
                    });
                  } else {
                    // Keep original holding if no price
                    updatedHoldings.push(holding);
                  }
                }
                console.log(`[portfolios.create ${debugId}] Created ${holdings.length} buy transactions`);
                
                // 3) Update portfolioData with the calculated shares
                if (updatedHoldings.length > 0) {
                  const updatedPortfolioData = {
                    ...portfolioData,
                    stocks: updatedHoldings,
                  };
                  await updateSavedPortfolio(inserted[0].id, userId, {
                    portfolioData: JSON.stringify(updatedPortfolioData)
                  });
                  console.log(`[portfolios.create ${debugId}] Updated portfolioData with calculated shares`);
                }
              }
            } catch (txErr: any) {
              console.error(`[portfolios.create ${debugId}] Failed to calculate/store cash balance:`, txErr);
              // Don't throw - portfolio is created, cash balance can be calculated later
            }
          }
          
          // 6) Trigger automatic MAX backfill for new symbols (async, non-blocking)
          if (input.portfolioData) {
            try {
              const portfolioData = JSON.parse(input.portfolioData);
              const holdings = portfolioData.stocks || [];
              const tickers = holdings.map((h: any) => h.ticker).filter(Boolean);
              
              if (tickers.length > 0) {
                console.log(`[portfolios.create ${debugId}] Triggering auto-backfill for ${tickers.length} symbols...`);
                // Import and trigger backfill asynchronously (don't await to avoid blocking)
                import("../autoBackfill").then(({ autoBackfillNewSymbols }) => {
                  autoBackfillNewSymbols(tickers).then(result => {
                    if (result.newSymbolsDetected > 0) {
                      console.log(`[portfolios.create ${debugId}] Auto-backfill completed: ${result.newSymbolsDetected} new symbols processed`);
                    }
                  }).catch(err => {
                    console.error(`[portfolios.create ${debugId}] Auto-backfill error:`, err);
                  });
                });
              }
            } catch (backfillErr) {
              console.error(`[portfolios.create ${debugId}] Failed to trigger auto-backfill:`, backfillErr);
              // Don't throw - portfolio is created, backfill can happen later
            }
          }
          
          return { ok: true, portfolio: inserted[0] };
        } catch (err: any) {
          // If it's already a TRPCError, rethrow it
          if (err instanceof TRPCError) {
            throw err;
          }
          
          // Otherwise, wrap it in a TRPCError
          console.error(`[portfolios.create ${debugId}] ERROR:`, err);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `portfolios.create failed (debugId=${debugId}): ${err?.message ?? String(err)}`,
            cause: err,
          });
        }
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
          inceptionDate: z.string().optional().nullable(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        console.log('[portfolios.update] ctx.user:', ctx.user);
        
        // HARD AUTH GUARD: No fallback, fail-fast on missing user
        if (!ctx.user || !ctx.user.id || ctx.user.id === 1) {
          console.error('[portfolios.update] AUTH GUARD FAILED:', {
            hasUser: !!ctx.user,
            userId: ctx.user?.id,
            userIdType: typeof ctx.user?.id,
          });
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Authentication required: ctx.user.id is missing or invalid",
          });
        }
        
        const { updateSavedPortfolio } = await import("../db");
        const result = await updateSavedPortfolio(input.id, ctx.user.id, {
          name: input.name,
          description: input.description,
          portfolioData: input.portfolioData,
          isLive: input.isLive,
          liveStartDate: input.liveStartDate ? new Date(input.liveStartDate) : undefined,
          inceptionDate: input.inceptionDate !== undefined ? (input.inceptionDate ? new Date(input.inceptionDate) : null) : undefined,
        });
        return result;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        console.log('[portfolios.delete] ctx.user:', ctx.user);
        
        // HARD AUTH GUARD: No fallback, fail-fast on missing user
        if (!ctx.user || !ctx.user.id || ctx.user.id === 1) {
          console.error('[portfolios.delete] AUTH GUARD FAILED:', {
            hasUser: !!ctx.user,
            userId: ctx.user?.id,
            userIdType: typeof ctx.user?.id,
          });
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Authentication required: ctx.user.id is missing or invalid",
          });
        }
        
        const { deleteSavedPortfolio } = await import("../db");
        await deleteSavedPortfolio(input.id, ctx.user.id);
        return { success: true };
      }),

    // Toggle live tracking for a portfolio
    toggleLive: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          isLive: z.boolean(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        console.log('[portfolios.toggleLive] ctx.user:', ctx.user);
        
        // HARD AUTH GUARD: No fallback, fail-fast on missing user
        if (!ctx.user || !ctx.user.id || ctx.user.id === 1) {
          console.error('[portfolios.toggleLive] AUTH GUARD FAILED:', {
            hasUser: !!ctx.user,
            userId: ctx.user?.id,
            userIdType: typeof ctx.user?.id,
          });
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Authentication required: ctx.user.id is missing or invalid",
          });
        }
        
        const { getSavedPortfolioById, updateSavedPortfolio, createPortfolioTransaction, getStockByTicker } = await import("../db");
        const { convertToCHF } = await import("../fxHelper");
        
        const portfolio = await getSavedPortfolioById(input.id, ctx.user.id);
        if (!portfolio) {
          throw new Error("Portfolio not found");
        }
        
        const isLiveValue = input.isLive ? 1 : 0;
        const liveStartDate = input.isLive ? new Date() : null;
        
        // If activating live tracking, create entry transactions for current positions
        if (input.isLive && !portfolio.isLive) {
          try {
            console.log('[toggleLive] Activating live tracking for portfolio:', input.id);
            const portfolioData = JSON.parse(portfolio.portfolioData);
            const stocks = portfolioData.stocks || [];
            const startCapital = parseFloat(portfolio.startCapital || '0');
            
            console.log('[toggleLive] Portfolio data:', { stocks: stocks.length, startCapital });
            
            if (!startCapital || startCapital <= 0) {
              throw new Error('Portfolio muss ein Startkapital haben, um Live-Tracking zu aktivieren');
            }
            
            if (stocks.length === 0) {
              throw new Error('Portfolio muss mindestens eine Position haben, um Live-Tracking zu aktivieren');
            }
            
            let totalPositionValue = 0;
            const skippedTickers: string[] = [];
            const todayStr = new Date().toISOString().split('T')[0];
            
            // Create "entry" transactions for each position based on current weights
            for (const stock of stocks) {
              const ticker = stock.ticker;
              const weight = parseFloat(stock.weight || '0');
              const positionValueCHF = (startCapital * weight) / 100;
              
              console.log(`[toggleLive] Processing ${ticker}: weight=${weight}%, value=${positionValueCHF} CHF`);
              
              // Get current stock data
              const dbStock = await getStockByTicker(ticker);
              if (!dbStock) {
                console.warn(`[toggleLive] Stock ${ticker} not found in database, skipping`);
                continue;
              }
              
              if (!dbStock.currentPrice) {
                console.warn(`[toggleLive] Stock ${ticker} has no current price, skipping`);
                continue;
              }
              
              const currentPrice = parseFloat(dbStock.currentPrice);
              const currency = dbStock.currency || 'CHF';
              
              console.log(`[toggleLive] ${ticker} price: ${currentPrice} ${currency}`);
              
              // Convert price to CHF. Achtung (FIN-1): convertToCHF wirft seit R-10
              // NICHT mehr, sondern liefert 0, wenn kein FX-Kurs existiert — die
              // Division unten würde sonst shares = Infinity in die DB schreiben.
              let priceCHF = currentPrice;
              if (currency !== 'CHF') {
                priceCHF = await convertToCHF(currentPrice, currency, todayStr);
                console.log(`[toggleLive] ${ticker} converted to CHF: ${priceCHF}`);
              }
              if (!(priceCHF > 0)) {
                console.error(`[toggleLive] ${ticker} übersprungen: kein gültiger CHF-Kurs (Preis ${currentPrice} ${currency}, FX fehlt)`);
                skippedTickers.push(ticker);
                continue;
              }

              // Calculate number of shares
              const shares = positionValueCHF / priceCHF;
              
              console.log(`[toggleLive] Creating entry transaction for ${ticker}: ${shares.toFixed(6)} shares`);
              
              // Create entry transaction (Eingang)
              await createPortfolioTransaction({
                portfolioId: input.id,
                transactionType: 'entry',
                ticker: ticker,
                shares: shares.toFixed(2),
                pricePerShare: currentPrice.toFixed(2),
                currency: currency,
                totalAmount: positionValueCHF.toFixed(2),
                totalAmountCHF: positionValueCHF.toFixed(2),
                fees: '0',
                transactionDate: new Date(),
                notes: 'Automatischer Eingang bei Live-Aktivierung',
              });
              
              totalPositionValue += positionValueCHF;
            }
            
            console.log(`[toggleLive] Total position value: ${totalPositionValue} CHF`);
            if (skippedTickers.length > 0) {
              // Übersprungene Positionen bleiben als Liquidität stehen (kein Eingang gebucht).
              console.warn(`[toggleLive] Ohne gültigen CHF-Kurs übersprungen: ${skippedTickers.join(', ')}`);
            }
            
            // Calculate and store cash balance (Liquidität)
            const cashBalance = startCapital - totalPositionValue;
            
            console.log(`[toggleLive] Cash balance: ${cashBalance} CHF`);
            
            // Create deposit transaction for remaining cash if positive
            if (cashBalance > 0) {
              await createPortfolioTransaction({
                portfolioId: input.id,
                transactionType: 'deposit',
                ticker: null,
                shares: null,
                pricePerShare: null,
                currency: 'CHF',
                totalAmount: cashBalance.toFixed(2),
                totalAmountCHF: cashBalance.toFixed(2),
                fees: '0',
                transactionDate: new Date(),
                notes: 'Liquiditätskonto (Differenz zu Investitionssumme)',
              });
            }
            
            // Update portfolio with cash balance
            await updateSavedPortfolio(input.id, ctx.user.id, {
              isLive: isLiveValue,
              liveStartDate: liveStartDate,
              cashBalance: cashBalance.toFixed(2),
            });
            
            console.log('[toggleLive] Live tracking activated successfully');
            
            return { success: true, portfolio: await getSavedPortfolioById(input.id, ctx.user.id) };
          } catch (error) {
            console.error('[toggleLive] Error creating initial transactions:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to create initial transactions for live tracking';
            throw new Error(errorMessage);
          }
        }
        
        // U-19: Beim Deaktivieren wird das Portfolio wieder zum Demo-Portfolio.
        // Demo-Portfolios führen keine Transaktionen (Kundenanforderung):
        // 1) aktuelle Bestände aus den Transaktionen in portfolioData übernehmen
        //    (die Positionen bleiben erhalten),
        // 2) danach Transaktionen + zugehörige realizedGains-Zeilen löschen.
        if (!input.isLive && portfolio.isLive) {
          const { getPortfolioTransactions, getDb } = await import("../db");
          const transactions = await getPortfolioTransactions(input.id);

          if (transactions.length > 0) {
            // Bestände aggregieren (buy/entry +, sell −) — VOR dem Löschen
            const { aggregateHoldingsFromTransactions } = await import("./dividendCalendarRouter");
            const holdings = aggregateHoldingsFromTransactions(transactions);

            // Snapshot der Stückzahlen in portfolioData (Format {stocks:[]} bzw. Array beibehalten)
            let raw: any = {};
            try {
              raw = JSON.parse(portfolio.portfolioData || "{}");
            } catch {
              raw = {};
            }
            const stocks: any[] = Array.isArray(raw) ? raw : (raw.stocks || []);
            const byTicker = new Map<string, any>(stocks.map((s: any) => [s.ticker, s]));
            for (const [ticker, shares] of Object.entries(holdings)) {
              if (!ticker || ticker === "CASH") continue;
              const existing = byTicker.get(ticker);
              if (shares > 0) {
                if (existing) {
                  existing.shares = shares.toFixed(2);
                } else {
                  byTicker.set(ticker, { ticker, shares: shares.toFixed(2) });
                }
              } else if (existing) {
                // Position vollständig verkauft → nicht in den Demo-Bestand übernehmen
                byTicker.delete(ticker);
              }
            }
            const snapshotStocks = Array.from(byTicker.values());
            const newPortfolioData = Array.isArray(raw)
              ? JSON.stringify(snapshotStocks)
              : JSON.stringify({ ...raw, stocks: snapshotStocks });

            // Transaktionen + realisierte Gewinne dieses Portfolios entfernen
            const db = await getDb();
            if (db) {
              const { portfolioTransactions, realizedGains } = await import("../../drizzle/schema");
              const { eq } = await import("drizzle-orm");
              await db.delete(realizedGains).where(eq(realizedGains.portfolioId, input.id));
              await db.delete(portfolioTransactions).where(eq(portfolioTransactions.portfolioId, input.id));
            }

            const result = await updateSavedPortfolio(input.id, ctx.user.id, {
              isLive: isLiveValue,
              liveStartDate: liveStartDate,
              portfolioData: newPortfolioData,
            });

            return { success: true, portfolio: result };
          }
        }

        // If deactivating live tracking without transactions, just update the flags
        const result = await updateSavedPortfolio(input.id, ctx.user.id, {
          isLive: isLiveValue,
          liveStartDate: liveStartDate,
        });

        return { success: true, portfolio: result };
      }),

    // Get realized gains/losses for a portfolio
    getRealizedGains: protectedProcedure
      .input(z.object({ portfolioId: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        const { getDb } = await import("../db");
        const { realizedGains } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        
        const db = await getDb();
        if (!db) return [];
        
        const gains = await db.select().from(realizedGains)
          .where(eq(realizedGains.portfolioId, input.portfolioId))
          .orderBy(realizedGains.transactionDate);
        
        return gains;
      }),

    // Get holdings with CHF performance for a portfolio
    getHoldingsWithChfPerformance: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        const { getSavedPortfolioById, getPortfolioTransactions, getStockByTicker } = await import("../db");
        const { getStockCurrency, tryConvertToCHF, getHistoricalPrice } = await import("../fxHelper");
        
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
          const currentPrice = safeParseFloat(stock.currentPrice);
          // FIN-4 (Audit 2026-07): fehlender Jahresanfangskurs wird NICHT mehr
          // still durch currentPrice ersetzt (das zeigte YTD = 0 % statt «n/a»
          // und verzerrte Aggregate) — stattdessen geflaggt und YTD auf 0 mit Flag.
          const ytdStartPriceRaw = await getHistoricalPrice(ticker, ytdStartDate);
          const ytdStartMissing = !(ytdStartPriceRaw && ytdStartPriceRaw > 0);
          const ytdStartPrice = ytdStartMissing ? 0 : ytdStartPriceRaw;

          // U-13: fehlender Kurs/FX-Kurs → Wert 0 (wie bisher), aber geflaggt.
          const priceMissing = !(currentPrice > 0);
          const currentPriceCHFOrNull = await tryConvertToCHF(currentPrice, currency, todayStr);
          const ytdStartPriceCHFOrNull = ytdStartMissing ? null : await tryConvertToCHF(ytdStartPrice, currency, ytdStartDate);
          const fxMissing = currentPriceCHFOrNull === null || (!ytdStartMissing && ytdStartPriceCHFOrNull === null);
          const currentPriceCHF = currentPriceCHFOrNull ?? 0;
          const ytdStartPriceCHF = ytdStartPriceCHFOrNull ?? 0;

          const currentValueCHF = holding.shares * currentPriceCHF;
          const ytdStartValueCHF = holding.shares * ytdStartPriceCHF;
          const performanceCHF = ytdStartValueCHF > 0 ? currentValueCHF - ytdStartValueCHF : 0;
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
            // U-13: Datenqualitäts-Flags (additiv, Client-Badges Phase 4)
            priceMissing,
            fxMissing,
            ytdStartMissing,
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
        debug: z.boolean().optional().default(false), // Enable debug payload
      }))
      .query(async ({ input, ctx }) => {
        const { portfolioId, period, benchmark, debug: debugEnabled } = input;
        
        // === LOCAL HELPERS FOR DEBUG ===
        const mkRangeInfo = (points: any[]) => ({
          count: points?.length || 0,
          firstDate: points?.[0]?.date || null,
          lastDate: points?.[points.length - 1]?.date || null,
        });
        
        const safeExec = async <T>(label: string, fn: () => Promise<T> | T): Promise<{ ok: boolean; value?: T; error?: string }> => {
          try {
            const value = await fn();
            return { ok: true, value };
          } catch (err: any) {
            return { ok: false, error: err?.message || String(err) };
          }
        };
        
        const assertOrDebug = (debug: any, condition: boolean, code: string, msg: string) => {
          if (!condition && debug) {
            debug.assertions = debug.assertions || [];
            debug.assertions.push({ code, msg });
          }
        };
        
        // Check if debug should be enabled
        const debugOn = debugEnabled === true || ctx.user?.role === 'admin';
        
        // Initialize debug payload
        const debug: any = debugOn ? {
          version: "perf-chart-debug-v1",
          now: new Date().toISOString(),
          portfolioId,
          period,
          creationDate: null,
          ytdStartDate: null,
          endDate: null,
          allowHypotheticalPerformance: false,
          earliestTransactionDate: null,
          branchSelected: "legacy" as "stitched" | "realOnly" | "legacy",
          hypo: { ok: false, error: null, count: 0, firstDate: null, lastDate: null },
          real: { ok: false, error: null, count: 0, firstDate: null, lastDate: null },
          stitched: { ok: false, error: null, count: 0, firstDate: null, lastDate: null },
          priceData: {
            tickers: [],
            missingTickers: [],
            sampleTicker: null,
            sampleHasYtdStartPrice: false,
            sampleFirstPriceDate: null,
            sampleLastPriceDate: null,
          },
          weights: {
            method: "fallback" as "currentHoldings" | "portfolioStocks" | "fallback",
            sumWeights: 0,
            count: 0,
            top: [],
          }
        } : null;
        const { getSavedPortfolioById, getPortfolioTransactions, getStockByTicker, getDb } = await import("../db");
        const { convertToCHF, getFxRate } = await import("../fxHelper");

        // Reporting currency is CHF: convert local-currency price maps to CHF (per-date
        // FX) via the shared performanceCore helper, used for both the portfolio and
        // benchmark lines so the whole chart is in CHF (consistent with the numbers).
        const toChfChartMap = (priceMap: Record<string, number>, currency: string) =>
          toChfPriceMapCore(priceMap, currency, getFxRate);

        const portfolio = await getSavedPortfolioById(portfolioId, ctx.user.id);
        if (!portfolio) {
          return { chartData: [], totalValueHistory: [] };
        }
        
        const isLivePortfolio = portfolio.isLive;
        let transactions: any[] = [];
        let portfolioStocks: any[] = [];
        
        if (isLivePortfolio) {
          transactions = await getPortfolioTransactions(portfolioId);
          // If live portfolio has no transactions, fall back to portfolioData (like test portfolios)
          if (transactions.length === 0) {
            console.log(`[getHistoricalPerformance] Live portfolio ${portfolioId} has no transactions, falling back to portfolioData`);
            try {
              const portfolioData = typeof portfolio.portfolioData === 'string' 
                ? JSON.parse(portfolio.portfolioData) 
                : portfolio.portfolioData;
              portfolioStocks = portfolioData?.stocks || [];
              if (portfolioStocks.length === 0) {
                console.log(`[getHistoricalPerformance] No stocks in portfolioData either, returning empty`);
                return { chartData: [], totalValueHistory: [] };
              }
              console.log(`[getHistoricalPerformance] Found ${portfolioStocks.length} stocks in portfolioData`);
            } catch (e) {
              console.error(`[getHistoricalPerformance] Failed to parse portfolioData:`, e);
              return { chartData: [], totalValueHistory: [] };
            }
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
            // For live portfolios, start from year beginning to show hypothetical performance
            // For test portfolios, use earliest transaction date or 5 years ago
            if (isLivePortfolio) {
              startDate = new Date(`${today.getFullYear()}-01-01`);
            } else if (earliestTransactionDate) {
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
        
        // SIMPLIFIED BRANCH DECISION (12.01.2026):
        // - Live-Portfolios mit Transaktionen: Reale Performance ab Erstellungsdatum
        // - Demo-Portfolios (und Live ohne Transaktionen): Historische Performance basierend auf Gewichtung
        // - KEINE hypothetische Performance vor Erstellungsdatum
        const creationDate = portfolio.liveStartDate ? new Date(portfolio.liveStartDate) : null;
        
        // Live portfolios with transactions use real TWR calculation
        // DISABLED (24.06.2026): the transaction-based TWR path produced
        // inconsistent/incorrect values (e.g. Regula 54%/0.91% vs. the correct
        // weight-based 25%). Until the TWR engine is reliable, ALL portfolios use
        // the weight-based historical series so the chart matches the YTD number
        // (getMultiPeriodPerformanceV2). See chart==Zahl consistency work.
        const useLiveRealPerformance = false && isLivePortfolio && transactions.length > 0;
        
        // For live portfolios, start from creation date (not before)
        if (useLiveRealPerformance && creationDate && startDate < creationDate) {
          startDate = creationDate;
        }
        
        // Legacy compatibility
        const allowHypotheticalPerformance = false; // No more hypothetical performance
        
        // ALWAYS log this decision for debugging
        console.log('[getHistoricalPerformance] Branch decision:', {
          portfolioId,
          period,
          isLivePortfolio,
          hasCreationDate: !!creationDate,
          creationDate: creationDate?.toISOString(),
          useLiveRealPerformance,
          earliestTransactionDate: earliestTransactionDate?.toISOString()
        });
        
        if (debug) {
          debug.creationDate = creationDate?.toISOString() || null;
          debug.ytdStartDate = startDate.toISOString().split('T')[0];
          debug.endDate = todayStr;
          debug.earliestTransactionDate = earliestTransactionDate?.toISOString() || null;
          debug.allowHypotheticalPerformance = false;
        }
        
        // SIMPLIFIED: Live portfolios with transactions use real TWR calculation
        if (useLiveRealPerformance) {
          if (debug) debug.branchSelected = "liveReal";
          console.log(`[NewArchitecture] Using two-phase calculation for portfolio ${portfolioId}`);
          
          const creationDateStr = creationDate.toISOString().split('T')[0];
          const ytdStartStr = startDate.toISOString().split('T')[0];
          
          // Import new functions
          const { 
            getHypotheticalSeriesFromWeights, 
            getRealTwrSeriesFromTransactions, 
            stitchSeries 
          } = await import("../performanceHypothetical");
          
          // Get portfolio stocks for weights
          // For live portfolios, calculate weights from current holdings
          let portfolioStocks: any[] = [];
          
          // Calculate current holdings from all transactions
          const currentHoldings: Record<string, number> = {};
          for (const tx of transactions) {
            const ticker = tx.ticker;
            const shares = parseFloat(tx.shares) || 0;
            const type = tx.transactionType || tx.type;
            
            if (!ticker) continue;
            
            if (type === 'buy') {
              currentHoldings[ticker] = (currentHoldings[ticker] || 0) + shares;
            } else if (type === 'sell') {
              currentHoldings[ticker] = (currentHoldings[ticker] || 0) - shares;
            }
          }
          
          // Get current prices to calculate portfolio value
          const { stocks: stocksTable } = await import("../../drizzle/schema");
          let totalValue = 0;
          const holdingValues: Record<string, number> = {};
          
          for (const [ticker, shares] of Object.entries(currentHoldings)) {
            if (shares <= 0) continue;
            
            // Get latest price
            const allPrices = await db
              .select()
              .from(historicalPrices)
              .where(eq(historicalPrices.ticker, ticker));
            
            if (allPrices.length > 0) {
              // Sort by date descending and get latest
              allPrices.sort((a, b) => b.date.localeCompare(a.date));
              const price = parseFloat(String(allPrices[0].close)) || 0;
              const value = shares * price;
              holdingValues[ticker] = value;
              totalValue += value;
            }
          }
          
          // Calculate weights
          if (totalValue > 0) {
            portfolioStocks = Object.entries(holdingValues).map(([ticker, value]) => ({
              ticker,
              weight: value / totalValue
            }));
          }
          
          console.log(`[NewArchitecture] Calculated ${portfolioStocks.length} positions from holdings`);
          console.log(`[NewArchitecture] Total portfolio value: ${totalValue} CHF`);
          
          if (portfolioStocks.length === 0) {
            // Try to get stocks from portfolioData (for live portfolios without transactions)
            console.log(`[NewArchitecture] No holdings from transactions, trying portfolioData`);
            try {
              const portfolioData = typeof portfolio.portfolioData === 'string' 
                ? JSON.parse(portfolio.portfolioData) 
                : portfolio.portfolioData;
              const stocks = portfolioData?.stocks || [];
              if (stocks.length > 0) {
                // Calculate weights from portfolioData
                const totalWeight = stocks.reduce((sum: number, s: any) => sum + (parseFloat(s.weight) || 0), 0);
                portfolioStocks = stocks.map((s: any) => ({
                  ticker: s.ticker,
                  weight: totalWeight > 0 ? (parseFloat(s.weight) || 0) / totalWeight : 1 / stocks.length
                })).filter((s: any) => s.ticker && s.weight > 0);
                console.log(`[NewArchitecture] Found ${portfolioStocks.length} stocks from portfolioData`);
              }
            } catch (e) {
              console.error(`[NewArchitecture] Failed to parse portfolioData:`, e);
            }
          }
          
          if (portfolioStocks.length === 0) {
            console.warn(`[NewArchitecture] No portfolio stocks found, falling back to old logic`);
            // Fall through to old logic
          } else {
            // Calculate start capital
            const startCapitalHypo = parseFloat(String(portfolio.startCapital)) || 10000;
            
            console.log(`[NewArchitecture] Start capital: ${startCapitalHypo} CHF`);
            console.log(`[NewArchitecture] Portfolio stocks:`, portfolioStocks.map((s: any) => ({ ticker: s.ticker, weight: s.weight })));
            
            // Prepare weights
            const weights = portfolioStocks.map((s: any) => ({
              ticker: s.ticker,
              weight: parseFloat(s.weight) || 0
            })).filter((w: any) => w.weight > 0);
            
            // Fill debug.weights
            if (debug) {
              debug.weights.method = "currentHoldings";
              debug.weights.count = weights.length;
              debug.weights.sumWeights = weights.reduce((a: number, w: any) => a + w.weight, 0);
              debug.weights.top = weights
                .sort((a: any, b: any) => b.weight - a.weight)
                .slice(0, 5)
                .map((w: any) => ({ ticker: w.ticker, weight: w.weight }));
              
              // Assertion: weights not empty
              assertOrDebug(debug, weights.length > 0, "weightsEmpty", "No weights available for hypothetical series");
              // Assertion: weights normalized
              assertOrDebug(debug, debug.weights.sumWeights >= 0.98 && debug.weights.sumWeights <= 1.02, "weightsNotNormalized", `sumWeights=${debug.weights.sumWeights}`);
              
              // Fill debug.priceData (tickers)
              debug.priceData.tickers = weights.map((w: any) => w.ticker);
              debug.priceData.sampleTicker = weights[0]?.ticker || null;
            }
            
            // SIMPLIFIED (12.01.2026): No hypothetical performance - only real performance from creation date
            console.log(`[LiveRealPerformance] Calculating real performance from ${creationDateStr} to ${todayStr}`);
            
            // Skip hypothetical phase entirely
            if (debug) {
              debug.hypo.ok = false;
              debug.hypo.error = "Hypothetical performance disabled";
              debug.hypo.count = 0;
              debug.hypo.firstDate = null;
              debug.hypo.lastDate = null;
            }
            
            // Phase 2: Real performance (creationDate to today)
            // IMPORTANT: Use earliestTransactionDate if liveStartDate has no transactions
            // This handles cases where liveStartDate was set after the actual portfolio creation
            let effectiveStartDate = creationDateStr;
            
            // Check if there are transactions on the liveStartDate
            const transactionsOnCreationDate = transactions.filter((tx: any) => {
              const txDate = new Date(tx.transactionDate).toISOString().split('T')[0];
              return txDate === creationDateStr;
            });
            
            // If no transactions on liveStartDate, use earliestTransactionDate instead
            if (transactionsOnCreationDate.length === 0 && earliestTransactionDate) {
              effectiveStartDate = earliestTransactionDate.toISOString().split('T')[0];
              console.log(`[NewArchitecture] No transactions on liveStartDate (${creationDateStr}), using earliestTransactionDate: ${effectiveStartDate}`);
            }
            
            console.log(`[NewArchitecture] Calculating real performance from ${effectiveStartDate} to ${todayStr}`);
            
            // Build initial holdings from first transactions
            const initialHoldings: Record<string, number> = {};
            let initialCash = 0;
            
            // Get transactions on the effective start date
            const creationTransactions = transactions.filter((tx: any) => {
              const txDate = new Date(tx.transactionDate).toISOString().split('T')[0];
              return txDate === effectiveStartDate;
            });
            
            // Process creation transactions to get initial state
            // IMPORTANT: Process deposits first, then buys to get correct initial cash balance
            for (const tx of creationTransactions) {
              const type = tx.transactionType || tx.type;
              
              if (type === 'deposit') {
                // Note: The column is named totalAmountCHF in the database
                initialCash += parseFloat(tx.totalAmountCHF) || 0;
              }
            }
            
            // Now process buys and subtract from initial cash
            for (const tx of creationTransactions) {
              const ticker = tx.ticker;
              const shares = parseFloat(tx.shares) || 0;
              const type = tx.transactionType || tx.type;
              const fees = parseFloat(tx.fees) || 0;
              
              if (type === 'buy') {
                initialHoldings[ticker] = (initialHoldings[ticker] || 0) + shares;
                // Subtract the cost from initial cash
                const cost = parseFloat(tx.totalAmountCHF) || 0;
                initialCash -= (cost + fees);
              }
            }
            
            const realRes = await safeExec("real", async () => {
              return await getRealTwrSeriesFromTransactions(
                effectiveStartDate, // Use effective start date instead of creationDateStr
                todayStr,
                transactions,
                initialHoldings,
                initialCash
              );
            });
            
            if (debug) {
              debug.real.ok = realRes.ok;
              debug.real.error = realRes.error || null;
              if (realRes.ok && realRes.value) {
                const r = mkRangeInfo(realRes.value);
                debug.real.count = r.count;
                debug.real.firstDate = r.firstDate;
                debug.real.lastDate = r.lastDate;
                
                // Assertion A5: realStartsTooEarly
                if (r.firstDate && creationDateStr) {
                  assertOrDebug(debug, r.firstDate >= creationDateStr, "realStartsTooEarly", `real.firstDate=${r.firstDate}, creation=${creationDateStr}`);
                }
              }
            }
            
            if (!realRes.ok || !realRes.value || realRes.value.length === 0) {
              if (debug) {
                assertOrDebug(debug, false, "realEmptyOrFailed", "Real series failed or empty");
              }
              // Return empty chart with debug
              return { chartData: [], ...(debugOn ? { debug } : {}) };
            }
            
            const realSeries = realRes.value;
            
            // SIMPLIFIED (12.01.2026): No stitching needed - use realSeries directly
            console.log(`[LiveRealPerformance] Using real series directly (no stitching)`);
            const stitchedRes = { ok: true, value: realSeries, error: null };
            
            if (debug) {
              debug.stitched.ok = stitchedRes.ok;
              debug.stitched.error = stitchedRes.error || null;
              if (stitchedRes.ok && stitchedRes.value) {
                const r = mkRangeInfo(stitchedRes.value);
                debug.stitched.count = r.count;
                debug.stitched.firstDate = r.firstDate;
                debug.stitched.lastDate = r.lastDate;
                
                // Assertion A4: stitchedNotStartingAtYtd
                if (r.firstDate && ytdStartStr) {
                  assertOrDebug(debug, r.firstDate === ytdStartStr || Math.abs(new Date(r.firstDate).getTime() - new Date(ytdStartStr).getTime()) < 7 * 24 * 60 * 60 * 1000, "stitchedNotStartingAtYtd", `stitched.firstDate=${r.firstDate}, ytd=${ytdStartStr}`);
                }
              }
            }
            
            if (!stitchedRes.ok || !stitchedRes.value || stitchedRes.value.length === 0) {
              if (debug) {
                assertOrDebug(debug, false, "stitchedFailed", "Stitch failed, falling back to realOnly");
                debug.branchSelected = "realOnly";
              }
              // Fall back to realOnly - still need benchmark
              // Fetch benchmark prices for the real series date range
              const benchmarkPricesForReal = await db
                .select()
                .from(historicalPrices)
                .where(
                  and(
                    eq(historicalPrices.ticker, benchmark),
                    gte(historicalPrices.date, ytdStartStr),
                    lte(historicalPrices.date, todayStr)
                  )
                )
                .orderBy(asc(historicalPrices.date));
              
              const benchmarkMapForReal: Record<string, number> = {};
              benchmarkPricesForReal.forEach((p: any) => {
                // Convert Date object to string format YYYY-MM-DD
                const dateStr = p.date instanceof Date 
                  ? p.date.toISOString().split('T')[0] 
                  : String(p.date).split('T')[0];
                benchmarkMapForReal[dateStr] = parseFloat(p.close) || 0;
              });
              
              let benchmarkStartPriceForReal = 0;
              const sortedBenchmarkDatesForReal = Object.keys(benchmarkMapForReal).sort();
              for (const date of sortedBenchmarkDatesForReal) {
                if (date >= ytdStartStr) {
                  benchmarkStartPriceForReal = benchmarkMapForReal[date];
                  break;
                }
              }
              
              // Helper function to find the closest available benchmark price
              const getClosestBenchmarkPriceForReal = (targetDate: string): number => {
                if (benchmarkMapForReal[targetDate]) {
                  return benchmarkMapForReal[targetDate];
                }
                const sortedDates = Object.keys(benchmarkMapForReal).sort();
                let closestPrice = 0;
                for (const date of sortedDates) {
                  if (date <= targetDate) {
                    closestPrice = benchmarkMapForReal[date];
                  } else if (closestPrice === 0 && date > targetDate) {
                    closestPrice = benchmarkMapForReal[date];
                    break;
                  }
                }
                return closestPrice;
              };
              
              const chartData = realSeries.map((point: any) => {
                const benchmarkCurrentPrice = getClosestBenchmarkPriceForReal(point.date);
                const benchmarkPerformance = benchmarkStartPriceForReal > 0 && benchmarkCurrentPrice > 0
                  ? ((benchmarkCurrentPrice - benchmarkStartPriceForReal) / benchmarkStartPriceForReal) * 100
                  : 0;
                
                return {
                  date: point.date,
                  portfolio: point.portfolioReturn * 100,
                  benchmark: parseFloat(benchmarkPerformance.toFixed(2)),
                  segment: "real"
                };
              });
              return { chartData, ...(debugOn ? { debug } : {}) };
            }
            
            const stitchedSeries = stitchedRes.value;
            
            // Debug: Mark that we reached the benchmark calculation
            if (debug) {
              debug.reachedBenchmarkCalc = true;
            }
            
            // Fetch benchmark prices for the real series date range
            // IMPORTANT: Use earliest transaction date as start for Live-Portfolios
            // This ensures benchmark starts from the same date as the portfolio performance
            const benchmarkStartDateStr = earliestTransactionDate 
              ? earliestTransactionDate.toISOString().split('T')[0]
              : creationDateStr; // Fallback to creation date if no transactions
            console.log(`[LiveRealPerformance] Fetching benchmark from ${benchmarkStartDateStr} to ${todayStr}`);
            
            const benchmarkPricesForStitched = await db
              .select()
              .from(historicalPrices)
              .where(
                and(
                  eq(historicalPrices.ticker, benchmark),
                  gte(historicalPrices.date, benchmarkStartDateStr),
                  lte(historicalPrices.date, todayStr)
                )
              )
              .orderBy(asc(historicalPrices.date));
            
            const benchmarkMapForStitched: Record<string, number> = {};
            benchmarkPricesForStitched.forEach((p: any) => {
              // Convert Date object to string format YYYY-MM-DD
              const dateStr = p.date instanceof Date 
                ? p.date.toISOString().split('T')[0] 
                : String(p.date).split('T')[0];
              benchmarkMapForStitched[dateStr] = parseFloat(p.close) || 0;
            });
            
            // Get benchmark starting price (from creation date)
            let benchmarkStartPriceForStitched = 0;
            const sortedBenchmarkDatesForStitched = Object.keys(benchmarkMapForStitched).sort();
            for (const date of sortedBenchmarkDatesForStitched) {
              if (date >= benchmarkStartDateStr) {
                benchmarkStartPriceForStitched = benchmarkMapForStitched[date];
                break;
              }
            }
            if (benchmarkStartPriceForStitched === 0 && benchmarkPricesForStitched.length > 0) {
              benchmarkStartPriceForStitched = parseFloat(String(benchmarkPricesForStitched[0]?.close || 0));
            }
            
            console.log(`[NewArchitecture] Benchmark ${benchmark} start price: ${benchmarkStartPriceForStitched}`);
            console.log(`[NewArchitecture] Benchmark prices count: ${benchmarkPricesForStitched.length}`);
            console.log(`[NewArchitecture] Benchmark map keys: ${Object.keys(benchmarkMapForStitched).slice(0, 5).join(', ')}...`);
            console.log(`[NewArchitecture] ytdStartStr: ${ytdStartStr}, todayStr: ${todayStr}`);
            console.log(`[NewArchitecture] First stitched point date: ${stitchedSeries[0]?.date}`);
            console.log(`[NewArchitecture] Last stitched point date: ${stitchedSeries[stitchedSeries.length - 1]?.date}`);
            if (benchmarkPricesForStitched.length > 0) {
              console.log(`[NewArchitecture] First benchmark price:`, benchmarkPricesForStitched[0]);
            }
            
            // Debug: Log benchmark data before processing
            console.log(`[BenchmarkDebug] benchmarkPricesForStitched.length: ${benchmarkPricesForStitched.length}`);
            console.log(`[BenchmarkDebug] benchmarkMapForStitched keys: ${Object.keys(benchmarkMapForStitched).join(', ')}`);
            console.log(`[BenchmarkDebug] benchmarkStartPriceForStitched: ${benchmarkStartPriceForStitched}`);
            console.log(`[BenchmarkDebug] First stitched point: ${JSON.stringify(stitchedSeries[0])}`);
            
            // Helper function to find the closest available benchmark price
            const getClosestBenchmarkPrice = (targetDate: string): number => {
              // First try exact match
              if (benchmarkMapForStitched[targetDate]) {
                return benchmarkMapForStitched[targetDate];
              }
              
              // Find the closest date (prefer previous date, then next date)
              const sortedDates = Object.keys(benchmarkMapForStitched).sort();
              let closestDate = '';
              let closestPrice = 0;
              
              for (const date of sortedDates) {
                if (date <= targetDate) {
                  closestDate = date;
                  closestPrice = benchmarkMapForStitched[date];
                } else if (!closestDate && date > targetDate) {
                  // If no previous date found, use the next available date
                  closestPrice = benchmarkMapForStitched[date];
                  break;
                }
              }
              
              return closestPrice;
            };
            
            // Convert to chartData format with benchmark
            const chartData = stitchedSeries.map(point => {
              const benchmarkCurrentPrice = getClosestBenchmarkPrice(point.date);
              const benchmarkPerformance = benchmarkStartPriceForStitched > 0 && benchmarkCurrentPrice > 0
                ? ((benchmarkCurrentPrice - benchmarkStartPriceForStitched) / benchmarkStartPriceForStitched) * 100
                : 0;
              
              return {
                date: point.date,
                portfolio: point.portfolioReturn * 100, // Convert to percentage
                benchmark: parseFloat(benchmarkPerformance.toFixed(2)),
                segment: point.segment // Include segment for frontend
              };
            });
            
            console.log(`[NewArchitecture] Generated ${chartData.length} chart points with benchmark`);
            console.log(`[NewArchitecture] First point:`, chartData[0]);
            console.log(`[NewArchitecture] Last point:`, chartData[chartData.length - 1]);
            
            // Add benchmark debug info - ALWAYS add for debugging
            debug.benchmarkPricesCount = benchmarkPricesForStitched.length;
            debug.benchmarkMapKeys = Object.keys(benchmarkMapForStitched).slice(0, 10);
            debug.benchmarkStartPrice = benchmarkStartPriceForStitched;
            debug.firstChartBenchmark = chartData[0]?.benchmark;
            debug.lastChartBenchmark = chartData[chartData.length - 1]?.benchmark;
            debug.sampleBenchmarkMapValues = Object.entries(benchmarkMapForStitched).slice(0, 5);
            debug.stitchedSeriesFirstDate = stitchedSeries[0]?.date;
            debug.stitchedSeriesLastDate = stitchedSeries[stitchedSeries.length - 1]?.date;
            
            return { chartData, debug };
          }
        }
        
        // For other periods (1M, 3M, etc.), never start before the first transaction
        if (isLivePortfolio && !allowHypotheticalPerformance && earliestTransactionDate && startDate < earliestTransactionDate) {
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
          
          console.log(`[DEBUG] allTransactionsAfterStart: ${allTransactionsAfterStart}, allowHypotheticalPerformance: ${allowHypotheticalPerformance}`);
          console.log(`[DEBUG] portfolioStocks length: ${portfolioStocks.length}`);
          
          if (allTransactionsAfterStart && allowHypotheticalPerformance) {
            // For YTD/All periods: calculate hypothetical performance before creation date
            // Use current portfolio weights (from portfolioStocks) for hypothetical period
            console.log(`[HistoricalPerformance] Calculating hypothetical performance before ${earliestTransactionDate?.toISOString().split('T')[0]}`);
            console.log(`[DEBUG] portfolioStocks:`, JSON.stringify(portfolioStocks.map((s: any) => ({ ticker: s.ticker, weight: s.weight }))));
            
            // Use weights from portfolioStocks (current portfolio composition)
            portfolioStocks.forEach((stock: any) => {
              const ticker = stock.ticker;
              const weight = parseFloat(stock.weight) || 0;
              
              console.log(`[DEBUG] Processing stock: ${ticker}, weight: ${weight}`);
              
              if (ticker && weight > 0) {
                holdingsAtYtdStart[ticker] = { 
                  shares: 1, // Use 1 share as base for percentage calculation
                  avgCost: 0, 
                  weight: weight 
                };
              }
            });
            
            console.log(`[DEBUG] holdingsAtYtdStart:`, JSON.stringify(holdingsAtYtdStart));
          } else if (allTransactionsAfterStart) {
            // For other periods (1M, 3M, etc.): just initialize empty holdings
            console.log(`[HistoricalPerformance] Portfolio started after ${ytdStartDate}, initializing from first transactions`);
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
        const chartData: { date: string; portfolio: number; portfolioInclCash: number; benchmark: number }[] = [];
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
        
        const benchmarkLocalMap: Record<string, number> = {};
        benchmarkPrices.forEach((p: any) => {
          benchmarkLocalMap[p.date] = parseFloat(p.close) || 0;
        });
        // Convert the benchmark line to CHF (consistent with the CHF portfolio line
        // and the V2 benchmark numbers). SPY etc. are quoted in their own currency.
        const benchmarkStock = await getStockByTicker(benchmark);
        const benchmarkCurrency = benchmarkStock?.currency || 'USD';
        const benchmarkMap: Record<string, number> = await toChfChartMap(benchmarkLocalMap, benchmarkCurrency);

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
        
        // For hypothetical performance, generate complete date range from ytdStartDate
        if (allowHypotheticalPerformance) {
          // Generate all dates from ytdStartDate to today
          const start = new Date(ytdStartDate);
          const end = new Date(todayStr);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            allDates.add(dateStr);
          }
          console.log(`[HistoricalPerformance] Generated ${allDates.size} dates from ${ytdStartDate} to ${todayStr}`);
        }
        
        // Add dates from price data
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
        // Only adjust effectiveStartDate if we're NOT showing hypothetical performance
        if (allTransactionsAfterStart && transactions.length > 0 && !allowHypotheticalPerformance) {
          const sortedTransactions = [...transactions].sort((a: any, b: any) => 
            new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
          );
          effectiveStartDate = new Date(sortedTransactions[0].transactionDate).toISOString().split('T')[0];
          console.log(`[HistoricalPerformance] Portfolio started during period, effective start date: ${effectiveStartDate}`);
        } else if (allowHypotheticalPerformance) {
          console.log(`[HistoricalPerformance] Showing hypothetical performance from ${ytdStartDate}`);
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
        // W7/R-10: fehlender Kurs → 0 (Position fällt aus der Bewertung) statt
        // hartkodiertem 1:1-Fallback.
        const convertToCHFCached = (price: number, currency: string, date: string): number => {
          if (currency === 'CHF') return price;
          const rate = fxRatesCache[currency]?.[date] ?? 0;
          return price * rate;
        };

        // Sample dates to reduce data points (max 100 points for chart)
        const maxDataPoints = 100;
        const sampleInterval = Math.max(1, Math.floor(sortedDates.length / maxDataPoints));
        const sampledDates = sortedDates.filter((_, idx) => idx % sampleInterval === 0 || idx === sortedDates.length - 1);

        // Compute the portfolio line with the SAME weighted per-stock formula as the
        // displayed numbers (getMultiPeriodPerformanceV2), so the chart endpoint equals
        // the YTD figure for every portfolio — including ones with an extreme mover.
        // Prices are converted to CHF (per-date FX) so the line is a true CHF return,
        // identical methodology to V2. No clamping, no daily smoothing.
        const weightedSeriesStocks = portfolioStocks.filter((s: any) => s.ticker && s.ticker !== 'CASH');
        const weightedSeriesInputs = await Promise.all(
          weightedSeriesStocks.map(async (s: any) => ({
            ticker: s.ticker,
            weight: parseFloat(s.weight) || 0,
            prices: await toChfChartMap(pricesMap[s.ticker] || {}, stockCurrencies[s.ticker] || 'CHF'),
          }))
        );
        const weightedSeriesMap = new Map(
          computeWeightedReturnSeries(weightedSeriesInputs, sampledDates, ytdStartDate)
            .map((p) => [p.date, p.portfolio])
        );

        // Current cash weight for the optional total-portfolio (incl. cash) line.
        const chartInvestmentAmount = parseFloat((portfolio as any).investmentAmount || '0');
        const chartCashBalance = parseFloat((portfolio as any).cashBalance || '0');
        const chartStocksValueCHF = deriveStocksValueChf(
          weightedSeriesInputs.map((inp) => {
            const raw = weightedSeriesStocks.find((s: any) => s.ticker === inp.ticker);
            return {
              chfPrices: inp.prices,
              rawWeight: parseFloat(raw?.weight || '0'),
              shares: parseFloat(raw?.shares || '0') || undefined,
            };
          }),
          chartInvestmentAmount,
        );
        const { cashWeight: chartCashWeight } = applyCashDrag(0, chartStocksValueCHF, chartCashBalance);

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
          let missingPriceCount = 0;
          let totalHoldingsCount = 0;
          
          // Determine if we should use weight-based calculation
          // Use weight-based for:
          // 1. Test portfolios (always)
          // 2. Live portfolios BEFORE creation date (hypothetical performance)
          const useWeightBased = isTestPortfolio || (isLivePortfolio && allowHypotheticalPerformance && date < effectiveStartDate);
          
          if (useWeightBased) {
            // For test portfolios: calculate weighted average performance of all stocks
            let totalWeight = 0;
            let weightedPerformance = 0;
            let tickersWithPrice = 0;
            let tickersForwardFilled = 0;
            
            for (const [ticker, holding] of Object.entries(currentHoldings)) {
              const weight = holding.weight || 0;
              if (weight <= 0) continue;
              
              let currentPrice = pricesMap[ticker]?.[date] || 0;
              const startPrice = startingPricesCHF[ticker] || 0;
              
              // Forward-fill if no price for this date
              if (currentPrice === 0) {
                const tickerPrices = pricesMap[ticker] || {};
                const sortedPriceDates = Object.keys(tickerPrices).sort();
                for (const priceDate of sortedPriceDates) {
                  if (priceDate <= date && tickerPrices[priceDate] > 0) {
                    currentPrice = tickerPrices[priceDate];
                  }
                }
                if (currentPrice > 0) tickersForwardFilled++;
              } else {
                tickersWithPrice++;
              }
              
              if (currentPrice > 0 && startPrice > 0) {
                const currency = stockCurrencies[ticker] || 'CHF';
                const currentPriceCHF = convertToCHFCached(currentPrice, currency, date);
                const stockPerformance = ((currentPriceCHF - startPrice) / startPrice) * 100;
                
                // Limit individual stock performance to +/- 100% per period to avoid data errors
                const clampedPerformance = Math.max(-100, Math.min(200, stockPerformance));
                weightedPerformance += clampedPerformance * (weight / 100);
                totalWeight += weight;
              }
            }
            
            portfolioPerformance = totalWeight > 0 ? weightedPerformance : 0;
            
            // Track forward-fill ratio for data quality
            const totalTickers = tickersWithPrice + tickersForwardFilled;
            if (totalTickers > 0 && tickersForwardFilled / totalTickers > 0.5) {
              // More than 50% forward-filled, skip this data point
              continue;
            }
          } else {
            // For live portfolios: calculate based on actual holdings value
            let totalValueCHF = 0;
            // Track forward-filled prices for this date
            const forwardFilledPrices: Record<string, number> = {};
            
            for (const [ticker, holding] of Object.entries(currentHoldings)) {
              if (holding.shares <= 0) continue;
              totalHoldingsCount++;
              
              // Get price with forward-fill: use current date price, or last known price
              let price = pricesMap[ticker]?.[date] || 0;
              const hadDirectPrice = price > 0;
              
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
                if (!hadDirectPrice) {
                  missingPriceCount++;
                }
              }
              
              // Skip if still no price available
              if (price === 0) {
                missingPriceCount++;
                continue;
              }
              
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
          
          // Use the weighted per-stock series so the portfolio line is identical in
          // methodology to the displayed numbers. Falls back to the legacy value only
          // if the series has no entry for this date.
          if (weightedSeriesMap.has(date)) {
            portfolioPerformance = weightedSeriesMap.get(date) as number;
          }

          // Calculate benchmark performance from actual prices (with forward-fill)
          let benchmarkCurrentPrice = parseFloat(String(benchmarkMap[date] || 0));
          // Forward-fill: if no benchmark price for this date, use last known price
          if (benchmarkCurrentPrice === 0) {
            const sortedBmDates = Object.keys(benchmarkMap).sort();
            for (const bmDate of sortedBmDates) {
              if (bmDate <= date && benchmarkMap[bmDate] > 0) {
                benchmarkCurrentPrice = benchmarkMap[bmDate];
              }
            }
          }
          const benchmarkPerformance = benchmarkStartPrice > 0 && benchmarkCurrentPrice > 0
            ? ((benchmarkCurrentPrice - benchmarkStartPrice) / benchmarkStartPrice) * 100
            : 0;
          
          // The portfolio line comes from the weighted per-stock series, which already
          // forward-fills correctly and preserves legitimate large moves. No clamping or
          // daily-change smoothing here — that previously flattened extreme movers and
          // made the chart diverge from the displayed numbers.
          if (portfolioPerformance !== 0 || benchmarkPerformance !== 0) {
            chartData.push({
              date,
              portfolio: parseFloat(portfolioPerformance.toFixed(2)),
              portfolioInclCash: parseFloat((portfolioPerformance * (1 - chartCashWeight)).toFixed(2)),
              benchmark: parseFloat(benchmarkPerformance.toFixed(2)),
            });
          }
        }
        
        return { chartData };
      }),

    // Get hypothetical performance before portfolio creation date
    // This shows what the performance would have been if the portfolio existed earlier
    getHypotheticalPerformance: protectedProcedure
      .input(z.object({
        portfolioId: z.number().int().positive(),
        startDate: z.string(), // YYYY-MM-DD format (e.g., start of year)
        endDate: z.string(), // YYYY-MM-DD format (portfolio creation date)
        debug: z.boolean().optional(),
      }))
      .query(async ({ input, ctx }) => {
        const { portfolioId, startDate, endDate, debug } = input;
        const { getSavedPortfolioById, getPortfolioTransactions, getStockByTicker, getDb } = await import("../db");
        const { convertToCHF } = await import("../fxHelper");
        
        if (debug) {
          console.log('[getHypotheticalPerformance] DEBUG START', {
            portfolioId,
            startDate,
            endDate
          });
        }
        
        const portfolio = await getSavedPortfolioById(portfolioId, ctx.user.id);
        if (!portfolio) {
          if (debug) console.log('[getHypotheticalPerformance] Portfolio not found');
          return { chartData: [] };
        }
        
        // Get transactions to determine initial holdings
        const transactions = await getPortfolioTransactions(portfolioId);
        if (transactions.length === 0) {
          if (debug) console.log('[getHypotheticalPerformance] No transactions found');
          return { chartData: [] };
        }
        
        if (debug) {
          console.log('[getHypotheticalPerformance] Found transactions:', transactions.length);
        }
        
        // Get initial holdings (first buy transactions)
        const initialHoldings: Record<string, { shares: number; weight: number }> = {};
        let totalShares = 0;
        
        for (const tx of transactions) {
          if (tx.transactionType === 'buy' && tx.ticker) {
            if (!initialHoldings[tx.ticker]) {
              initialHoldings[tx.ticker] = { shares: 0, weight: 0 };
            }
            initialHoldings[tx.ticker].shares += parseFloat(tx.shares || "0");
            totalShares += parseFloat(tx.shares || "0");
          }
        }
        
        // Calculate weights based on initial shares
        const tickers = Object.keys(initialHoldings);
        for (const ticker of tickers) {
          initialHoldings[ticker].weight = (initialHoldings[ticker].shares / totalShares) * 100;
        }
        
        if (debug) {
          console.log('[getHypotheticalPerformance] Initial holdings:', initialHoldings);
          console.log('[getHypotheticalPerformance] Tickers:', tickers);
        }
        
        const db = await getDb();
        if (!db) return { chartData: [] };
        
        const { historicalPrices } = await import("../../drizzle/schema");
        const { eq, and, gte, lte, asc } = await import("drizzle-orm");
        
        // Get historical prices for all tickers
        const pricesMap: Record<string, Record<string, number>> = {};
        for (const ticker of tickers) {
          const prices = await db
            .select()
            .from(historicalPrices)
            .where(
              and(
                eq(historicalPrices.ticker, ticker),
                gte(historicalPrices.date, startDate),
                lte(historicalPrices.date, endDate)
              )
            )
            .orderBy(asc(historicalPrices.date));
          
          pricesMap[ticker] = {};
          prices.forEach((p: any) => {
            const price = parseFloat(p.close) || 0;
            if (price > 0) {
              pricesMap[ticker][p.date] = price;
            }
          });
          
          if (debug) {
            console.log(`[getHypotheticalPerformance] Prices for ${ticker}:`, {
              count: prices.length,
              firstDate: prices[0]?.date,
              lastDate: prices[prices.length - 1]?.date
            });
          }
        }
        
        // Get stock currencies
        const stockCurrencies: Record<string, string> = {};
        for (const ticker of tickers) {
          const stock = await getStockByTicker(ticker);
          stockCurrencies[ticker] = stock?.currency || 'CHF';
        }
        
        // Get all dates with price data
        const allDates = new Set<string>();
        Object.values(pricesMap).forEach(prices => {
          Object.keys(prices).forEach(date => allDates.add(date));
        });
        const sortedDates = Array.from(allDates).sort();
        
        // Calculate starting prices in CHF
        const startingPricesCHF: Record<string, number> = {};
        for (const ticker of tickers) {
          const tickerPrices = pricesMap[ticker] || {};
          const availableDates = Object.keys(tickerPrices).sort();
          const firstDate = availableDates[0] || startDate;
          const price = tickerPrices[firstDate] || 0;
          
          if (price > 0) {
            const currency = stockCurrencies[ticker] || 'CHF';
            const priceCHF = await convertToCHF(price, currency, firstDate);
            startingPricesCHF[ticker] = priceCHF;
          }
        }
        
        // Pre-calculate FX rates cache
        const fxRatesCache: Record<string, Record<string, number>> = {};
        const uniqueCurrencies = Array.from(new Set(Object.values(stockCurrencies)));
        
        for (const currency of uniqueCurrencies) {
          if (currency === 'CHF') continue;
          fxRatesCache[currency] = {};
          const firstDate = sortedDates[0] || startDate;
          const rate = await convertToCHF(1, currency, firstDate);
          for (const date of sortedDates) {
            fxRatesCache[currency][date] = rate;
          }
        }
        
        // W7/R-10: fehlender Kurs → 0 statt hartkodiertem 1:1-Fallback.
        const convertToCHFCached = (price: number, currency: string, date: string): number => {
          if (currency === 'CHF') return price;
          const rate = fxRatesCache[currency]?.[date] ?? 0;
          return price * rate;
        };

        // Sample dates to reduce data points
        const maxDataPoints = 100;
        const sampleInterval = Math.max(1, Math.floor(sortedDates.length / maxDataPoints));
        const sampledDates = sortedDates.filter((_, idx) => idx % sampleInterval === 0 || idx === sortedDates.length - 1);
        
        // Calculate hypothetical performance for each date
        const chartData: { date: string; performance: number }[] = [];
        
        for (const date of sampledDates) {
          let totalWeight = 0;
          let weightedPerformance = 0;
          
          for (const [ticker, holding] of Object.entries(initialHoldings)) {
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
          
          const performance = totalWeight > 0 ? weightedPerformance : 0;
          
          chartData.push({
            date,
            performance: parseFloat(performance.toFixed(2)),
          });
        }
        
        if (debug) {
          console.log('[getHypotheticalPerformance] DEBUG END', {
            chartDataLength: chartData.length,
            firstPoint: chartData[0],
            lastPoint: chartData[chartData.length - 1]
          });
        }
        
        return { chartData, creationDate: endDate };
      }),

    // Get multi-period performance for all portfolios (1M, 3M, 6M, YTD, 1Y)
    getPortfolioSparklineData: protectedProcedure
    .input(z.object({ portfolioId: z.number() }))
    .query(async ({ input, ctx }) => {
      const { getDb } = await import("../db");
      const { savedPortfolios, historicalPrices } = await import("../../drizzle/schema");
      const { eq, and, gte, lte, asc } = await import("drizzle-orm");
      
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
      
      const portfolio = await db.select().from(savedPortfolios).where(eq(savedPortfolios.id, input.portfolioId)).limit(1);
      if (!portfolio || portfolio.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Portfolio not found' });
      }
      
      const p = portfolio[0];
      const portfolioData = JSON.parse(p.portfolioData || '{}');
      const stocks = portfolioData.stocks || portfolioData.positions || [];
      
      if (stocks.length === 0) {
        return [];
      }
      
      // Get last 12 months of data
      const today = new Date();
      const oneYearAgo = new Date(today);
      oneYearAgo.setFullYear(today.getFullYear() - 1);
      const startDateStr = oneYearAgo.toISOString().split('T')[0];
      const todayStr = today.toISOString().split('T')[0];
      
      const tickers = stocks.map((stock: any) => stock.ticker);
      
      // Get historical prices for all tickers
      const pricesMap: Record<string, Record<string, number>> = {};
      for (const ticker of tickers) {
        const prices = await db
          .select()
          .from(historicalPrices)
          .where(
            and(
              eq(historicalPrices.ticker, ticker),
              gte(historicalPrices.date, startDateStr),
              lte(historicalPrices.date, todayStr)
            )
          )
          .orderBy(asc(historicalPrices.date));
        
        pricesMap[ticker] = {};
        prices.forEach((p: any) => {
          const price = parseFloat(p.close) || 0;
          if (price > 0) {
            pricesMap[ticker][p.date] = price;
          }
        });
      }
      
      // Get all unique dates
      const allDates = new Set<string>();
      Object.values(pricesMap).forEach(prices => {
        Object.keys(prices).forEach(date => allDates.add(date));
      });
      const sortedDates = Array.from(allDates).sort();
      
      // Calculate portfolio value for each date
      const sparklineData: { date: string; value: number }[] = [];
      let lastKnownPrices: Record<string, number> = {};
      
      for (const date of sortedDates) {
        let portfolioValue = 0;
        let hasAllPrices = true;
        
        for (const stock of stocks) {
          const ticker = stock.ticker;
          const quantity = parseFloat(String(stock.quantity || stock.shares || 0));
          
          // Get price for this date or use last known price
          let price = pricesMap[ticker]?.[date];
          if (!price && lastKnownPrices[ticker]) {
            price = lastKnownPrices[ticker];
          }
          
          if (price) {
            lastKnownPrices[ticker] = price;
            portfolioValue += quantity * price;
          } else {
            hasAllPrices = false;
          }
        }
        
        if (hasAllPrices && portfolioValue > 0) {
          sparklineData.push({ date, value: portfolioValue });
        }
      }
      
      // Sample to ~50 points for performance
      const step = Math.max(1, Math.floor(sparklineData.length / 50));
      const sampledData = sparklineData.filter((_, i) => i % step === 0);
      
      // Always include the last point
      if (sparklineData.length > 0 && sampledData[sampledData.length - 1] !== sparklineData[sparklineData.length - 1]) {
        sampledData.push(sparklineData[sparklineData.length - 1]);
      }
      
      return sampledData;
    }),

  getMultiPeriodPerformance: protectedProcedure
      .query(async ({ ctx }) => {
        const { getSavedPortfolios, getStockByTicker, getDb } = await import("../db");
        const { convertToCHF, getHistoricalPrice } = await import("../fxHelper");
        const { historicalPrices } = await import("../../drizzle/schema");
        const { eq, and, gte, lte } = await import("drizzle-orm");
        
        const portfolios = await getSavedPortfolios(ctx.user.id);
        const db = await getDb();
        if (!db) return [];
        
        const todayStr = new Date().toISOString().split('T')[0];
        const now = new Date();
        
        // Calculate period start dates
        const periodStartDates: Record<string, string> = {
          '1M': new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().split('T')[0],
          '3M': new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString().split('T')[0],
          '6M': new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()).toISOString().split('T')[0],
          'YTD': `${now.getFullYear()}-01-01`,
          '1Y': new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().split('T')[0],
        };
        
        // Get benchmark (SPY) prices for all periods
        // Use direct database query to get benchmark prices from historicalPrices table
        const benchmarkTicker = 'SPY';
        const benchmarkPrices: Record<string, number> = {};
        
        // Get current benchmark price from historicalPrices (latest available)
        // Note: historicalPrices, eq, and, gte, lte are already imported above
        const { desc, asc } = await import("drizzle-orm");
        
        // Get the latest available benchmark price
        const [latestBenchmarkPrice] = await db
          .select()
          .from(historicalPrices)
          .where(eq(historicalPrices.ticker, benchmarkTicker))
          .orderBy(desc(historicalPrices.date))
          .limit(1);
        
        const benchmarkCurrentPrice = latestBenchmarkPrice ? parseFloat(latestBenchmarkPrice.close || '0') : 0;
        benchmarkPrices['current'] = benchmarkCurrentPrice;
        console.log(`[getMultiPeriodPerformance] Latest benchmark price for ${benchmarkTicker}: ${benchmarkCurrentPrice} on ${latestBenchmarkPrice?.date}`);
        
        // Get historical benchmark prices for each period
        for (const [period, startDate] of Object.entries(periodStartDates)) {
          // Find the closest price at or after the start date
          const [historicalPrice] = await db
            .select()
            .from(historicalPrices)
            .where(
              and(
                eq(historicalPrices.ticker, benchmarkTicker),
                gte(historicalPrices.date, startDate)
              )
            )
            .orderBy(asc(historicalPrices.date))
            .limit(1);
          
          if (historicalPrice && historicalPrice.close) {
            benchmarkPrices[period] = parseFloat(historicalPrice.close);
          } else {
            // Fallback: try to find the closest price before the start date
            const [fallbackPrice] = await db
              .select()
              .from(historicalPrices)
              .where(
                and(
                  eq(historicalPrices.ticker, benchmarkTicker),
                  lte(historicalPrices.date, startDate)
                )
              )
              .orderBy(desc(historicalPrices.date))
              .limit(1);
            
            benchmarkPrices[period] = fallbackPrice ? parseFloat(fallbackPrice.close || '0') : benchmarkCurrentPrice;
          }
          console.log(`[getMultiPeriodPerformance] Benchmark price for ${period} (${startDate}): ${benchmarkPrices[period]}`);
        }
        
        // Calculate benchmark performance for each period
        const benchmarkPerformance: Record<string, number> = {};
        for (const period of Object.keys(periodStartDates)) {
          const startPrice = benchmarkPrices[period];
          if (startPrice > 0 && benchmarkCurrentPrice > 0) {
            benchmarkPerformance[period] = ((benchmarkCurrentPrice - startPrice) / startPrice) * 100;
          } else {
            benchmarkPerformance[period] = 0;
          }
        }
        
        // DEBUG: Log benchmark performance
        console.log('[getMultiPeriodPerformance] Benchmark SPY prices:', benchmarkPrices);
        console.log('[getMultiPeriodPerformance] Benchmark performance:', benchmarkPerformance);
        
        // Calculate performance for each portfolio
        const results = await Promise.all(
          portfolios.map(async (portfolio) => {
            try {
              const portfolioData = JSON.parse(portfolio.portfolioData || '{}');
              const stocks = portfolioData.stocks || portfolioData.positions || [];
              
              if (stocks.length === 0) {
                return {
                  portfolioId: portfolio.id,
                  performance: { '1M': 0, '3M': 0, '6M': 0, 'YTD': 0, '1Y': 0 },
                  benchmarkPerformance,
                  outperformance: { '1M': 0, '3M': 0, '6M': 0, 'YTD': 0, '1Y': 0 },
                };
              }
              
              // Calculate portfolio value at different time points
              const investmentAmount = parseFloat(portfolio.investmentAmount || '0');
              const cashBalance = parseFloat(portfolio.cashBalance?.toString() || '0');
              
              // Calculate current total value (stocks + cash)
              let currentTotalValue = cashBalance;
              for (const stock of stocks) {
                if (stock.ticker && stock.ticker !== 'CASH') {
                  const stockData = await getStockByTicker(stock.ticker);
                  if (!stockData) continue;
                  
                  const currentPrice = safeParseFloat(stockData.currentPrice);
                  const currency = stockData.currency || 'CHF';
                  const weight = parseFloat(stock.weight || '0') / 100;
                  
                  // Calculate shares from weight and investment amount
                  let shares = parseFloat(stock.shares || '0');
                  if (shares === 0 && investmentAmount > 0 && weight > 0) {
                    const allocationCHF = investmentAmount * weight;
                    const priceCHF = await convertToCHF(currentPrice, currency, todayStr);
                    shares = priceCHF > 0 ? allocationCHF / priceCHF : 0;
                  }
                  
                  // Calculate current value in CHF
                  const currentPriceCHF = await convertToCHF(currentPrice, currency, todayStr);
                  currentTotalValue += shares * currentPriceCHF;
                }
              }
              
              // Calculate performance for each period
              const portfolioPerformance: Record<string, number> = {};
              
              for (const [period, startDate] of Object.entries(periodStartDates)) {
                // Calculate historical total value (stocks + cash)
                let historicalTotalValue = cashBalance;
                
                for (const stock of stocks) {
                  if (stock.ticker && stock.ticker !== 'CASH') {
                    const stockData = await getStockByTicker(stock.ticker);
                    if (!stockData) continue;
                    
                    const currentPrice = safeParseFloat(stockData.currentPrice);
                    const currency = stockData.currency || 'CHF';
                    const weight = parseFloat(stock.weight || '0') / 100;
                    
                    // Calculate shares (same as current)
                    let shares = parseFloat(stock.shares || '0');
                    if (shares === 0 && investmentAmount > 0 && weight > 0) {
                      const allocationCHF = investmentAmount * weight;
                      const priceCHF = await convertToCHF(currentPrice, currency, todayStr);
                      shares = priceCHF > 0 ? allocationCHF / priceCHF : 0;
                    }
                    
                    // Get historical price for this period
                    const historicalPrice = await getHistoricalPrice(stock.ticker, startDate);
                    // If historical price is missing, use current price (0% performance for this stock)
                    const priceToUse = (historicalPrice && historicalPrice > 0) ? historicalPrice : currentPrice;
                    
                    // Calculate historical value in CHF
                    const historicalPriceCHF = await convertToCHF(priceToUse, currency, startDate);
                    historicalTotalValue += shares * historicalPriceCHF;
                  }
                }
                
                // Calculate performance as total value change
                if (historicalTotalValue > 0) {
                  portfolioPerformance[period] = ((currentTotalValue - historicalTotalValue) / historicalTotalValue) * 100;
                } else {
                  portfolioPerformance[period] = 0;
                }
              }
              
              // Calculate outperformance
              const outperformance: Record<string, number> = {};
              for (const period of Object.keys(periodStartDates)) {
                outperformance[period] = portfolioPerformance[period] - benchmarkPerformance[period];
              }
              
              return {
                portfolioId: portfolio.id,
                performance: portfolioPerformance,
                benchmarkPerformance,
                outperformance,
              };
            } catch (error) {
              console.error(`Error calculating multi-period performance for portfolio ${portfolio.id}:`, error);
              return {
                portfolioId: portfolio.id,
                performance: { '1M': 0, '3M': 0, '6M': 0, 'YTD': 0, '1Y': 0 },
                benchmarkPerformance,
                outperformance: { '1M': 0, '3M': 0, '6M': 0, 'YTD': 0, '1Y': 0 },
              };
            }
          })
        );
        
        return results;
      }),

    // V2: Get multi-period performance using the same logic as getHistoricalPerformance
    // This ensures consistency between overview and detail pages
    /**
     * TTWROR + IRR Performance Metrics for a single portfolio
     * Replaces the old weight-based approximation with proper TTWROR calculation
     */
    getPerformanceMetrics: protectedProcedure
      .input(z.object({
        portfolioId: z.number().int().positive(),
        range: z.enum(['1M', '3M', '6M', 'YTD', '1J', '3J', '5J', 'Max']).default('YTD'),
      }))
      .query(async ({ ctx, input }) => {
        const { portfolioId, range } = input;
        const { getSavedPortfolioById } = await import('../db');
        const { calculatePortfolioPerformance } = await import('../lib/performanceService');

        // Verify portfolio belongs to user
        const portfolio = await getSavedPortfolioById(portfolioId, ctx.user.id);
        if (!portfolio) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Portfolio not found' });
        }

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        // Calculate start date based on range
        let startDate: string;
        switch (range) {
          case '1M':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().split('T')[0];
            break;
          case '3M':
            startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString().split('T')[0];
            break;
          case '6M':
            startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()).toISOString().split('T')[0];
            break;
          case '1J':
            startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().split('T')[0];
            break;
          case '3J':
            startDate = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate()).toISOString().split('T')[0];
            break;
          case '5J':
            startDate = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate()).toISOString().split('T')[0];
            break;
          case 'Max':
            startDate = '2000-01-01';
            break;
          case 'YTD':
          default:
            startDate = `${now.getFullYear()}-01-01`;
            break;
        }

        try {
          const result = await calculatePortfolioPerformance({
            portfolioId,
            startDate,
            endDate: todayStr,
          });

          return {
            ttwror: result.ttwror.totalReturn,
            annualizedTtwror: result.ttwror.annualizedReturn,
            irr: result.irr.annualizedIRR,
            absoluteGainCHF: result.absoluteGainCHF,
            currentValueCHF: result.currentValueCHF,
            totalInvestedCHF: result.totalInvestedCHF,
            periodDays: result.ttwror.periodDays,
            dailySeries: result.dailySeries,
            converged: result.irr.converged,
          };
        } catch (err) {
          console.error(`[portfolios.getPerformanceMetrics] Error for portfolio ${portfolioId}:`, err);
          return {
            ttwror: 0,
            annualizedTtwror: 0,
            irr: 0,
            absoluteGainCHF: 0,
            currentValueCHF: 0,
            totalInvestedCHF: 0,
            periodDays: 0,
            dailySeries: [],
            converged: false,
          };
        }
      }),

    /**
     * TTWROR-based multi-period performance for ALL user portfolios
     * Replaces the old weight-based getMultiPeriodPerformanceV2
     */
    getMultiPeriodPerformanceV2: protectedProcedure.query(async ({ ctx }) => {
      const { getSavedPortfolios, getSavedPortfolioById, getPortfolioTransactions, getStockByTicker, getDb } = await import("../db");
      const { convertToCHF, getFxRate } = await import("../fxHelper");
      const { historicalPrices } = await import("../../drizzle/schema");
      const { eq, and, gte, lte, asc, desc } = await import("drizzle-orm");

      // Reporting currency is CHF: convert local-currency price maps to CHF (per-date
      // FX) via the shared performanceCore helper. All performance numbers below are CHF.
      const toChfPriceMap = (priceMap: Record<string, number>, currency: string) =>
        toChfPriceMapCore(priceMap, currency, getFxRate);

      const portfolios = await getSavedPortfolios(ctx.user.id);
      const db = await getDb();
      if (!db) return [];
      
      const todayStr = new Date().toISOString().split('T')[0];
      const now = new Date();
      
      // Calculate period start dates
      const periods = ['1M', '3M', '6M', 'YTD', '1Y'] as const;
      const periodStartDates: Record<string, string> = {
        '1M': new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().split('T')[0],
        '3M': new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString().split('T')[0],
        '6M': new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()).toISOString().split('T')[0],
        'YTD': `${now.getFullYear()}-01-01`,
        '1Y': new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().split('T')[0],
      };
      
      // UX2-4 (Audit 2026-07): Benchmark SPI (CHSPI.SW) statt SPY — das Dashboard
      // vergleicht gegen den SPI; die Portfolio-Details zeigten bisher S&P 500.
      // Eine Benchmark für beide Ansichten, passend zur CHF-Referenzwährung.
      const benchmarkTicker = 'CHSPI.SW';
      const benchmarkPrices: Record<string, number> = {};

      // Get the latest available benchmark price
      const [latestBenchmarkPrice] = await db
        .select()
        .from(historicalPrices)
        .where(eq(historicalPrices.ticker, benchmarkTicker))
        .orderBy(desc(historicalPrices.date))
        .limit(1);

      // CHSPI.SW ist in CHF quotiert — keine FX-Umrechnung nötig; toChf bleibt
      // als Hülle für einen allfälligen späteren Benchmark-Wechsel.
      const benchmarkCurrency = 'CHF';
      const toChf = async (price: number, date: string | null | undefined): Promise<number> => {
        if (!(price > 0) || !date || benchmarkCurrency === 'CHF') return price;
        return price * (await getFxRate(date, `${benchmarkCurrency}CHF`));
      };

      const benchmarkCurrentPrice = latestBenchmarkPrice
        ? await toChf(parseFloat(latestBenchmarkPrice.close || '0'), latestBenchmarkPrice.date)
        : 0;
      benchmarkPrices['current'] = benchmarkCurrentPrice;

      // Get historical benchmark prices for each period
      for (const [period, startDate] of Object.entries(periodStartDates)) {
        const [historicalPrice] = await db
          .select()
          .from(historicalPrices)
          .where(
            and(
              eq(historicalPrices.ticker, benchmarkTicker),
              gte(historicalPrices.date, startDate)
            )
          )
          .orderBy(asc(historicalPrices.date))
          .limit(1);

        if (historicalPrice && historicalPrice.close) {
          benchmarkPrices[period] = await toChf(parseFloat(historicalPrice.close), historicalPrice.date);
        } else {
          const [fallbackPrice] = await db
            .select()
            .from(historicalPrices)
            .where(
              and(
                eq(historicalPrices.ticker, benchmarkTicker),
                lte(historicalPrices.date, startDate)
              )
            )
            .orderBy(desc(historicalPrices.date))
            .limit(1);

          benchmarkPrices[period] = fallbackPrice
            ? await toChf(parseFloat(fallbackPrice.close || '0'), fallbackPrice.date)
            : benchmarkCurrentPrice;
        }
      }
      
      // Calculate benchmark performance for each period
      const benchmarkPerformance: Record<string, number> = {};
      for (const period of periods) {
        const startPrice = benchmarkPrices[period];
        if (startPrice > 0 && benchmarkCurrentPrice > 0) {
          benchmarkPerformance[period] = ((benchmarkCurrentPrice - startPrice) / startPrice) * 100;
        } else {
          benchmarkPerformance[period] = 0;
        }
      }
      
      // Calculate performance for each portfolio using weight-based approach
      const results = await Promise.all(
        portfolios.map(async (portfolio) => {
          try {
            const portfolioData = JSON.parse(portfolio.portfolioData || '{}');
            const stocks = portfolioData.stocks || portfolioData.positions || [];
            
            if (stocks.length === 0) {
              return {
                portfolioId: portfolio.id,
                performance: { '1M': 0, '3M': 0, '6M': 0, 'YTD': 0, '1Y': 0 },
                performanceInclCash: { '1M': 0, '3M': 0, '6M': 0, 'YTD': 0, '1Y': 0 },
                cashWeight: 0,
                benchmarkPerformance,
                outperformance: { '1M': 0, '3M': 0, '6M': 0, 'YTD': 0, '1Y': 0 },
              };
            }
            
            // Get stock data and prices
            const stockData: Record<string, { currency: string; weight: number }> = {};
            const stockPrices: Record<string, Record<string, number>> = {};
            
            // Calculate total weight for normalization
            let totalWeight = 0;
            for (const stock of stocks) {
              if (stock.ticker && stock.ticker !== 'CASH') {
                totalWeight += parseFloat(stock.weight || '0');
              }
            }

            // For the optional cash-drag (total-portfolio) figure we need the current
            // CHF stock value and the cash balance. Cash is held separately as an
            // absolute amount (portfolio.cashBalance).
            const investmentAmount = parseFloat(portfolio.investmentAmount || '0');
            const cashBalance = parseFloat(portfolio.cashBalance || '0');
            let stocksValueCHF = 0;

            for (const stock of stocks) {
              if (!stock.ticker || stock.ticker === 'CASH') continue;
              
              const ticker = stock.ticker;
              const weight = totalWeight > 0 ? parseFloat(stock.weight || '0') / totalWeight : 0;
              
              const stockInfo = await getStockByTicker(ticker);
              stockData[ticker] = {
                currency: stockInfo?.currency || 'CHF',
                weight: weight
              };
              
              // Get all historical prices for this stock
              const earliestStartDate = periodStartDates['1Y']; // Get prices from 1Y ago
              const prices = await db
                .select()
                .from(historicalPrices)
                .where(
                  and(
                    eq(historicalPrices.ticker, ticker),
                    gte(historicalPrices.date, earliestStartDate)
                  )
                )
                .orderBy(asc(historicalPrices.date));
              
              const localPrices: Record<string, number> = {};
              for (const p of prices) {
                localPrices[p.date] = parseFloat(p.close || '0');
              }
              // Convert to CHF so the weighted return is a true CHF return (incl. FX).
              stockPrices[ticker] = await toChfPriceMap(localPrices, stockData[ticker].currency);
            }

            // Current CHF stock value (for the optional cash-drag figure).
            stocksValueCHF = deriveStocksValueChf(
              stocks
                .filter((s: any) => s.ticker && s.ticker !== 'CASH')
                .map((s: any) => ({
                  chfPrices: stockPrices[s.ticker] || {},
                  rawWeight: parseFloat(s.weight || '0'),
                  shares: parseFloat(s.shares || '0') || undefined,
                })),
              investmentAmount,
            );

            // Calculate performance for each period
            const portfolioPerformance: Record<string, number> = {};
            
            for (const period of periods) {
              const startDate = periodStartDates[period];
              
              // Calculate weighted performance
              let weightedPerformance = 0;
              let totalWeightUsed = 0;
              
              for (const [ticker, data] of Object.entries(stockData)) {
                const prices = stockPrices[ticker] || {};
                const priceDates = Object.keys(prices).sort();
                
                if (priceDates.length === 0) continue;
                
                // Find start price (first price at or after start date)
                let startPrice = 0;
                for (const date of priceDates) {
                  if (date >= startDate) {
                    startPrice = prices[date];
                    break;
                  }
                }
                
                // If no price found at or after start date, use earliest available
                if (startPrice === 0 && priceDates.length > 0) {
                  startPrice = prices[priceDates[0]];
                }
                
                // Find end price (latest available price)
                const endPrice = prices[priceDates[priceDates.length - 1]] || 0;
                
                if (startPrice > 0 && endPrice > 0) {
                  const stockPerformance = ((endPrice - startPrice) / startPrice) * 100;
                  weightedPerformance += stockPerformance * data.weight;
                  totalWeightUsed += data.weight;
                }
              }
              
              // Normalize if not all weights were used
              if (totalWeightUsed > 0) {
                portfolioPerformance[period] = weightedPerformance / totalWeightUsed;
              } else {
                portfolioPerformance[period] = 0;
              }
            }
            
            // Calculate outperformance
            const outperformance: Record<string, number> = {};
            for (const period of periods) {
              outperformance[period] = portfolioPerformance[period] - benchmarkPerformance[period];
            }

            // Total-portfolio variant including cash drag (cash assumed 0% return).
            const performanceInclCash: Record<string, number> = {};
            let cashWeight = 0;
            for (const period of periods) {
              const adj = applyCashDrag(portfolioPerformance[period], stocksValueCHF, cashBalance);
              performanceInclCash[period] = adj.inclCashPct;
              cashWeight = adj.cashWeight;
            }

            return {
              portfolioId: portfolio.id,
              performance: portfolioPerformance,
              performanceInclCash,
              cashWeight,
              benchmarkPerformance,
              outperformance,
            };
          } catch (error) {
            console.error(`Error calculating V2 multi-period performance for portfolio ${portfolio.id}:`, error);
            return {
              portfolioId: portfolio.id,
              performance: { '1M': 0, '3M': 0, '6M': 0, 'YTD': 0, '1Y': 0 },
              performanceInclCash: { '1M': 0, '3M': 0, '6M': 0, 'YTD': 0, '1Y': 0 },
              cashWeight: 0,
              benchmarkPerformance,
              outperformance: { '1M': 0, '3M': 0, '6M': 0, 'YTD': 0, '1Y': 0 },
            };
          }
        })
      );
      
      return results;
    }),

});
