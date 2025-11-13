import { eq, sql, isNotNull, ne, desc, lt, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertStock, InsertUser, InsertNews, InsertTransaction, InsertSavedPortfolio, InsertCategory, stocks, users, news, transactions, savedPortfolios, categories } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUser(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Stock queries
export async function getAllStocks() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get stocks: database not available");
    return [];
  }
  return await db.select().from(stocks);
}

export async function getStockByTicker(ticker: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get stock: database not available");
    return undefined;
  }
  const result = await db.select().from(stocks).where(eq(stocks.ticker, ticker)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function insertStock(stock: InsertStock) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot insert stock: database not available");
    return;
  }
  await db.insert(stocks).values(stock);
}

export async function getStocksByCategory(category: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get stocks by category: database not available");
    return [];
  }
  return await db.select().from(stocks).where(eq(stocks.category, category));
}

export async function updateStock(ticker: string, updates: Partial<InsertStock>) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update stock: database not available");
    return;
  }
  await db.update(stocks).set(updates).where(eq(stocks.ticker, ticker));
}

export async function deleteStock(ticker: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot delete stock: database not available");
    return;
  }
  await db.delete(stocks).where(eq(stocks.ticker, ticker));
}

// News queries
export async function getNewsByTicker(ticker: string, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  
  try {
    const result = await db
      .select()
      .from(news)
      .where(eq(news.ticker, ticker))
      .orderBy(desc(news.publishedAt))
      .limit(limit);
    return result;
  } catch (error) {
    console.error("[Database] Failed to get news:", error);
    return [];
  }
}

export async function getAllNews(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  
  try {
    const result = await db
      .select()
      .from(news)
      .orderBy(desc(news.publishedAt))
      .limit(limit);
    return result;
  } catch (error) {
    console.error("[Database] Failed to get all news:", error);
    return [];
  }
}

export async function addNews(newsItem: InsertNews) {
  const db = await getDb();
  if (!db) return null;
  
  try {
    await db.insert(news).values(newsItem);
    return newsItem;
  } catch (error) {
    console.error("[Database] Failed to add news:", error);
    return null;
  }
}

export async function deleteOldNews(daysOld = 30) {
  const db = await getDb();
  if (!db) return 0;
  
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    await db.delete(news).where(lt(news.publishedAt, cutoffDate));
    return 1;
  } catch (error) {
    console.error("[Database] Failed to delete old news:", error);
    return 0;
  }
}


// Transaction logging functions
export async function logTransaction(transaction: InsertTransaction) {
  const db = await getDb();
  if (!db) return null;
  
  try {
    await db.insert(transactions).values(transaction);
    return transaction;
  } catch (error) {
    console.error("[Database] Failed to log transaction:", error);
    return null;
  }
}

export async function getAllTransactions(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  
  try {
    const result = await db
      .select()
      .from(transactions)
      .orderBy(desc(transactions.createdAt))
      .limit(limit);
    return result;
  } catch (error) {
    console.error("[Database] Failed to get transactions:", error);
    return [];
  }
}

export async function deleteAllTransactions() {
  const db = await getDb();
  if (!db) return 0;
  
  try {
    await db.delete(transactions);
    return 1;
  } catch (error) {
    console.error("[Database] Failed to delete transactions:", error);
    return 0;
  }
}



// Saved Portfolio queries
export async function getSavedPortfolios(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  try {
    const result = await db
      .select()
      .from(savedPortfolios)
      .where(eq(savedPortfolios.userId, userId))
      .orderBy(desc(savedPortfolios.updatedAt));
    
    // Parse portfolioData JSON and extract fields for display
    return result.map(portfolio => {
      try {
        const data = JSON.parse(portfolio.portfolioData);
        return {
          ...portfolio,
          totalInvested: data.totalInvested || 0,
          numberOfPositions: data.numberOfPositions || 0,
          avgDividendYield: data.avgDividendYield || 0,
          avgYtdPerformance: data.avgYtdPerformance || 0,
        };
      } catch (e) {
        console.error("[Database] Failed to parse portfolioData:", e);
        return {
          ...portfolio,
          totalInvested: 0,
          numberOfPositions: 0,
          avgDividendYield: 0,
          avgYtdPerformance: 0,
        };
      }
    });
  } catch (error) {
    console.error("[Database] Failed to get saved portfolios:", error);
    return [];
  }
}

export async function getSavedPortfolioById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const result = await db
      .select()
      .from(savedPortfolios)
      .where(eq(savedPortfolios.id, id))
      .limit(1);
    
    if (result.length === 0 || result[0].userId !== userId) {
      return null; // Not found or doesn't belong to user
    }
    
    return result[0];
  } catch (error) {
    console.error("[Database] Failed to get saved portfolio:", error);
    return null;
  }
}

export async function createSavedPortfolio(portfolio: InsertSavedPortfolio) {
  const db = await getDb();
  if (!db) return null;
  
  try {
    // Calculate portfolio type based on composition
    const { calculatePortfolioType } = await import("./portfolioTypeCalculator");
    const portfolioType = calculatePortfolioType(portfolio.portfolioData);
    
    const result = await db.insert(savedPortfolios).values({
      ...portfolio,
      portfolioType,
    });
    return { id: Number((result as any).insertId), ...portfolio, portfolioType };
  } catch (error) {
    console.error("[Database] Failed to create saved portfolio:", error);
    return null;
  }
}

export async function updateSavedPortfolio(id: number, userId: number, updates: Partial<InsertSavedPortfolio>) {
  const db = await getDb();
  if (!db) return null;
  
  try {
    // Verify ownership
    const existing = await getSavedPortfolioById(id, userId);
    if (!existing) {
      return null;
    }
    
    await db.update(savedPortfolios)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(savedPortfolios.id, id));
    
    return { ...existing, ...updates, id };
  } catch (error) {
    console.error("[Database] Failed to update saved portfolio:", error);
    return null;
  }
}

export async function deleteSavedPortfolio(id: number, userId: number) {
  const db = await getDb();
  if (!db) return false;
  
  try {
    // Verify ownership
    const existing = await getSavedPortfolioById(id, userId);
    if (!existing) {
      return false;
    }
    
    console.log(`[Database] Deleting portfolio ${id} and all associated data...`);
    
    // Import necessary tables
    const { portfolioTransactions, realizedGains } = await import("../drizzle/schema");
    
    // Delete all realized gains for this portfolio
    const deletedGains = await db.delete(realizedGains).where(eq(realizedGains.portfolioId, id));
    console.log(`[Database] Deleted realized gains for portfolio ${id}`);
    
    // Delete all transactions for this portfolio
    const deletedTransactions = await db.delete(portfolioTransactions).where(eq(portfolioTransactions.portfolioId, id));
    console.log(`[Database] Deleted transactions for portfolio ${id}`);
    
    // Finally delete the portfolio itself
    await db.delete(savedPortfolios).where(eq(savedPortfolios.id, id));
    console.log(`[Database] Deleted portfolio ${id}`);
    
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete saved portfolio:", error);
    return false;
  }
}


// Category queries
export async function getAllCategories() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get categories: database not available");
    return [];
  }
  return await db.select().from(categories).orderBy(categories.name);
}

export async function getCategoryById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function insertCategory(category: InsertCategory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  try {
    const result = await db.insert(categories).values(category);
    return result;
  } catch (error) {
    console.error("[Database] Failed to insert category:", error);
    throw error;
  }
}

export async function updateCategory(id: number, data: Partial<InsertCategory>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  try {
    await db.update(categories).set(data).where(eq(categories.id, id));
    return await getCategoryById(id);
  } catch (error) {
    console.error("[Database] Failed to update category:", error);
    throw error;
  }
}

export async function deleteCategory(id: number) {
  const db = await getDb();
  if (!db) return false;
  
  try {
    await db.delete(categories).where(eq(categories.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete category:", error);
    return false;
  }
}

// Sector management functions
export async function getAllUniqueSectors() {
  const db = await getDb();
  if (!db) return [];
  
  try {
    const result = await db.select({ sector: stocks.sector }).from(stocks).where(sql`${stocks.sector} IS NOT NULL AND ${stocks.sector} != ''`).groupBy(stocks.sector);
    return result.map(r => r.sector).filter(Boolean);
  } catch (error) {
    console.error("[Database] Failed to get unique sectors:", error);
    return [];
  }
}

export async function updateStockSector(ticker: string, sector: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  try {
    await db.update(stocks).set({ sector }).where(eq(stocks.ticker, ticker));
  } catch (error) {
    console.error("[Database] Failed to update stock sector:", error);
    throw error;
  }
}

export async function togglePortfolioLive(id: number, userId: number, isLive: boolean) {
  const db = await getDb();
  if (!db) return null;
  
  const liveStartDate = isLive ? new Date() : null;
  
  // If switching TO live, create initial buy transactions for all positions
  if (isLive) {
    try {
      // First, delete any existing "Initial position" transactions to avoid duplicates
      const { portfolioTransactions } = await import("../drizzle/schema");
      const { and, eq, like } = await import("drizzle-orm");
      
      console.log('[ToggleLive] Deleting old initial position transactions for portfolio', id);
      await db.delete(portfolioTransactions)
        .where(
          and(
            eq(portfolioTransactions.portfolioId, id),
            like(portfolioTransactions.notes, '%Initial position%')
          )
        );
      
      // Get portfolio data
      const portfolio = await getSavedPortfolioById(id, userId);
      if (portfolio && portfolio.portfolioData) {
        const portfolioData = JSON.parse(portfolio.portfolioData);
        const stocks = Array.isArray(portfolioData) ? portfolioData : (portfolioData.stocks || []);
        
        console.log('[ToggleLive] Creating initial buy transactions for', stocks.length, 'positions');
        
        // Get historical prices for the live start date
        const { historicalPrices, portfolioTransactions, stocks: stocksTable, fxRates } = await import("../drizzle/schema");
        const liveStartDateStr = liveStartDate.toISOString().split('T')[0];
        
        // Create initial buy transaction for each position
        for (const stock of stocks) {
          const ticker = stock.ticker || stock.symbol;
          const shares = parseFloat(stock.shares || '0');
          
          if (ticker && shares > 0) {
            // Get stock currency from database
            let currency = 'CHF';
            try {
              const stockInfo = await db
                .select()
                .from(stocksTable)
                .where(eq(stocksTable.ticker, ticker))
                .limit(1);
              
              if (stockInfo[0]?.currency) {
                currency = stockInfo[0].currency;
                console.log(`[ToggleLive] ${ticker} currency: ${currency}`);
              }
            } catch (err) {
              console.error(`[ToggleLive] Error fetching currency for ${ticker}:`, err);
            }
            
            // Try to get historical price for the live start date
            let priceToUse = parseFloat(stock.currentPrice || stock.price || '0');
            
            try {
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
              
              if (historicalPrice[0]?.close) {
                priceToUse = parseFloat(historicalPrice[0].close);
                console.log(`[ToggleLive] Using historical price for ${ticker} on ${liveStartDateStr}: ${priceToUse}`);
              } else {
                console.log(`[ToggleLive] No historical price found for ${ticker} on ${liveStartDateStr}, using current price: ${priceToUse}`);
              }
            } catch (err) {
              console.error(`[ToggleLive] Error fetching historical price for ${ticker}:`, err);
              // Fall back to current price
            }
            
            if (priceToUse > 0) {
              const totalAmount = (shares * priceToUse).toFixed(2);
              
              // Get FX rate if not CHF
              let fxRate = 1.0;
              let totalAmountCHF = totalAmount;
              
              if (currency !== 'CHF') {
                try {
                  const fxPair = `${currency}CHF`;
                  const fxRateData = await db
                    .select()
                    .from(fxRates)
                    .where(
                      and(
                        eq(fxRates.pair, fxPair),
                        eq(fxRates.date, liveStartDateStr)
                      )
                    )
                    .limit(1);
                  
                  if (fxRateData[0]?.rate) {
                    fxRate = parseFloat(fxRateData[0].rate);
                    totalAmountCHF = (parseFloat(totalAmount) * fxRate).toFixed(2);
                    console.log(`[ToggleLive] FX rate for ${fxPair} on ${liveStartDateStr}: ${fxRate}`);
                  } else {
                    console.warn(`[ToggleLive] No FX rate found for ${fxPair} on ${liveStartDateStr}`);
                  }
                } catch (err) {
                  console.error(`[ToggleLive] Error fetching FX rate for ${currency}:`, err);
                }
              }
              
              await db.insert(portfolioTransactions).values({
                portfolioId: id,
                transactionType: 'buy',
                ticker: ticker,
                shares: shares.toString(),
                pricePerShare: priceToUse.toString(),
                currency: currency,
                totalAmount: totalAmount,
                fxRate: fxRate.toString(),
                totalAmountCHF: totalAmountCHF,
                fees: '0',
                notes: `Initial position (price from ${liveStartDateStr})`,
                transactionDate: liveStartDate,
              });
              
              console.log(`[ToggleLive] Created initial buy: ${ticker} x ${shares} @ ${priceToUse} ${currency} (FX: ${fxRate}, CHF: ${totalAmountCHF})`);
            }
          }
        }
      }
    } catch (error) {
      console.error('[ToggleLive] Failed to create initial transactions:', error);
      // Continue anyway - don't fail the toggle operation
    }
  }
  
  const result = await db.update(savedPortfolios)
    .set({ 
      isLive: isLive ? 1 : 0,
      liveStartDate: liveStartDate,
      livePerformance: isLive ? 0 : null,
      updatedAt: new Date()
    })
    .where(and(eq(savedPortfolios.id, id), eq(savedPortfolios.userId, userId)));
  
  return { success: true, isLive, liveStartDate };
}

// Portfolio transactions
export async function createPortfolioTransaction(transaction: any) {
  console.log("[DB] createPortfolioTransaction called with:", JSON.stringify(transaction, null, 2));
  const db = await getDb();
  if (!db) {
    const error = new Error("Database not available");
    console.error("[DB] Database not available");
    throw error;
  }

  // Validation: Check for foreign currency transactions
  if (transaction.currency && transaction.currency !== 'CHF') {
    // Validate FX rate is present
    if (!transaction.fxRate || transaction.fxRate === 0) {
      console.warn(`[Validation] Missing FX rate for ${transaction.currency} transaction on ${transaction.ticker}`);
      console.warn(`[Validation] Transaction data:`, transaction);
      
      // Try to fetch FX rate automatically
      try {
        const { getFxRate } = await import("./fxHelper");
        const dateStr = new Date(transaction.transactionDate).toISOString().split('T')[0];
        const currencyPair = transaction.currency + 'CHF';
        const fxRate = await getFxRate(dateStr, currencyPair);
        
        if (fxRate && fxRate > 0) {
          console.log(`[Validation] Auto-fetched FX rate: ${fxRate} for ${currencyPair} on ${dateStr}`);
          transaction.fxRate = fxRate;
          
          // Recalculate totalAmountCHF if missing
          if (!transaction.totalAmountCHF) {
            const shares = parseFloat(transaction.shares || '0');
            const price = parseFloat(transaction.pricePerShare || '0');
            transaction.totalAmountCHF = (shares * price * fxRate).toFixed(2);
            console.log(`[Validation] Calculated totalAmountCHF: ${transaction.totalAmountCHF}`);
          }
        } else {
          throw new Error(`Could not fetch FX rate for ${currencyPair} on ${dateStr}`);
        }
      } catch (fxError) {
        console.error(`[Validation] Failed to auto-fetch FX rate:`, fxError);
        throw new Error(`Missing FX rate for ${transaction.currency} transaction. Please ensure exchange rates are available.`);
      }
    }
    
    // Validate currency is correct
    if (!['USD', 'EUR', 'GBP', 'CHF'].includes(transaction.currency)) {
      console.warn(`[Validation] Invalid currency: ${transaction.currency}`);
      throw new Error(`Invalid currency: ${transaction.currency}. Supported currencies: USD, EUR, GBP, CHF`);
    }
    
    console.log(`[Validation] Foreign currency transaction validated: ${transaction.currency}, FX rate: ${transaction.fxRate}`);
  }
  
  try {
    const { portfolioTransactions, realizedGains } = await import("../drizzle/schema");
    console.log("[DB] Inserting into portfolioTransactions table...");
    console.log("[DB] Transaction data:", transaction);
    const result = await db.insert(portfolioTransactions).values(transaction);
    console.log("[DB] Insert result:", JSON.stringify(result, null, 2));
    console.log("[DB] Insert result keys:", Object.keys(result));
    console.log("[DB] Insert result[0]:", (result as any)[0]);
    
    // Extract insertId from Drizzle result
    let transactionId: number;
    if ((result as any).insertId) {
      transactionId = Number((result as any).insertId);
    } else if ((result as any)[0]?.insertId) {
      transactionId = Number((result as any)[0].insertId);
    } else {
      console.error("[DB] Could not extract insertId from result:", result);
      throw new Error("Failed to get transaction ID");
    }
    
    console.log("[DB] Extracted transactionId:", transactionId);
    const returnValue: any = { id: transactionId, ...transaction };
    
    // If this is a sell transaction, calculate realized gain/loss
    if (transaction.transactionType === 'sell' && transaction.ticker) {
      console.log("[DB] Calculating realized gain/loss for sell transaction...");
      
      // Get all buy transactions for this ticker in this portfolio
      const buyTransactions = await db
        .select()
        .from(portfolioTransactions)
        .where(
          and(
            eq(portfolioTransactions.portfolioId, transaction.portfolioId),
            eq(portfolioTransactions.ticker, transaction.ticker),
            eq(portfolioTransactions.transactionType, 'buy')
          )
        );
      
      // Calculate average cost basis (weighted average of all buys)
      let totalShares = 0;
      let totalCost = 0;
      
      for (const buy of buyTransactions) {
        const shares = parseFloat(buy.shares || '0');
        const price = parseFloat(buy.pricePerShare || '0');
        totalShares += shares;
        totalCost += shares * price;
      }
      
      const avgCostBasis = totalShares > 0 ? totalCost / totalShares : 0;
      const sellPrice = parseFloat(transaction.pricePerShare || '0');
      const sharesSold = parseFloat(transaction.shares || '0');
      
      // Get stock currency and FX rates for gain/loss breakdown
      const { getStockCurrency, getFxRate } = await import("./fxHelper");
      const currency = await getStockCurrency(transaction.ticker);
      
      // Get average buy date (weighted by shares) for FX rate calculation
      const avgBuyDate = buyTransactions.length > 0 
        ? buyTransactions[0].transactionDate 
        : transaction.transactionDate;
      const avgBuyDateStr = new Date(avgBuyDate).toISOString().split('T')[0];
      const sellDateStr = new Date(transaction.transactionDate).toISOString().split('T')[0];
      
      // Get FX rates (currency pair format: USDCHF, EURCHF, etc.)
      const currencyPair = currency === 'CHF' ? 'CHFCHF' : currency + 'CHF';
      const buyFxRate = await getFxRate(avgBuyDateStr, currencyPair);
      const sellFxRate = await getFxRate(sellDateStr, currencyPair);
      
      // Calculate stock gain in local currency
      const stockGainLocal = (sellPrice - avgCostBasis) * sharesSold;
      
      // Calculate FX gain: (sellPrice * sellFxRate - avgCostBasis * buyFxRate) * shares - stockGainLocal * sellFxRate
      const avgCostBasisCHF = avgCostBasis * buyFxRate;
      const sellPriceCHF = sellPrice * sellFxRate;
      const totalGainCHF = (sellPriceCHF - avgCostBasisCHF) * sharesSold;
      const stockGainCHF = stockGainLocal * sellFxRate;
      const fxGain = totalGainCHF - stockGainCHF;
      
      const realizedGainPercent = avgCostBasis > 0 ? ((sellPrice - avgCostBasis) / avgCostBasis) * 100 : 0;
      
      console.log("[DB] Realized gain calculation:", {
        avgCostBasis,
        sellPrice,
        sharesSold,
        stockGainLocal,
        stockGainCHF,
        fxGain,
        totalGainCHF,
        buyFxRate,
        sellFxRate,
        currency
      });
      
      // Save realized gain/loss to database with FX breakdown
      await db.insert(realizedGains).values({
        portfolioId: transaction.portfolioId,
        transactionId: transactionId,
        ticker: transaction.ticker,
        shares: transaction.shares,
        avgCostBasis: avgCostBasis.toFixed(2),
        sellPrice: sellPrice.toFixed(2),
        realizedGain: totalGainCHF.toFixed(2),
        realizedGainPercent: realizedGainPercent.toFixed(2),
        transactionDate: transaction.transactionDate,
        stockGainLocal: stockGainLocal.toFixed(2),
        fxGain: fxGain.toFixed(2),
        currency: currency,
        buyFxRate: buyFxRate.toFixed(4),
        sellFxRate: sellFxRate.toFixed(4),
      });
      
      // Add realized gain data to return value for UI display
      returnValue.realizedGain = {
        amount: totalGainCHF,
        percent: realizedGainPercent,
        avgCostBasis: avgCostBasis,
        sellPrice: sellPrice,
        shares: sharesSold,
        stockGainLocal: stockGainLocal,
        stockGainCHF: stockGainCHF,
        fxGain: fxGain,
        currency: currency,
        buyFxRate: buyFxRate,
        sellFxRate: sellFxRate,
      };
      
      console.log("[DB] Realized gain saved successfully");
    }
    
    console.log("[DB] Returning:", returnValue);
    return returnValue;
  } catch (error: any) {
    console.error("[Database] Failed to create portfolio transaction:");
    console.error("[Database] Error message:", error.message);
    console.error("[Database] Error stack:", error.stack);
    console.error("[Database] Full error:", JSON.stringify(error, null, 2));
    throw new Error(`Failed to create transaction: ${error.message}`);
  }
}

export async function getPortfolioTransactions(portfolioId: number) {
  const db = await getDb();
  if (!db) return [];
  
  try {
    const { portfolioTransactions, realizedGains } = await import("../drizzle/schema");
    
    // Get transactions with realized gains data (LEFT JOIN)
    const transactions = await db
      .select({
        id: portfolioTransactions.id,
        portfolioId: portfolioTransactions.portfolioId,
        transactionType: portfolioTransactions.transactionType,
        ticker: portfolioTransactions.ticker,
        shares: portfolioTransactions.shares,
        pricePerShare: portfolioTransactions.pricePerShare,
        currency: portfolioTransactions.currency,
        totalAmount: portfolioTransactions.totalAmount,
        fxRate: portfolioTransactions.fxRate,
        totalAmountCHF: portfolioTransactions.totalAmountCHF,
        fees: portfolioTransactions.fees,
        notes: portfolioTransactions.notes,
        transactionDate: portfolioTransactions.transactionDate,
        createdAt: portfolioTransactions.createdAt,
        // Add realized gain data from join
        realizedGain: realizedGains.realizedGain,
        realizedGainPercent: realizedGains.realizedGainPercent,
      })
      .from(portfolioTransactions)
      .leftJoin(
        realizedGains,
        eq(portfolioTransactions.id, realizedGains.transactionId)
      )
      .where(eq(portfolioTransactions.portfolioId, portfolioId))
      .orderBy(sql`${portfolioTransactions.transactionDate} ASC, ${portfolioTransactions.id} ASC`);
    
    return transactions;
  } catch (error) {
    console.error("[Database] Failed to get portfolio transactions:", error);
    return [];
  }
}
