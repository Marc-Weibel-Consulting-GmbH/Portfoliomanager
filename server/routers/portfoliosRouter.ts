import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const portfoliosRouter = router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getSavedPortfolios, getPortfolioTransactions, getStockByTicker, getDb } = await import("../db");
      const portfolios = await getSavedPortfolios(ctx.user.id);
      
      // Batch load all stocks and historical prices for performance optimization
      const db = await getDb();
      if (!db) return portfolios;
      
      const { stocks: stocksTable, historicalPrices } = await import("../../drizzle/schema");
      const { inArray, and, eq } = await import("drizzle-orm");
      
      // Get all unique tickers from all live portfolios
      const livePortfolios = portfolios.filter(p => p.isLive && p.liveStartDate);
      const allTickers = new Set<string>();
      const liveStartDates = new Set<string>();
      
      for (const portfolio of livePortfolios) {
        const transactions = await getPortfolioTransactions(portfolio.id);
        transactions.forEach((tx: any) => allTickers.add(tx.ticker));
        if (portfolio.liveStartDate) {
          liveStartDates.add(new Date(portfolio.liveStartDate).toISOString().split('T')[0]);
        }
      }
      
      // Batch load all stocks
      const allStocksData = allTickers.size > 0
        ? await db.select().from(stocksTable).where(inArray(stocksTable.ticker, Array.from(allTickers)))
        : [];
      const stocksMap = new Map(allStocksData.map(s => [s.ticker, s]));
      
      // Batch load all historical prices - fetch individually for each ticker/date pair
      const allHistoricalPrices: any[] = [];
      if (allTickers.size > 0 && liveStartDates.size > 0) {
        for (const ticker of Array.from(allTickers)) {
          for (const dateStr of Array.from(liveStartDates)) {
            const result = await db
              .select()
              .from(historicalPrices)
              .where(
                and(
                  eq(historicalPrices.ticker, ticker),
                  eq(historicalPrices.date, dateStr)
                )
              )
              .limit(1);
            if (result.length > 0) {
              allHistoricalPrices.push(result[0]);
            }
          }
        }
      }
      const historicalPricesMap = new Map(
        allHistoricalPrices.map(hp => [`${hp.ticker}_${hp.date}`, hp])
      );
      
      // Calculate live performance for each live portfolio
      const portfoliosWithPerformance = await Promise.all(
        portfolios.map(async (portfolio) => {
          if (!portfolio.isLive || !portfolio.liveStartDate) {
            return portfolio;
          }
          
          try {
            const transactions = await getPortfolioTransactions(portfolio.id);
            if (transactions.length === 0) {
              return { ...portfolio, livePerformance: 0 };
            }
            
            // Calculate holdings and total invested from transactions
            const holdings: Record<string, number> = {};
            const costBasis: Record<string, { totalCost: number; totalShares: number }> = {};
            let totalDeposits = 0;  // Net capital from user (deposits - withdrawals)
            let totalInvestedInStocks = 0;  // Cost basis of current stock positions
            let totalBuyAmounts = 0;  // Total spent on buys
            let totalSellProceeds = 0;  // Total received from sells
            let totalDividends = 0;  // Total dividends received
            
            transactions.forEach((tx: any) => {
              const shares = parseFloat(tx.shares || '0');
              const price = parseFloat(tx.pricePerShare || '0');
              const amount = parseFloat(tx.totalAmountCHF || tx.totalAmount || '0');
              
              // Treat initial transactions as implicit deposits
              const isInitialTransaction = tx.notes && tx.notes.includes('Initial position');
              
              if (tx.transactionType === 'buy') {
                if (isInitialTransaction) {
                  totalDeposits += amount;  // Initial transactions are implicit deposits
                }
                holdings[tx.ticker] = (holdings[tx.ticker] || 0) + shares;
                totalBuyAmounts += amount;
                totalInvestedInStocks += amount;
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
                if (!isInitialTransaction) {  // Don't double-count initial transactions
                  totalDeposits += amount;
                }
              } else if (tx.transactionType === 'withdrawal') {
                totalDeposits -= Math.abs(amount);  // Reduce deposits by withdrawal amount
              } else if (tx.transactionType === 'dividend') {
                totalDividends += amount;
              }
            });
            
            // Fetch current prices and historical prices (in CHF)
            const db = await getDb();
            if (!db) {
              return portfolio;
            }
            
            const { getStockCurrency, convertToCHF } = await import("../fxHelper");
            
            let currentValueCHF = 0;
            let liveStartValueCHF = 0;
            const liveStartDate = new Date(portfolio.liveStartDate);
            const liveStartDateStr = liveStartDate.toISOString().split('T')[0];
            const todayStr = new Date().toISOString().split('T')[0];
            
            const { historicalPrices, realizedGains } = await import("../../drizzle/schema");
            const { eq, and } = await import("drizzle-orm");
            
            for (const [ticker, shares] of Object.entries(holdings)) {
              if (shares > 0) {
                // Use pre-loaded stock data
                const stock = stocksMap.get(ticker);
                const currentPrice = stock ? parseFloat(stock.currentPrice || '0') : 0;
                const currency = stock?.currency || 'CHF';
                
                // Convert current value to CHF
                const currentValueLocal = shares * currentPrice;
                const currentValueInCHF = await convertToCHF(currentValueLocal, currency, todayStr);
                currentValueCHF += currentValueInCHF;
                
                // Use pre-loaded historical price
                const historicalPriceKey = `${ticker}_${liveStartDateStr}`;
                const historicalPrice = historicalPricesMap.get(historicalPriceKey);
                
                const liveStartPrice = historicalPrice?.close 
                  ? parseFloat(historicalPrice.close)
                  : currentPrice;
                
                // Convert live start value to CHF
                const liveStartValueLocal = shares * liveStartPrice;
                const liveStartValueInCHF = await convertToCHF(liveStartValueLocal, currency, liveStartDateStr);
                liveStartValueCHF += liveStartValueInCHF;
              }
            }
            
            // Calculate cash position
            // Cash = Deposits - Buys + Sells + Dividends
            const cashPosition = totalDeposits - totalBuyAmounts + totalSellProceeds + totalDividends;
            
            // Fetch realized gains for this portfolio
            let totalRealizedGains = 0;
            
            const gains = await db
              .select()
              .from(realizedGains)
              .where(eq(realizedGains.portfolioId, portfolio.id));
            
            // Sum all realized gains (realizedGain is in CHF, includes stock gain + FX gain)
            totalRealizedGains = gains.reduce((sum, gain) => sum + parseFloat(gain.realizedGain || '0'), 0);
            
            // Total current value = Market value of stocks + Cash
            const totalCurrentValue = currentValueCHF + cashPosition;
            
            // Calculate performance:
            // Performance = (Total Current Value - Total Deposits) / Total Deposits * 100
            // This shows how much the portfolio has grown relative to the capital invested
            const performance = totalDeposits > 0 
              ? ((totalCurrentValue - totalDeposits) / totalDeposits) * 100 
              : 0;
            
            return { ...portfolio, livePerformance: performance };
          } catch (error) {
            console.error(`Error calculating live performance for portfolio ${portfolio.id}:`, error);
            return portfolio;
          }
        })
      );
      
      return portfoliosWithPerformance;
    }),

    get: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "id" in val && typeof val.id === "number") {
          return val.id;
        }
        throw new Error("Invalid portfolio ID");
      })
      .query(async ({ input, ctx }) => {
        const { getSavedPortfolioById } = await import("../db");
        return await getSavedPortfolioById(input, ctx.user.id);
      }),

    create: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "name" in val && "portfolioData" in val) {
          return val as { name: string; description?: string; portfolioData: string };
        }
        throw new Error("Invalid portfolio data");
      })
      .mutation(async ({ input, ctx }) => {
        const { createSavedPortfolio } = await import("../db");
        return await createSavedPortfolio({
          userId: ctx.user.id,
          name: input.name,
          description: input.description || null,
          portfolioData: input.portfolioData,
        });
      }),

    update: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "id" in val && typeof val.id === "number") {
          return val as { id: number; name?: string; description?: string; portfolioData?: string };
        }
        throw new Error("Invalid update data");
      })
      .mutation(async ({ input, ctx }) => {
        const { updateSavedPortfolio } = await import("../db");
        const { id, ...updates } = input;
        return await updateSavedPortfolio(id, ctx.user.id, updates);
      }),

    delete: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "id" in val && typeof val.id === "number") {
          return val.id;
        }
        throw new Error("Invalid portfolio ID");
      })
      .mutation(async ({ input, ctx }) => {
        const { deleteSavedPortfolio } = await import("../db");
        const success = await deleteSavedPortfolio(input, ctx.user.id);
        if (!success) {
          throw new Error("Failed to delete portfolio");
        }
        return { success: true };
      }),

    toggleLive: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "id" in val && typeof val.id === "number" && "isLive" in val && typeof val.isLive === "boolean") {
          return val as { id: number; isLive: boolean };
        }
        throw new Error("Invalid toggle data");
      })
      .mutation(async ({ input, ctx }) => {
        const { togglePortfolioLive } = await import("../db");
        return await togglePortfolioLive(input.id, ctx.user.id, input.isLive);
      }),

    updateLiveStartDate: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "id" in val && typeof val.id === "number" && "liveStartDate" in val && typeof val.liveStartDate === "string") {
          return val as { id: number; liveStartDate: string };
        }
        throw new Error("Invalid update data");
      })
      .mutation(async ({ input, ctx }) => {
        const { getDb, getSavedPortfolioById } = await import("../db");
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }
        
        const { savedPortfolios, portfolioTransactions, historicalPrices } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        
        // Get portfolio to check if it's live and has data
        const portfolio = await getSavedPortfolioById(input.id, ctx.user.id);
        if (!portfolio || !portfolio.isLive) {
          throw new Error("Portfolio not found or not in live mode");
        }
        
        const newLiveStartDate = new Date(input.liveStartDate);
        const newLiveStartDateStr = newLiveStartDate.toISOString().split('T')[0];
        
        // Delete all existing initial transactions (those with notes containing "Initial position")
        await db
          .delete(portfolioTransactions)
          .where(
            and(
              eq(portfolioTransactions.portfolioId, input.id),
              eq(portfolioTransactions.transactionType, 'buy')
            )
          );
        
        console.log('[UpdateLiveStartDate] Deleted existing initial transactions');
        
        // Recreate initial transactions with new date and historical prices
        if (portfolio.portfolioData) {
          const portfolioData = JSON.parse(portfolio.portfolioData);
          const stocks = Array.isArray(portfolioData) ? portfolioData : (portfolioData.stocks || []);
          
          console.log('[UpdateLiveStartDate] Creating new initial transactions for', stocks.length, 'positions with date', newLiveStartDateStr);
          
          for (const stock of stocks) {
            const ticker = stock.ticker || stock.symbol;
            const shares = parseFloat(stock.shares || '0');
            
            if (ticker && shares > 0) {
              // Try to get historical price for the new live start date
              let priceToUse = parseFloat(stock.currentPrice || stock.price || '0');
              
              try {
                const historicalPrice = await db
                  .select()
                  .from(historicalPrices)
                  .where(
                    and(
                      eq(historicalPrices.ticker, ticker),
                      eq(historicalPrices.date, newLiveStartDateStr)
                    )
                  )
                  .limit(1);
                
                if (historicalPrice[0]?.close) {
                  priceToUse = parseFloat(historicalPrice[0].close);
                  console.log(`[UpdateLiveStartDate] Using historical price for ${ticker} on ${newLiveStartDateStr}: ${priceToUse}`);
                } else {
                  console.log(`[UpdateLiveStartDate] No historical price found for ${ticker} on ${newLiveStartDateStr}, using current price: ${priceToUse}`);
                }
              } catch (err) {
                console.error(`[UpdateLiveStartDate] Error fetching historical price for ${ticker}:`, err);
              }
              
              if (priceToUse > 0) {
                const totalAmount = (shares * priceToUse).toFixed(2);
                
                await db.insert(portfolioTransactions).values({
                  portfolioId: input.id,
                  transactionType: 'buy',
                  ticker: ticker,
                  shares: shares.toString(),
                  pricePerShare: priceToUse.toString(),
                  totalAmount: totalAmount,
                  fees: '0',
                  notes: `Initial position (price from ${newLiveStartDateStr})`,
                  transactionDate: newLiveStartDate,
                });
                
                console.log(`[UpdateLiveStartDate] Created initial buy: ${ticker} x ${shares} @ ${priceToUse}`);
              }
            }
          }
        }
        
        // Update the liveStartDate
        await db
          .update(savedPortfolios)
          .set({ liveStartDate: newLiveStartDate })
          .where(
            and(
              eq(savedPortfolios.id, input.id),
              eq(savedPortfolios.userId, ctx.user.id)
            )
          );
        
        return { success: true };
      }),

    calculateLivePerformance: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "id" in val && typeof val.id === "number") {
          return val.id;
        }
        throw new Error("Invalid portfolio ID");
      })
      .query(async ({ input, ctx }) => {
        const { getSavedPortfolioById, getPortfolioTransactions } = await import("../db");
        
        // Get portfolio and transactions
        const portfolio = await getSavedPortfolioById(input, ctx.user.id);
        if (!portfolio || !portfolio.isLive || !portfolio.liveStartDate) {
          return { performance: null, error: "Portfolio is not in live mode" };
        }
        
        const transactions = await getPortfolioTransactions(input);
        if (transactions.length === 0) {
          return { performance: 0, currentValue: 0, totalInvested: 0 };
        }
        
        // Calculate deposits and current value
        let totalDeposits = 0;
        let totalInvestedInStocks = 0;
        let totalBuyAmounts = 0;
        let totalSellProceeds = 0;
        let totalDividends = 0;
        const holdings: Record<string, number> = {};
        const costBasis: Record<string, { totalCost: number; totalShares: number }> = {};
        
        // Process transactions
        // For live portfolios, all buy transactions on the liveStartDate are treated as initial positions (implicit deposits)
        const liveStartDate = new Date(portfolio.liveStartDate);
        const liveStartDateStr = liveStartDate.toISOString().split('T')[0];
        
        console.log('\n========== [calculateLivePerformance] START ==========');
        console.log('[calculateLivePerformance] Portfolio ID:', input);
        console.log('[calculateLivePerformance] Live Start Date:', liveStartDateStr);
        console.log('[calculateLivePerformance] Total Transactions:', transactions.length);
        console.log('\n[calculateLivePerformance] Processing transactions...');
        transactions.forEach((tx: any) => {
          const shares = parseFloat(tx.shares || '0');
          const price = parseFloat(tx.pricePerShare || '0');
          const amount = parseFloat(tx.totalAmountCHF || '0');
          const txDateStr = new Date(tx.transactionDate).toISOString().split('T')[0];
          const isInitialPosition = tx.transactionType === 'buy' && txDateStr <= liveStartDateStr;
          
          if (tx.transactionType === 'buy') {
            console.log(`[calculateLivePerformance] BUY ${tx.ticker}: ${shares} shares @ ${price} ${tx.currency}, totalAmountCHF=${amount}`);
            holdings[tx.ticker] = (holdings[tx.ticker] || 0) + shares;
            totalBuyAmounts += amount;
            totalInvestedInStocks += amount;
            console.log(`[calculateLivePerformance]   → totalInvestedInStocks now: ${totalInvestedInStocks}`);
            
            // Treat initial positions as implicit deposits (capital brought into the portfolio)
            if (isInitialPosition) {
              totalDeposits += amount;
              console.log(`[calculateLivePerformance]   → Initial position, totalDeposits now: ${totalDeposits}`);
            }
            
            if (!costBasis[tx.ticker]) {
              costBasis[tx.ticker] = { totalCost: 0, totalShares: 0 };
            }
            costBasis[tx.ticker].totalCost += amount;
            costBasis[tx.ticker].totalShares += shares;
          } else if (tx.transactionType === 'sell') {
            console.log(`[calculateLivePerformance] SELL ${tx.ticker}: ${shares} shares @ ${price} ${tx.currency}, totalAmountCHF=${amount}`);
            holdings[tx.ticker] = (holdings[tx.ticker] || 0) - shares;
            totalSellProceeds += amount;
            console.log(`[calculateLivePerformance]   → totalSellProceeds now: ${totalSellProceeds}`);
            if (costBasis[tx.ticker] && costBasis[tx.ticker].totalShares > 0) {
              const avgCost = costBasis[tx.ticker].totalCost / costBasis[tx.ticker].totalShares;
              const soldCost = shares * avgCost;
              console.log(`[calculateLivePerformance]   → Avg cost: ${avgCost.toFixed(2)}, Sold cost: ${soldCost.toFixed(2)}`);
              totalInvestedInStocks -= soldCost;
              console.log(`[calculateLivePerformance]   → totalInvestedInStocks reduced to: ${totalInvestedInStocks}`);
              costBasis[tx.ticker].totalCost -= soldCost;
              costBasis[tx.ticker].totalShares -= shares;
            }
          } else if (tx.transactionType === 'deposit') {
            console.log(`[calculateLivePerformance] DEPOSIT: CHF ${amount}`);
            totalDeposits += amount;
            console.log(`[calculateLivePerformance]   → totalDeposits now: ${totalDeposits}`);
          } else if (tx.transactionType === 'withdrawal') {
            console.log(`[calculateLivePerformance] WITHDRAWAL: CHF ${amount}`);
            totalDeposits -= Math.abs(amount);
            console.log(`[calculateLivePerformance]   → totalDeposits now: ${totalDeposits}`);
          } else if (tx.transactionType === 'dividend') {
            console.log(`[calculateLivePerformance] DIVIDEND ${tx.ticker}: CHF ${amount}`);
            totalDividends += amount;
            console.log(`[calculateLivePerformance]   → totalDividends now: ${totalDividends}`);
          }
        });
        
        // Fetch current prices and calculate current value (in CHF)
        const { getStockByTicker } = await import("../db");
        const { getDb } = await import("../db");
        const { getStockCurrency, convertToCHF, getCurrentFxRate } = await import("../fxHelper");
        const db = await getDb();
        
        let currentValueCHF = 0;
        let liveStartValueCHF = 0;
        
        // liveStartDate and liveStartDateStr already declared above
        const todayStr = new Date().toISOString().split('T')[0];
        
        for (const [ticker, shares] of Object.entries(holdings)) {
          if (shares > 0) {
            const stock = await getStockByTicker(ticker);
            const currentPrice = stock ? parseFloat(stock.currentPrice || '0') : 0;
            
            // Get currency for this stock
            const currency = await getStockCurrency(ticker);
            
            // Convert current value to CHF
            const currentValueLocal = shares * currentPrice;
            const currentValueInCHF = await convertToCHF(currentValueLocal, currency, todayStr);
            currentValueCHF += currentValueInCHF;
            
            // Get price at live start date from historicalPrices table
            if (db) {
              const { historicalPrices } = await import("../../drizzle/schema");
              const { eq, and } = await import("drizzle-orm");
              
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
              
              // Use historical price if available, otherwise use current price (assumes no change)
              const liveStartPrice = historicalPrice[0]?.close 
                ? parseFloat(historicalPrice[0].close)
                : currentPrice;
              
              // Convert live start value to CHF using historical FX rate
              const liveStartValueLocal = shares * liveStartPrice;
              const liveStartValueInCHF = await convertToCHF(liveStartValueLocal, currency, liveStartDateStr);
              liveStartValueCHF += liveStartValueInCHF;
            } else {
              // Fallback: use current price if no DB access
              const fallbackValueInCHF = await convertToCHF(currentValueLocal, currency, todayStr);
              liveStartValueCHF += fallbackValueInCHF;
            }
          }
        }
        
        // Fetch realized gains for this portfolio
        let totalRealizedGains = 0;
        if (db) {
          const { realizedGains } = await import("../../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          
          const gains = await db
            .select()
            .from(realizedGains)
            .where(eq(realizedGains.portfolioId, input));
          
          // Sum all realized gains (realizedGain is in CHF, includes stock gain + FX gain)
          totalRealizedGains = gains.reduce((sum, gain) => sum + parseFloat(gain.realizedGain || '0'), 0);
        }
        
        // Calculate cash position and total value
        const cashPosition = totalDeposits - totalBuyAmounts + totalSellProceeds + totalDividends;
        const totalCurrentValue = currentValueCHF + cashPosition;
        
        // Calculate performance:
        // Performance = (Total Current Value - Total Deposits) / Total Deposits * 100
        const performance = totalDeposits > 0 
          ? ((totalCurrentValue - totalDeposits) / totalDeposits) * 100 
          : 0;
        
        console.log('\n[calculateLivePerformance] ========== FINAL SUMMARY ==========');
        console.log('[calculateLivePerformance] Transaction Totals:');
        console.log(`  - Total Buy Amounts:      CHF ${totalBuyAmounts.toFixed(2)}`);
        console.log(`  - Total Sell Proceeds:    CHF ${totalSellProceeds.toFixed(2)}`);
        console.log(`  - Total Deposits:         CHF ${totalDeposits.toFixed(2)}`);
        console.log(`  - Total Dividends:        CHF ${totalDividends.toFixed(2)}`);
        console.log('\n[calculateLivePerformance] Current Holdings:');
        Object.entries(holdings).forEach(([ticker, shares]) => {
          if (shares > 0) {
            const basis = costBasis[ticker];
            const avgCost = basis ? basis.totalCost / basis.totalShares : 0;
            console.log(`  - ${ticker}: ${shares.toFixed(2)} shares, Avg Cost: CHF ${avgCost.toFixed(2)}, Total Cost: CHF ${(basis?.totalCost || 0).toFixed(2)}`);
          }
        });
        console.log('\n[calculateLivePerformance] Calculated Values:');
        console.log(`  - Total Invested in Stocks: CHF ${totalInvestedInStocks.toFixed(2)}`);
        console.log(`  - Current Stock Value:      CHF ${currentValueCHF.toFixed(2)}`);
        console.log(`  - Live Start Stock Value:   CHF ${liveStartValueCHF.toFixed(2)}`);
        console.log(`  - Cash Position:            CHF ${cashPosition.toFixed(2)}`);
        console.log(`  - Total Current Value:      CHF ${totalCurrentValue.toFixed(2)}`);
        console.log(`  - Total Realized Gains:     CHF ${totalRealizedGains.toFixed(2)}`);
        console.log(`  - Performance:              ${performance.toFixed(2)}%`);
        console.log('\n[calculateLivePerformance] Formula Check:');
        console.log(`  Cash = Deposits - BuyAmounts + SellProceeds + Dividends`);
        console.log(`  Cash = ${totalDeposits.toFixed(2)} - ${totalBuyAmounts.toFixed(2)} + ${totalSellProceeds.toFixed(2)} + ${totalDividends.toFixed(2)}`);
        console.log(`  Cash = ${cashPosition.toFixed(2)} ✓`);
        console.log(`\n  Performance = (CurrentValue - Deposits) / Deposits * 100`);
        console.log(`  Performance = (${totalCurrentValue.toFixed(2)} - ${totalDeposits.toFixed(2)}) / ${totalDeposits.toFixed(2)} * 100`);
        console.log(`  Performance = ${performance.toFixed(2)}% ✓`);
        console.log('========== [calculateLivePerformance] END ==========\n');
        
        return {
          performance,
          currentValue: totalCurrentValue,
          liveStartValue: liveStartValueCHF,
          totalInvested: totalDeposits,  // Total capital invested (deposits - withdrawals + initial positions)
          totalInvestedInStocks,  // Cost basis of current stock positions
          totalDeposits,
          cashPosition,
          totalRealizedGains,
          holdings,
          transactionCount: transactions.length,
        };
      }),

    validateCalculations: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "id" in val && typeof val.id === "number") {
          return val.id;
        }
        throw new Error("Invalid portfolio ID");
      })
      .query(async ({ input, ctx }) => {
        const { getSavedPortfolioById, getPortfolioTransactions } = await import("../db");
        
        console.log('\n========== [validateCalculations] START ==========');
        console.log('[validateCalculations] Portfolio ID:', input);
        
        // Get portfolio
        const portfolio = await getSavedPortfolioById(input, ctx.user.id);
        if (!portfolio) {
          return { error: "Portfolio not found" };
        }
        
        if (!portfolio.isLive || !portfolio.liveStartDate) {
          return { error: "Portfolio is not in live mode" };
        }
        
        // Get all transactions
        const transactions = await getPortfolioTransactions(input);
        console.log('[validateCalculations] Total transactions:', transactions.length);
        
        // Initialize tracking variables
        const validation: any = {
          portfolioId: input,
          liveStartDate: portfolio.liveStartDate,
          transactionCount: transactions.length,
          transactions: [],
          calculations: {},
          warnings: [],
          errors: []
        };
        
        // Process each transaction
        let runningDeposits = 0;
        let runningBuys = 0;
        let runningSells = 0;
        let runningDividends = 0;
        let runningInvested = 0;
        const holdings: Record<string, number> = {};
        const costBasis: Record<string, { totalCost: number; totalShares: number }> = {};
        
        const liveStartDateStr = new Date(portfolio.liveStartDate).toISOString().split('T')[0];
        
        transactions.forEach((tx: any, index: number) => {
          const shares = parseFloat(tx.shares || '0');
          const price = parseFloat(tx.pricePerShare || '0');
          const amount = parseFloat(tx.totalAmountCHF || '0');
          const txDateStr = new Date(tx.transactionDate).toISOString().split('T')[0];
          const isInitialPosition = tx.transactionType === 'buy' && txDateStr <= liveStartDateStr;
          
          const txValidation: any = {
            index: index + 1,
            date: txDateStr,
            type: tx.transactionType,
            ticker: tx.ticker,
            shares,
            price,
            currency: tx.currency,
            fxRate: parseFloat(tx.fxRate || '1'),
            amountCHF: amount,
            isInitialPosition
          };
          
          // Validate transaction data
          if (shares <= 0 && tx.transactionType !== 'deposit' && tx.transactionType !== 'withdrawal') {
            validation.warnings.push(`Transaction #${index + 1}: Invalid shares (${shares})`);
          }
          if (price <= 0 && tx.transactionType !== 'deposit' && tx.transactionType !== 'withdrawal') {
            validation.warnings.push(`Transaction #${index + 1}: Invalid price (${price})`);
          }
          if (amount === 0) {
            validation.warnings.push(`Transaction #${index + 1}: Zero amount`);
          }
          
          // Process transaction
          if (tx.transactionType === 'buy') {
            runningBuys += amount;
            runningInvested += amount;
            holdings[tx.ticker] = (holdings[tx.ticker] || 0) + shares;
            
            if (isInitialPosition) {
              runningDeposits += amount;
              txValidation.note = 'Initial position (counted as deposit)';
            }
            
            if (!costBasis[tx.ticker]) {
              costBasis[tx.ticker] = { totalCost: 0, totalShares: 0 };
            }
            costBasis[tx.ticker].totalCost += amount;
            costBasis[tx.ticker].totalShares += shares;
            
          } else if (tx.transactionType === 'sell') {
            runningSells += amount;
            holdings[tx.ticker] = (holdings[tx.ticker] || 0) - shares;
            
            if (costBasis[tx.ticker] && costBasis[tx.ticker].totalShares > 0) {
              const avgCost = costBasis[tx.ticker].totalCost / costBasis[tx.ticker].totalShares;
              const soldCost = shares * avgCost;
              runningInvested -= soldCost;
              costBasis[tx.ticker].totalCost -= soldCost;
              costBasis[tx.ticker].totalShares -= shares;
              
              txValidation.avgCost = avgCost;
              txValidation.soldCost = soldCost;
              txValidation.realizedGain = amount - soldCost;
            }
            
          } else if (tx.transactionType === 'deposit') {
            runningDeposits += amount;
          } else if (tx.transactionType === 'withdrawal') {
            runningDeposits -= Math.abs(amount);
          } else if (tx.transactionType === 'dividend') {
            runningDividends += amount;
          }
          
          txValidation.runningTotals = {
            deposits: runningDeposits,
            buys: runningBuys,
            sells: runningSells,
            dividends: runningDividends,
            invested: runningInvested
          };
          
          validation.transactions.push(txValidation);
        });
        
        // Calculate expected values
        const expectedCash = runningDeposits - runningBuys + runningSells + runningDividends;
        
        validation.calculations = {
          totalDeposits: runningDeposits,
          totalBuyAmounts: runningBuys,
          totalSellProceeds: runningSells,
          totalDividends: runningDividends,
          totalInvestedInStocks: runningInvested,
          expectedCash,
          formula: `Cash = ${runningDeposits.toFixed(2)} - ${runningBuys.toFixed(2)} + ${runningSells.toFixed(2)} + ${runningDividends.toFixed(2)} = ${expectedCash.toFixed(2)}`
        };
        
        validation.holdings = Object.entries(holdings)
          .filter(([_, shares]) => shares > 0)
          .map(([ticker, shares]) => ({
            ticker,
            shares,
            costBasis: costBasis[ticker]?.totalCost || 0,
            avgCost: costBasis[ticker] ? costBasis[ticker].totalCost / costBasis[ticker].totalShares : 0
          }));
        
        console.log('[validateCalculations] Validation complete');
        console.log('[validateCalculations] Expected Cash:', expectedCash.toFixed(2));
        console.log('[validateCalculations] Total Invested:', runningInvested.toFixed(2));
        console.log('[validateCalculations] Warnings:', validation.warnings.length);
        console.log('[validateCalculations] Errors:', validation.errors.length);
        console.log('========== [validateCalculations] END ==========\n');
        
        return validation;
      }),

    getHoldingsWithChfPerformance: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "id" in val && typeof val.id === "number") {
          return val.id;
        }
        throw new Error("Invalid portfolio ID");
      })
      .query(async ({ input: portfolioId, ctx }) => {
        console.log(`\n========== getHoldingsWithChfPerformance START ==========`);
        console.log(`Portfolio ID: ${portfolioId}`);
        console.log(`Timestamp: ${new Date().toISOString()}`);
        
        const { getSavedPortfolioById, getPortfolioTransactions, getStockByTicker, getDb } = await import("../db");
        const { getStockCurrency, convertToCHF } = await import("../fxHelper");
        
        // Get portfolio and transactions
        const portfolio = await getSavedPortfolioById(portfolioId, ctx.user.id);
        if (!portfolio || !portfolio.isLive || !portfolio.liveStartDate) {
          return [];
        }
        
        const transactions = await getPortfolioTransactions(portfolioId);
        if (transactions.length === 0) {
          return [];
        }
        
        // Calculate holdings from transactions
        const holdingsByTicker: Record<string, { shares: number; totalInvestedLocal: number; totalInvestedCHF: number; totalBought: number; avgBuyPrice: number; avgBuyPriceCHF: number; currency: string }> = {};
        
        for (const tx of transactions) {
          const ticker = tx.ticker;
          if (!holdingsByTicker[ticker]) {
            const currency = await getStockCurrency(ticker);
            holdingsByTicker[ticker] = { 
              shares: 0, 
              totalInvestedLocal: 0, 
              totalInvestedCHF: 0,
              totalBought: 0, 
              avgBuyPrice: 0,
              avgBuyPriceCHF: 0,
              currency 
            };
          }
          
          const shares = parseFloat(tx.shares || '0');
          const price = parseFloat(tx.pricePerShare || '0');
          // Use totalAmount from transaction (includes fees) if available, otherwise calculate
          const amountLocal = parseFloat(tx.totalAmount || '0') || (shares * price);
          const amountCHF = parseFloat(tx.totalAmountCHF || '0') || amountLocal;
          
          if (ticker === 'NVDA') {
            console.log(`[NVDA] tx.totalAmount: "${tx.totalAmount}"`);
            console.log(`[NVDA] tx.totalAmountCHF: "${tx.totalAmountCHF}"`);
            console.log(`[NVDA] tx.currency: "${tx.currency}"`);
            console.log(`[NVDA] amountLocal: ${amountLocal}`);
            console.log(`[NVDA] amountCHF: ${amountCHF}`);
            console.log(`[NVDA] amountCHF === amountLocal? ${amountCHF === amountLocal}`);
            console.log(`[NVDA] holding currency: ${holdingsByTicker[ticker].currency}`);
          }
          
          if (tx.transactionType === 'buy') {
            holdingsByTicker[ticker].shares += shares;
            holdingsByTicker[ticker].totalBought += shares;
            holdingsByTicker[ticker].totalInvestedLocal += amountLocal;
            holdingsByTicker[ticker].totalInvestedCHF += amountCHF;
            // Calculate average buy price (cost per share including fees)
            holdingsByTicker[ticker].avgBuyPrice = holdingsByTicker[ticker].totalInvestedLocal / holdingsByTicker[ticker].totalBought;
            holdingsByTicker[ticker].avgBuyPriceCHF = holdingsByTicker[ticker].totalInvestedCHF / holdingsByTicker[ticker].totalBought;
          } else if (tx.transactionType === 'sell') {
            console.log(`[getHoldingsWithChfPerformance] SELL ${ticker}: ${shares} shares`);
            holdingsByTicker[ticker].shares -= shares;
            // Reduce totalInvested proportionally based on average buy price
            const costBasisLocal = shares * holdingsByTicker[ticker].avgBuyPrice;
            const costBasisCHF = shares * holdingsByTicker[ticker].avgBuyPriceCHF;
            console.log(`[getHoldingsWithChfPerformance]   → Cost basis for ${shares} shares: CHF ${costBasisCHF}`);
            holdingsByTicker[ticker].totalInvestedLocal -= costBasisLocal;
            holdingsByTicker[ticker].totalInvestedCHF -= costBasisCHF;
            console.log(`[getHoldingsWithChfPerformance]   → ${ticker} totalInvestedCHF now: ${holdingsByTicker[ticker].totalInvestedCHF}`);
            // Recalculate average buy price based on remaining shares
            if (holdingsByTicker[ticker].shares > 0) {
              holdingsByTicker[ticker].avgBuyPrice = holdingsByTicker[ticker].totalInvestedLocal / holdingsByTicker[ticker].shares;
              holdingsByTicker[ticker].avgBuyPriceCHF = holdingsByTicker[ticker].totalInvestedCHF / holdingsByTicker[ticker].shares;
              console.log(`[getHoldingsWithChfPerformance]   → ${ticker} new avgBuyPrice: ${holdingsByTicker[ticker].avgBuyPrice.toFixed(2)} ${holdingsByTicker[ticker].currency}`);
            }
          }
        }
        
        // Fetch realized gains per ticker for this portfolio
        const db = await getDb();
        const realizedGainsByTicker: Record<string, number> = {};
        
        if (db) {
          const { realizedGains } = await import("../../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          
          const gains = await db
            .select()
            .from(realizedGains)
            .where(eq(realizedGains.portfolioId, portfolioId));
          
          // Group realized gains by ticker
          gains.forEach((gain) => {
            const ticker = gain.ticker;
            const totalGain = parseFloat(gain.realizedGain || '0');
            realizedGainsByTicker[ticker] = (realizedGainsByTicker[ticker] || 0) + totalGain;
          });
        }
        
        // Calculate CHF-converted performance for each holding
        // Use liveStartDate as baseline for performance calculation
        const liveStartDateStr = new Date(portfolio.liveStartDate).toISOString().split('T')[0];
        const todayStr = new Date().toISOString().split('T')[0];
        
        const holdingsWithPerformance = [];
        
        for (const [ticker, holding] of Object.entries(holdingsByTicker)) {
          if (holding.shares <= 0) continue;
          
          const stock = await getStockByTicker(ticker);
          const currentPrice = stock ? parseFloat(stock.currentPrice || '0') : 0;
          
          // Current value in local currency
          const currentValueLocal = holding.shares * currentPrice;
          
          // Convert to CHF using today's rate
          const currentValueCHF = await convertToCHF(currentValueLocal, holding.currency, todayStr);
          
          // Get price at liveStartDate for baseline
          const { historicalPrices } = await import("../../drizzle/schema");
          const { eq, and } = await import("drizzle-orm");
          
          let liveStartPrice = currentPrice; // fallback
          if (db) {
            const priceData = await db
              .select()
              .from(historicalPrices)
              .where(
                and(
                  eq(historicalPrices.ticker, ticker),
                  eq(historicalPrices.date, liveStartDateStr)
                )
              )
              .limit(1);
            
            if (priceData.length > 0) {
              liveStartPrice = parseFloat(priceData[0].close || '0');
            }
          }
          
          // Calculate live start value in CHF
          const liveStartValueLocal = holding.shares * liveStartPrice;
          const liveStartValueCHF = await convertToCHF(liveStartValueLocal, holding.currency, liveStartDateStr);
          
          // Get realized gains for this ticker
          const realizedGains = realizedGainsByTicker[ticker] || 0;
          
          // Calculate CHF performance based on actual investment:
          // Performance = (Current Value + Realized Gains - Total Invested) / Total Invested * 100
          // This correctly handles positions bought after live start date
          const performanceCHF = holding.totalInvestedCHF > 0
            ? ((currentValueCHF + realizedGains - holding.totalInvestedCHF) / holding.totalInvestedCHF) * 100
            : 0;
          
          // Keep totalInvestedCHF for reference (actual money spent)
          const totalInvestedCHF = holding.totalInvestedCHF;
          
          // Calculate average FX rate (buy)
          const avgFxRate = holding.totalInvestedLocal > 0 
            ? holding.totalInvestedCHF / holding.totalInvestedLocal
            : 1.0;
          
          // Calculate current FX rate
          const currentFxRate = currentValueLocal > 0
            ? currentValueCHF / currentValueLocal
            : 1.0;
          
          holdingsWithPerformance.push({
            ticker,
            shares: holding.shares,
            currency: holding.currency,
            currentPrice,
            currentValueLocal,
            currentValueCHF,
            totalInvestedLocal: holding.totalInvestedLocal,
            totalInvestedCHF,
            performanceCHF,
            avgBuyPrice: holding.avgBuyPrice,
            avgFxRate,
            currentFxRate
          });
        }
        
        const totalInvestedAllHoldings = holdingsWithPerformance.reduce((sum, h) => sum + h.totalInvestedCHF, 0);
        console.log(`[getHoldingsWithChfPerformance] SUMMARY: Total invested across all holdings: CHF ${totalInvestedAllHoldings.toFixed(2)}`);
        
        return holdingsWithPerformance;
      }),

    getLivePerformanceHistory: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "id" in val && typeof val.id === "number") {
          return val.id;
        }
        throw new Error("Invalid portfolio ID");
      })
      .query(async ({ input, ctx }) => {
        const { getSavedPortfolioById, getPortfolioTransactions } = await import("../db");
        const { getDb } = await import("../db");
        
        // Get portfolio
        const portfolio = await getSavedPortfolioById(input, ctx.user.id);
        if (!portfolio || !portfolio.isLive || !portfolio.liveStartDate) {
          return { dataPoints: [] };
        }
        
        const transactions = await getPortfolioTransactions(input);
        if (transactions.length === 0) {
          return { dataPoints: [] };
        }
        
        const db = await getDb();
        if (!db) {
          return { dataPoints: [] };
        }
        
        // Generate all days from liveStartDate to today
        const startDate = new Date(portfolio.liveStartDate);
        const today = new Date();
        const days: Date[] = [];
        
        for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
          days.push(new Date(d));
        }
        
        // Calculate holdings and invested amount for each day
        const dataPoints = [];
        
        for (const day of days) {
          // Get transactions up to this day
          const txUpToDay = transactions.filter(
            (tx: any) => new Date(tx.transactionDate) <= day
          );
          
          // Calculate holdings and total invested (using same logic as calculateLivePerformance)
          let totalDeposits = 0;
          let totalWithdrawals = 0;
          let totalBuyAmounts = 0;
          let totalSellProceeds = 0;
          let totalDividends = 0;
          let totalInvestedInStocks = 0;  // Cost basis of current positions
          const holdings: Record<string, number> = {};
          const costBasis: Record<string, { totalCost: number; totalShares: number }> = {};
          const liveStartDateStr = new Date(portfolio.liveStartDate).toISOString().split('T')[0];
          
          txUpToDay.forEach((tx: any) => {
            const shares = parseFloat(tx.shares || '0');
            const amountCHF = parseFloat(tx.totalAmountCHF || tx.totalAmount || '0');
            const txDateStr = new Date(tx.transactionDate).toISOString().split('T')[0];
            const isInitialPosition = tx.transactionType === 'buy' && txDateStr <= liveStartDateStr;
            
            if (tx.transactionType === 'buy') {
              holdings[tx.ticker] = (holdings[tx.ticker] || 0) + shares;
              totalBuyAmounts += amountCHF;
              totalInvestedInStocks += amountCHF;
              
              if (isInitialPosition) {
                totalDeposits += amountCHF;
              }
              
              // Track cost basis
              if (!costBasis[tx.ticker]) {
                costBasis[tx.ticker] = { totalCost: 0, totalShares: 0 };
              }
              costBasis[tx.ticker].totalCost += amountCHF;
              costBasis[tx.ticker].totalShares += shares;
            } else if (tx.transactionType === 'sell') {
              holdings[tx.ticker] = (holdings[tx.ticker] || 0) - shares;
              totalSellProceeds += amountCHF;
              
              // Reduce invested in stocks by cost basis of sold shares
              if (costBasis[tx.ticker] && costBasis[tx.ticker].totalShares > 0) {
                const avgCost = costBasis[tx.ticker].totalCost / costBasis[tx.ticker].totalShares;
                const soldCost = shares * avgCost;
                totalInvestedInStocks -= soldCost;
                costBasis[tx.ticker].totalCost -= soldCost;
                costBasis[tx.ticker].totalShares -= shares;
              }
            } else if (tx.transactionType === 'deposit') {
              totalDeposits += amountCHF;
            } else if (tx.transactionType === 'withdrawal') {
              totalWithdrawals += amountCHF;
            } else if (tx.transactionType === 'dividend') {
              totalDividends += amountCHF;
            }
          });
          
          // Get historical prices for this day
          const dayStr = day.toISOString().split('T')[0];
          let portfolioValue = 0;
          
          for (const [ticker, shares] of Object.entries(holdings)) {
            if (shares > 0) {
              // Get stock currency
              const { getStockCurrency } = await import("../fxHelper");
              const currency = await getStockCurrency(ticker);
              
              // Try to get historical price for this day
              const priceData = await db
                .select()
                .from(historicalPrices)
                .where(
                  and(
                    eq(historicalPrices.ticker, ticker),
                    eq(historicalPrices.date, dayStr)
                  )
                )
                .limit(1);
              
              let price = 0;
              if (priceData.length > 0) {
                price = parseFloat(priceData[0].close || '0');
              } else {
                // Fallback: use current price from stocks table
                const { getStockByTicker } = await import("../db");
                const stock = await getStockByTicker(ticker);
                price = stock ? parseFloat(stock.currentPrice || '0') : 0;
              }
              
              // Convert to CHF if needed
              let priceCHF = price;
              if (currency !== 'CHF') {
                const { convertToCHF } = await import("../fxHelper");
                priceCHF = await convertToCHF(price, currency, dayStr);
              }
              
              portfolioValue += shares * priceCHF;
            }
          }
          
          // Calculate cash position (same as calculateLivePerformance)
          const cashPosition = totalDeposits - totalBuyAmounts + totalSellProceeds + totalDividends - totalWithdrawals;
          const totalCurrentValue = portfolioValue + cashPosition;
          
          // Calculate performance (same formula as calculateLivePerformance)
          // Performance = (Current Value - Total Deposits) / Total Deposits × 100
          const totalCapital = totalDeposits - totalWithdrawals;
          const performance = totalCapital > 0
            ? ((totalCurrentValue - totalCapital) / totalCapital) * 100
            : 0;
          
          // Total invested = cost basis of stocks + cash (matches Portfolio card)
          const totalInvested = totalInvestedInStocks + cashPosition;
          
          dataPoints.push({
            date: dayStr,
            invested: totalInvested,  // Show total invested (stocks + cash) not just capital
            value: totalCurrentValue,
            performance
          });
        }
        
        return { dataPoints };
      }),
});
