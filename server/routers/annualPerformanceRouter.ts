import { router, protectedProcedure } from "../_core/trpc";

export const annualPerformanceRouter = router({
  getSummary: protectedProcedure
    .input((val: unknown) => {
      if (typeof val === "object" && val !== null && "portfolioId" in val && typeof val.portfolioId === "number") {
        return val as { portfolioId: number; year?: number };
      }
      throw new Error("Invalid portfolio ID");
    })
    .query(async ({ input, ctx }) => {
      const { getSavedPortfolioById, getPortfolioTransactions, getDb, getStockByTicker } = await import("../db");
      const { realizedGains, historicalPrices } = await import("../../drizzle/schema");
      const { eq, and, gte, lte } = await import("drizzle-orm");
      const { getStockCurrency, convertToCHF } = await import("../fxHelper");
      
      // Get database instance
      const db = await getDb();
      
      // Get portfolio
      const portfolio = await getSavedPortfolioById(input.portfolioId, ctx.user.id);
      if (!portfolio) {
        throw new Error("Portfolio not found");
      }
      
      const year = input.year || new Date().getFullYear();
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31, 23, 59, 59);
      
      // Calculate live performance inline (same logic as calculateLivePerformance procedure)
      const transactions = await getPortfolioTransactions(input.portfolioId);
      
      let totalDeposits = 0;  // Net capital from user
      let totalInvestedInStocks = 0;  // Cost basis of current positions
      let totalBuyAmounts = 0;
      let totalSellProceeds = 0;
      let totalDividends = 0;
      const holdings: Record<string, number> = {};
      const costBasis: Record<string, { totalCost: number; totalShares: number }> = {};
      
      // Process transactions to calculate holdings and total invested
      // For live portfolios, all buy transactions on the liveStartDate are treated as initial positions (implicit deposits)
      const liveStartDate = portfolio.liveStartDate ? new Date(portfolio.liveStartDate) : null;
      const liveStartDateStr = liveStartDate ? liveStartDate.toISOString().split('T')[0] : null;
      
      transactions.forEach((tx: any) => {
        const shares = parseFloat(tx.shares || '0');
        const amount = parseFloat(tx.totalAmountCHF || tx.totalAmount || '0');
        const txDateStr = new Date(tx.transactionDate).toISOString().split('T')[0];
        const isInitialPosition = tx.transactionType === 'buy' && txDateStr <= liveStartDateStr;
        
        if (tx.transactionType === 'buy') {
          holdings[tx.ticker] = (holdings[tx.ticker] || 0) + shares;
          totalBuyAmounts += amount;
          totalInvestedInStocks += amount;
          
          // Treat initial positions as implicit deposits (capital brought into the portfolio)
          if (isInitialPosition) {
            totalDeposits += amount;
          }
          
          // Track cost basis
          if (!costBasis[tx.ticker]) {
            costBasis[tx.ticker] = { totalCost: 0, totalShares: 0 };
          }
          costBasis[tx.ticker].totalCost += amount;
          costBasis[tx.ticker].totalShares += shares;
        } else if (tx.transactionType === 'sell') {
          holdings[tx.ticker] = (holdings[tx.ticker] || 0) - shares;
          totalSellProceeds += amount;
          // Reduce invested in stocks by cost basis of sold shares
          if (costBasis[tx.ticker] && costBasis[tx.ticker].totalShares > 0) {
            const avgCost = costBasis[tx.ticker].totalCost / costBasis[tx.ticker].totalShares;
            const soldCost = shares * avgCost;
            totalInvestedInStocks -= soldCost;
            costBasis[tx.ticker].totalCost -= soldCost;
            costBasis[tx.ticker].totalShares -= shares;
          }
        } else if (tx.transactionType === 'deposit') {
          totalDeposits += amount;
        } else if (tx.transactionType === 'withdrawal') {
          totalDeposits -= Math.abs(amount);
        } else if (tx.transactionType === 'dividend') {
          totalDividends += amount;
        }
      });
      
      let currentValueCHF = 0;
      let unrealizedGains = 0;
      
      if (portfolio.liveStartDate) {
        const liveStartDate = new Date(portfolio.liveStartDate);
        const liveStartDateStr = liveStartDate.toISOString().split('T')[0];
        const todayStr = new Date().toISOString().split('T')[0];
        let liveStartValueCHF = 0;
        
        for (const [ticker, shares] of Object.entries(holdings)) {
          if (shares > 0) {
            const stock = await getStockByTicker(ticker);
            const currentPrice = stock ? parseFloat(stock.currentPrice || '0') : 0;
            const currency = await getStockCurrency(ticker);
            
            const currentValueLocal = shares * currentPrice;
            const currentValueInCHF = await convertToCHF(currentValueLocal, currency, todayStr);
            currentValueCHF += currentValueInCHF;
            
            if (db) {
              const historicalPrice = await db
                .select()
                .from(historicalPrices)
                .where(
                  and(
                    eq(historicalPrices.ticker, ticker),
                    eq(historicalPrices.date, liveStartDateStr)
                  )
                )
                .limit(1);
              
              const liveStartPrice = historicalPrice[0]?.close 
                ? parseFloat(historicalPrice[0].close)
                : currentPrice;
              
              const liveStartValueLocal = shares * liveStartPrice;
              const liveStartValueInCHF = await convertToCHF(liveStartValueLocal, currency, liveStartDateStr);
              liveStartValueCHF += liveStartValueInCHF;
            }
          }
        }
        
        // Unrealized gains = current value - amount invested (cost basis)
        unrealizedGains = currentValueCHF - totalInvestedInStocks;
      }
      
      // Calculate cash position
      // Cash = Deposits - Buys + Sells + Dividends
      const cashPosition = totalDeposits - totalBuyAmounts + totalSellProceeds + totalDividends;
      
      // Total current value = Market value of stocks + Cash
      const totalCurrentValue = currentValueCHF + cashPosition;
      
      const livePerf = {
        currentValue: totalCurrentValue,
        totalInvested: totalInvestedInStocks,
        totalDeposits,
        cashPosition,
        unrealizedGains,
      };
      
      // Get realized gains for the year with FX breakdown
      let realizedGainsTotal = 0;
      let realizedStockGainsTotal = 0;
      let realizedFxGainsTotal = 0;
      
      if (db) {
        const realizedGainsData = await db
          .select()
          .from(realizedGains)
          .where(
            and(
              eq(realizedGains.portfolioId, input.portfolioId),
              gte(realizedGains.transactionDate, yearStart),
              lte(realizedGains.transactionDate, yearEnd)
            )
          );
        
        realizedGainsTotal = realizedGainsData.reduce(
          (sum, rg) => sum + parseFloat(rg.realizedGain || '0'),
          0
        );
        
        // Calculate stock gains and FX gains separately (with null checks for backward compatibility)
        realizedStockGainsTotal = realizedGainsData.reduce(
          (sum, rg) => {
            if (rg.stockGainLocal && rg.sellFxRate) {
              return sum + parseFloat(rg.stockGainLocal) * parseFloat(rg.sellFxRate);
            }
            return sum;
          },
          0
        );
        
        realizedFxGainsTotal = realizedGainsData.reduce(
          (sum, rg) => {
            if (rg.fxGain) {
              return sum + parseFloat(rg.fxGain);
            }
            return sum;
          },
          0
        );
      }
      
      // Calculate dividend income for the year
      const dividendIncome = transactions
        .filter((tx: any) => {
          if (tx.transactionType !== 'dividend') return false;
          const txDate = new Date(tx.transactionDate);
          return txDate >= yearStart && txDate <= yearEnd;
        })
        .reduce((sum: number, tx: any) => sum + parseFloat(tx.totalAmount || '0'), 0);
      
      // Calculate total fees for the year
      const totalFees = transactions
        .filter((tx: any) => {
          const txDate = new Date(tx.transactionDate);
          return txDate >= yearStart && txDate <= yearEnd;
        })
        .reduce((sum: number, tx: any) => sum + parseFloat(tx.fees || '0'), 0);
      
      // Use values from live performance calculation
      const finalTotalInvested = livePerf.totalInvested;  // Cost basis of stocks
      const finalTotalDeposits = livePerf.totalDeposits;  // Total capital from user
      const finalCurrentValue = livePerf.currentValue;  // Market value + cash
      const finalCashPosition = livePerf.cashPosition;
      const finalUnrealizedGains = livePerf.unrealizedGains;
      
      // Calculate net performance and ROI based on total deposits
      const netPerformance = finalUnrealizedGains + realizedGainsTotal + dividendIncome - totalFees;
      const returnOnInvestment = finalTotalDeposits > 0 ? ((finalCurrentValue - finalTotalDeposits) / finalTotalDeposits) * 100 : 0;
      
      return {
        year,
        unrealizedGains: finalUnrealizedGains,
        realizedGains: realizedGainsTotal,
        realizedStockGains: realizedStockGainsTotal,
        realizedFxGains: realizedFxGainsTotal,
        dividendIncome,
        totalFees,
        netPerformance,
        totalInvested: finalTotalInvested,
        totalDeposits: finalTotalDeposits,
        cashPosition: finalCashPosition,
        currentValue: finalCurrentValue,
        returnOnInvestment
      };
    }),
});
