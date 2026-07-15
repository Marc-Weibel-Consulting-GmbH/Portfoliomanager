/**
 * portfolioEnrichment.ts
 * =====================
 * Shared helper: returns the same enriched stock list that the Positionen tab
 * uses (portfolios.getWithCurrency → enrichedStocks).
 *
 * This ensures that any view that needs live positions + weights (e.g. Deep Dive,
 * Copilot) always shows the same data as the Positionen tab.
 */

import { getSavedPortfolioById, getStocksByTickers, getStockByTicker, getPortfolioTransactions } from '../db';
import { getStockCurrency, tryConvertToCHF, getHistoricalPrice } from '../fxHelper';
import { calculateStockScore } from '../scoring';

function safeParseFloat(v: any): number {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function parseNum(v: any): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = parseFloat(String(v));
  return isNaN(n) ? undefined : n;
}

/**
 * Returns the enriched stocks for a portfolio, identical to what
 * `portfolios.getWithCurrency` returns as `enrichedStocks`.
 *
 * Each stock has:
 *   ticker, companyName, sector, shares, weight (live %), totalValue (CHF),
 *   priceCHF, currentPrice, currency, fxRate, avgBuyPrice, totalReturn, etc.
 */
export async function getEnrichedPortfolioStocks(
  portfolioId: number,
  userId: number | string
): Promise<any[]> {
  const portfolio = await getSavedPortfolioById(portfolioId, typeof userId === 'string' ? parseInt(userId, 10) : userId);
  if (!portfolio) return [];

  // Build per-ticker avg buy price maps from transactions
  const avgBuyPriceLocalMap = new Map<string, number>();
  const avgFxRateAtPurchaseMap = new Map<string, number>();
  try {
    const transactions = await getPortfolioTransactions(portfolioId);
    const buyTxs = (transactions as any[]).filter(
      (t: any) => t.transactionType === 'buy' || t.transactionType === 'entry'
    );
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
        avgFxRateAtPurchaseMap.set(tk, data.totalCostLocal > 0 ? data.totalCostCHF / data.totalCostLocal : 1);
      }
    }
  } catch { /* non-critical */ }

  // Parse portfolioData
  let portfolioData: { stocks: any[] } = { stocks: [] };
  try {
    portfolioData = JSON.parse((portfolio as any).portfolioData || '{}');
  } catch { /* ignore */ }

  const todayStr = new Date().toISOString().split('T')[0];
  const stocksWithoutCash = (portfolioData.stocks || []).filter((s: any) => s.ticker !== 'CASH');
  const allTickers = stocksWithoutCash.map((s: any) => s.ticker);
  const dbStockMap = await getStocksByTickers(allTickers);

  const enrichedStocks = await Promise.all(
    stocksWithoutCash.map(async (stock: any) => {
      const ticker = stock.ticker;
      const dbStock = dbStockMap.get(ticker) || await getStockByTicker(ticker);
      const currency = dbStock?.currency || await getStockCurrency(ticker);
      const currentPrice = safeParseFloat(dbStock?.currentPrice || stock.currentPrice);
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

      const stockCount = portfolioData.stocks?.length || 1;
      const defaultWeight = 100 / stockCount;
      const rawWeight = stock.portfolioWeight || stock.weight || defaultWeight;
      const weight = typeof rawWeight === 'number' ? rawWeight : parseFloat(String(rawWeight)) || defaultWeight;

      let shares = parseFloat(stock.shares) || 0;
      if (shares === 0 && (portfolio as any).investmentAmount && priceCHF > 0) {
        const investmentAmount = parseFloat((portfolio as any).investmentAmount) || 0;
        const allocationAmount = investmentAmount * (weight / 100);
        shares = allocationAmount / priceCHF;
      }

      const storedAvgBuyPrice = parseFloat(stock.avgBuyPrice) || 0;
      const storedAvgBuyPriceCHF = parseFloat(stock.avgBuyPriceCHF) || 0;
      let avgBuyPriceCHF: number;
      if (storedAvgBuyPriceCHF > 0) {
        avgBuyPriceCHF = storedAvgBuyPriceCHF;
      } else if (storedAvgBuyPrice > 0) {
        const isDemo = (portfolio as any).portfolioType === 'demo' || !(portfolio as any).portfolioType;
        if (currency === 'CHF' || isDemo) {
          avgBuyPriceCHF = storedAvgBuyPrice;
        } else {
          avgBuyPriceCHF = storedAvgBuyPrice * fxRate;
        }
      } else {
        const txAvgLocal = avgBuyPriceLocalMap.get(ticker);
        const txFxRate = avgFxRateAtPurchaseMap.get(ticker);
        if (txAvgLocal && txAvgLocal > 0) {
          avgBuyPriceCHF = txAvgLocal * (txFxRate ?? fxRate);
        } else {
          avgBuyPriceCHF = priceCHF;
        }
      }

      const totalValue = shares * priceCHF;

      return {
        ...stock,
        currency,
        fxRate,
        currentPrice,
        currentPriceLocal: currentPrice,
        priceCHF,
        currentPriceCHF: priceCHF,
        priceMissing,
        fxMissing,
        weight: parseFloat(weight.toFixed(2)),
        shares: shares.toFixed(2),
        avgBuyPrice: avgBuyPriceCHF.toFixed(2),
        totalValue: totalValue.toFixed(2),
        valueCHF: totalValue,
        sector: dbStock?.sector || stock.sector || 'Other',
        companyName: dbStock?.companyName || stock.companyName || ticker,
        category: dbStock?.category || stock.category || 'Aktien',
        peRatio: dbStock?.peRatio ?? stock.peRatio ?? null,
        pegRatio: dbStock?.pegRatio ?? stock.pegRatio ?? null,
        marketCap: dbStock?.marketCap ?? stock.marketCap ?? null,
        beta: dbStock?.beta ?? stock.beta ?? null,
        volatility: dbStock?.volatility ?? stock.volatility ?? null,
        sharpeRatio: dbStock?.sharpeRatio ?? stock.sharpeRatio ?? null,
        dividendYield: dbStock?.dividendYield || stock.dividendYield || '0',
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

  // Calculate total portfolio value (stocks only, no cash for weight calculation)
  let totalValueCHF = enrichedStocks.reduce(
    (sum: number, s: any) => sum + (parseFloat(s.shares || 0) * (s.priceCHF || 0)),
    0
  );

  // Add cash to total for weight calculation
  const cashBalance = (portfolio as any).cashBalance == null
    ? 0
    : typeof (portfolio as any).cashBalance === 'number'
      ? (portfolio as any).cashBalance
      : Number((portfolio as any).cashBalance);
  totalValueCHF += cashBalance;

  // Recalculate live weights
  enrichedStocks.forEach((stock: any) => {
    const stockValue = parseFloat(stock.shares || 0) * (stock.priceCHF || 0);
    stock.weight = totalValueCHF > 0 ? (stockValue / totalValueCHF) * 100 : 0;
  });

  return enrichedStocks;
}
