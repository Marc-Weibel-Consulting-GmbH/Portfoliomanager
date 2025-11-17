import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";

export const realizedGainsHistoryRouter = router({
  getAll: protectedProcedure
    .input((val: unknown) => {
      if (typeof val === "object" && val !== null && "portfolioId" in val && typeof val.portfolioId === "number") {
        return val as { portfolioId: number };
      }
      throw new Error("Invalid portfolioId");
    })
    .query(async ({ input, ctx }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { realizedGains, portfolioTransactions, stocks } = await import("../../drizzle/schema");
      const { eq, and, desc } = await import("drizzle-orm");

      // Get all realized gains for this portfolio with transaction details
      const gains = await db
        .select({
          id: realizedGains.id,
          portfolioId: realizedGains.portfolioId,
          transactionId: realizedGains.transactionId,
          ticker: realizedGains.ticker,
          shares: realizedGains.shares,
          avgCostBasis: realizedGains.avgCostBasis,
          sellPrice: realizedGains.sellPrice,
          realizedGain: realizedGains.realizedGain,
          realizedGainPercent: realizedGains.realizedGainPercent,
          transactionDate: realizedGains.transactionDate,
          stockGainLocal: realizedGains.stockGainLocal,
          fxGain: realizedGains.fxGain,
          currency: realizedGains.currency,
          buyFxRate: realizedGains.buyFxRate,
          sellFxRate: realizedGains.sellFxRate,
          sellFees: portfolioTransactions.fees,
        })
        .from(realizedGains)
        .leftJoin(portfolioTransactions, eq(realizedGains.transactionId, portfolioTransactions.id))
        .where(eq(realizedGains.portfolioId, input.portfolioId))
        .orderBy(desc(realizedGains.transactionDate));

      // Get buy fees for each ticker (sum of all buy transaction fees)
      const buyFeesMap = new Map<string, number>();
      const buyTransactions = await db
        .select({
          ticker: portfolioTransactions.ticker,
          fees: portfolioTransactions.fees,
        })
        .from(portfolioTransactions)
        .where(
          and(
            eq(portfolioTransactions.portfolioId, input.portfolioId),
            eq(portfolioTransactions.transactionType, "buy")
          )
        );

      buyTransactions.forEach(tx => {
        if (tx.ticker) {
          const currentFees = buyFeesMap.get(tx.ticker) || 0;
          buyFeesMap.set(tx.ticker, currentFees + parseFloat(tx.fees || "0"));
        }
      });

      // Get stock names
      const tickers = Array.from(new Set(gains.map(g => g.ticker)));
      const stockNames = new Map<string, string>();
      
      for (const ticker of tickers) {
        const [stock] = await db
          .select({ companyName: stocks.companyName })
          .from(stocks)
          .where(eq(stocks.ticker, ticker))
          .limit(1);
        
        if (stock) {
          stockNames.set(ticker, stock.companyName);
        }
      }

      // Calculate net profit for each gain
      const result = gains.map(gain => {
        const sellFees = parseFloat(gain.sellFees || "0");
        const buyFees = buyFeesMap.get(gain.ticker) || 0;
        const totalFees = buyFees + sellFees;
        const totalGain = parseFloat(gain.realizedGain || "0");
        const netProfit = totalGain - totalFees;

        return {
          id: gain.id,
          transactionDate: gain.transactionDate,
          ticker: gain.ticker,
          stockName: stockNames.get(gain.ticker) || gain.ticker,
          shares: parseFloat(gain.shares || "0"),
          avgCostBasis: parseFloat(gain.avgCostBasis || "0"),
          sellPrice: parseFloat(gain.sellPrice || "0"),
          stockGainLocal: parseFloat(gain.stockGainLocal || "0"),
          fxGain: parseFloat(gain.fxGain || "0"),
          totalGain,
          currency: gain.currency || "CHF",
          buyFxRate: parseFloat(gain.buyFxRate || "1"),
          sellFxRate: parseFloat(gain.sellFxRate || "1"),
          buyFees,
          sellFees,
          totalFees,
          netProfit,
          realizedGainPercent: parseFloat(gain.realizedGainPercent || "0"),
        };
      });

      return result;
    }),
  
  // Debug endpoint for performance calculations
  debugPerformance: protectedProcedure
    .input(z.object({ portfolioId: z.number() }))
    .query(async ({ input, ctx }) => {
      const { getSavedPortfolioById, getPortfolioTransactions } = await import("../db");
      
      const portfolio = await getSavedPortfolioById(input.portfolioId, ctx.user.id);
      if (!portfolio) {
        throw new Error("Portfolio not found");
      }
      
      const transactions = await getPortfolioTransactions(input.portfolioId);
      const livePerf = null; // Function removed - performance calculated inline
      
      // Calculate holdings step by step
      const holdings: Record<string, any> = {};
      const steps: string[] = [];
      
      transactions.forEach((tx: any, index: number) => {
        if (!tx.ticker) return;
        
        if (!holdings[tx.ticker]) {
          holdings[tx.ticker] = { 
            shares: 0, 
            totalInvestedCHF: 0, 
            totalBought: 0, 
            avgBuyPrice: 0 
          };
        }
        
        const shares = parseFloat(tx.shares || '0');
        const price = parseFloat(tx.pricePerShare || '0');
        const amount = shares * price;
        const amountCHF = parseFloat(tx.totalAmountCHF || '0');
        const fxRate = parseFloat(tx.fxRate || '1');
        
        if (tx.transactionType === 'buy') {
          const before = { ...holdings[tx.ticker] };
          holdings[tx.ticker].shares += shares;
          holdings[tx.ticker].totalBought += shares;
          holdings[tx.ticker].totalInvested += amount;
          holdings[tx.ticker].avgBuyPrice = holdings[tx.ticker].totalInvested / holdings[tx.ticker].totalBought;
          
          steps.push(
            `TX${index + 1}: BUY ${tx.ticker} | ` +
            `${shares} shares @ ${price} ${tx.currency || 'CHF'} = ${amount.toFixed(2)} | ` +
            `FX ${fxRate} → CHF ${amountCHF.toFixed(2)} | ` +
            `Before: ${before.shares} shares, invested ${before.totalInvested.toFixed(2)} | ` +
            `After: ${holdings[tx.ticker].shares} shares, invested ${holdings[tx.ticker].totalInvested.toFixed(2)}, avg ${holdings[tx.ticker].avgBuyPrice.toFixed(2)}`
          );
        } else if (tx.transactionType === 'sell') {
          const before = { ...holdings[tx.ticker] };
          const costBasis = shares * holdings[tx.ticker].avgBuyPrice;
          holdings[tx.ticker].shares -= shares;
          holdings[tx.ticker].totalInvested -= costBasis;
          
          steps.push(
            `TX${index + 1}: SELL ${tx.ticker} | ` +
            `${shares} shares @ ${price} ${tx.currency || 'CHF'} = ${amount.toFixed(2)} | ` +
            `FX ${fxRate} → CHF ${amountCHF.toFixed(2)} | ` +
            `Cost basis: ${costBasis.toFixed(2)} (${shares} × ${before.avgBuyPrice.toFixed(2)}) | ` +
            `Before: ${before.shares} shares, invested ${before.totalInvested.toFixed(2)} | ` +
            `After: ${holdings[tx.ticker].shares} shares, invested ${holdings[tx.ticker].totalInvested.toFixed(2)}`
          );
        }
      });
      
      // Calculate totals
      let totalInvestedCalc = 0;
      Object.values(holdings).forEach((h: any) => {
        if (h.shares > 0) {
          totalInvestedCalc += h.totalInvested;
        }
      });
      
      steps.push('');
      steps.push('=== SUMMARY ===');
      steps.push(`Total invested (calculated): ${totalInvestedCalc.toFixed(2)}`);
      steps.push(`Total invested (livePerf): ${livePerf.totalInvested.toFixed(2)}`);
      steps.push(`Current value (livePerf): ${livePerf.currentValue.toFixed(2)}`);
      steps.push(`Unrealized gains (livePerf): ${livePerf.unrealizedGains.toFixed(2)}`);
      steps.push(`Performance (livePerf): ${livePerf.returnOnInvestment.toFixed(2)}%`);
      
      return {
        steps,
        holdings,
        livePerf,
        totalInvestedCalc,
        transactionCount: transactions.length
      };
    }),
});
