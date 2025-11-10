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
    
    await db.delete(savedPortfolios).where(eq(savedPortfolios.id, id));
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
      // Get portfolio data
      const portfolio = await getSavedPortfolioById(id, userId);
      if (portfolio && portfolio.portfolioData) {
        const portfolioData = JSON.parse(portfolio.portfolioData);
        const stocks = Array.isArray(portfolioData) ? portfolioData : (portfolioData.stocks || []);
        
        console.log('[ToggleLive] Creating initial buy transactions for', stocks.length, 'positions');
        
        // Create initial buy transaction for each position
        const { portfolioTransactions } = await import("../drizzle/schema");
        for (const stock of stocks) {
          const ticker = stock.ticker || stock.symbol;
          const shares = parseFloat(stock.shares || '0');
          const currentPrice = parseFloat(stock.currentPrice || stock.price || '0');
          
          if (ticker && shares > 0 && currentPrice > 0) {
            const totalAmount = (shares * currentPrice).toFixed(2);
            
            await db.insert(portfolioTransactions).values({
              portfolioId: id,
              transactionType: 'buy',
              ticker: ticker,
              shares: shares.toString(),
              pricePerShare: currentPrice.toString(),
              totalAmount: totalAmount,
              fees: '0',
              notes: 'Initial position when switched to live',
              transactionDate: liveStartDate,
            });
            
            console.log(`[ToggleLive] Created initial buy: ${ticker} x ${shares} @ ${currentPrice}`);
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
  
  try {
    const { portfolioTransactions } = await import("../drizzle/schema");
    console.log("[DB] Inserting into portfolioTransactions table...");
    console.log("[DB] Transaction data:", transaction);
    const result = await db.insert(portfolioTransactions).values(transaction);
    console.log("[DB] Insert result:", JSON.stringify(result, null, 2));
    const returnValue = { id: Number((result as any).insertId), ...transaction };
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
    const { portfolioTransactions } = await import("../drizzle/schema");
    const transactions = await db
      .select()
      .from(portfolioTransactions)
      .where(eq(portfolioTransactions.portfolioId, portfolioId))
      .orderBy(sql`${portfolioTransactions.transactionDate} DESC`);
    return transactions;
  } catch (error) {
    console.error("[Database] Failed to get portfolio transactions:", error);
    return [];
  }
}
