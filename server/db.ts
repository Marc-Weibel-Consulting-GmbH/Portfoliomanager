import { eq, sql, isNotNull, ne, desc, lt, and, asc, gte, lte, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertStock, InsertUser, InsertNews, InsertTransaction, InsertSavedPortfolio, InsertCategory, InsertLogoCache, LogoCache, stocks, users, news, transactions, savedPortfolios, categories, logoCache } from "../drizzle/schema";
import { ENV } from './_core/env';
import { roundRappen } from './lib/rounding';

let _db: ReturnType<typeof drizzle> | null = null;
// A-07: memoize the first connection error so it is logged LOUDLY exactly
// once (incl. cause) instead of silently retrying + warn-spamming on every
// call. The null contract is kept — too many callers depend on it.
let _dbInitError: unknown = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && !_dbInitError && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      _dbInitError = error;
      console.error(
        "[Database] FATAL: failed to initialize DB connection — all getDb() callers will receive null until restart. Cause:",
        error
      );
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

export async function updateUserPreferences(userId: number, preferences: {
  investmentGoal?: "dividends" | "growth" | "balanced";
  riskTolerance?: "low" | "medium" | "high";
  investmentHorizon?: "short" | "medium" | "long";
}) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update user preferences: database not available");
    return;
  }

  const updates: Record<string, unknown> = {};
  if (preferences.investmentGoal !== undefined) {
    updates.investmentGoal = preferences.investmentGoal;
  }
  if (preferences.riskTolerance !== undefined) {
    updates.riskTolerance = preferences.riskTolerance;
  }
  if (preferences.investmentHorizon !== undefined) {
    updates.investmentHorizon = preferences.investmentHorizon;
  }

  if (Object.keys(updates).length > 0) {
    await db.update(users).set(updates).where(eq(users.id, userId));
  }
}

export async function completeOnboarding(userId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot complete onboarding: database not available");
    return;
  }

  await db.update(users).set({ 
    hasCompletedOnboarding: 1,
    hasSeenOnboarding: 1,
    updatedAt: new Date()
  }).where(eq(users.id, userId));
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
  let result = await db.select().from(stocks).where(eq(stocks.ticker, ticker)).limit(1);
  // US tickers are stored inconsistently (some with ".US", some without). If the
  // exact lookup misses, retry with the ".US" suffix stripped so the same stock
  // is found by every value/performance function (avoids dropped holdings).
  if (result.length === 0 && ticker.endsWith(".US")) {
    const base = ticker.slice(0, -3);
    result = await db.select().from(stocks).where(eq(stocks.ticker, base)).limit(1);
  }
  // Firmen-Alias (z. B. Portfolio hält "ABB.SW", stocks-Tabelle führt "ABBN.SW") — sonst
  // erscheint die Position als "Kurs fehlt", obwohl der Kurs unter dem kanonischen Ticker da ist.
  if (result.length === 0) {
    const { resolveCanonicalTicker } = await import("./tickerNormalization");
    const canonical = resolveCanonicalTicker(ticker);
    if (canonical !== ticker) {
      result = await db.select().from(stocks).where(eq(stocks.ticker, canonical)).limit(1);
    }
  }
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Batch-fetch multiple stocks by ticker in a single DB query.
 * Returns a Map<ticker, stock> for O(1) lookup.
 * Falls back gracefully: missing tickers simply won’t appear in the map.
 */
export async function getStocksByTickers(tickers: string[]): Promise<Map<string, typeof stocks.$inferSelect>> {
  const db = await getDb();
  const result = new Map<string, typeof stocks.$inferSelect>();
  if (!db || tickers.length === 0) return result;

  const uniqueTickers = [...new Set(tickers)];
  const rows = await db.select().from(stocks).where(inArray(stocks.ticker, uniqueTickers));
  for (const row of rows) {
    result.set(row.ticker, row);
  }

  // For tickers not found, try without ".US" suffix
  const missing = uniqueTickers.filter(t => !result.has(t) && t.endsWith('.US'));
  if (missing.length > 0) {
    const bases = missing.map(t => t.slice(0, -3));
    const fallbackRows = await db.select().from(stocks).where(inArray(stocks.ticker, bases));
    for (let i = 0; i < missing.length; i++) {
      const found = fallbackRows.find(r => r.ticker === bases[i]);
      if (found) result.set(missing[i], found);
    }
  }

  return result;
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
    
    // Batch load all transactions for LIVE portfolios (performance optimization)
    const livePortfolios = result.filter(p => p.isLive);
    const transactionsByPortfolio: Record<number, any[]> = {};
    
    if (livePortfolios.length > 0) {
      try {
        const { portfolioTransactions } = await import("../drizzle/schema");
        const { inArray } = await import("drizzle-orm");
        
        const allTransactions = await db
          .select()
          .from(portfolioTransactions)
          .where(inArray(portfolioTransactions.portfolioId, livePortfolios.map(p => p.id)));
        
        // Group transactions by portfolio ID
        allTransactions.forEach(tx => {
          if (!transactionsByPortfolio[tx.portfolioId]) {
            transactionsByPortfolio[tx.portfolioId] = [];
          }
          transactionsByPortfolio[tx.portfolioId].push(tx);
        });
      } catch (err) {
        console.error('[getSavedPortfolios] Failed to batch load transactions:', err);
      }
    }
    
    // Parse portfolioData JSON and extract fields for display
    const portfoliosWithData = result.map(portfolio => {
      try {
        const data = JSON.parse(portfolio.portfolioData);
        
        // For LIVE portfolios, calculate totalInvested from transactions
        let totalInvested = data.totalInvested || 0;
        if (portfolio.isLive && transactionsByPortfolio[portfolio.id]) {
          try {
            const transactions = transactionsByPortfolio[portfolio.id];
            const liveStartDateStr = portfolio.liveStartDate ? new Date(portfolio.liveStartDate).toISOString().split('T')[0] : null;
            
            // Calculate total invested from transactions
            let totalDeposits = 0;
            let totalWithdrawals = 0;
            
            for (const tx of transactions) {
              const amount = parseFloat(tx.totalAmountCHF || tx.totalAmount || '0');
              const txDateStr = new Date(tx.transactionDate).toISOString().split('T')[0];
              const isInitialPosition = tx.transactionType === 'buy' && txDateStr <= liveStartDateStr;
              
              if (tx.transactionType === 'deposit') {
                totalDeposits += amount;
              } else if (tx.transactionType === 'withdrawal') {
                totalWithdrawals += amount;
              } else if (tx.transactionType === 'buy' && isInitialPosition) {
                totalDeposits += amount; // Initial positions count as deposits
              }
            }
            
            // Total invested = deposits - withdrawals
            totalInvested = totalDeposits - totalWithdrawals;
          } catch (txError) {
            console.error(`[getSavedPortfolios] Failed to calculate totalInvested for portfolio ${portfolio.id}:`, txError);
          }
        }
        
        return {
          ...portfolio,
          totalInvested,
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
    
    return portfoliosWithData;
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
  if (!db) {
    throw new Error('Database connection not available');
  }
  
  try {
    console.log('[Database] createSavedPortfolio called with:', JSON.stringify(portfolio, null, 2));
    
    // Only insert valid columns that exist in the database
    const validData: any = {
      userId: portfolio.userId,
      name: portfolio.name,
      portfolioData: portfolio.portfolioData,
      investmentAmount: portfolio.investmentAmount,
      portfolioType: portfolio.portfolioType,
      isLive: portfolio.isLive ?? 0,
    };
    
    // Add optional fields if they exist
    if (portfolio.description !== undefined) validData.description = portfolio.description;
    if (portfolio.liveStartDate !== undefined) validData.liveStartDate = portfolio.liveStartDate;
    
    console.log('[Database] Inserting with validData:', JSON.stringify(validData, null, 2));
    
    // Insert the portfolio
    const result = await db.insert(savedPortfolios).values(validData);
    
    console.log('[Database] Insert result:', result);
    
    // Get the inserted ID from the result
    const insertId = (result as any)[0]?.insertId || (result as any).insertId;
    
    console.log('[Database] Extracted insertId:', insertId);
    
    if (!insertId) {
      throw new Error('Failed to get portfolio ID from insert result');
    }
    
    // Return the created portfolio with the ID
    const returnValue = {
      id: Number(insertId),
      ...validData,
    };
    
    console.log('[Database] Returning:', JSON.stringify(returnValue, null, 2));
    
    return returnValue;
  } catch (error: any) {
    console.error("[Database] Failed to create saved portfolio:", error);
    console.error("[Database] Error stack:", error.stack);
    throw new Error(`Database error: ${error.message || 'Unknown error'}`);
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
        const { historicalPrices, portfolioTransactions, stocks: stocksTable } = await import("../drizzle/schema");
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
            const rawPriceStr = stock.currentPrice || stock.price || '0';
            let priceToUse = (rawPriceStr === 'NA' || rawPriceStr === 'N/A') ? 0 : parseFloat(rawPriceStr);
            if (isNaN(priceToUse)) priceToUse = 0;
            
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
                  const { getFxRate } = await import('./fxHelper');
                  fxRate = await getFxRate(liveStartDateStr, `${currency}CHF`);
                  totalAmountCHF = (parseFloat(totalAmount) * fxRate).toFixed(2);
                  console.log(`[ToggleLive] FX rate for ${currency}CHF on ${liveStartDateStr}: ${fxRate}`);
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
      livePerformance: isLive ? '0' : null,
      updatedAt: new Date()
    })
    .where(and(eq(savedPortfolios.id, id), eq(savedPortfolios.userId, userId)));
  
  return { success: true, isLive, liveStartDate };
}

// Portfolio transactions
/** Kompakte Stückzahl-Darstellung für Fehlermeldungen (ohne Float-Rauschen). */
function formatShareCount(n: number): string {
  return String(Number(n.toFixed(4)));
}

/**
 * R-20: Bestand (Stückzahl) eines Titels in einem Portfolio zum Zeitpunkt
 * `atDate` — chronologischer Replay der Buy/Sell-Zeilen. Verkäufe klemmen bei
 * 0 (konsistent zum Moving-Average-Replay im Verkaufs-Zweig für Legacy-Zeilen).
 */
export async function getSharesHeldAt(portfolioId: number, ticker: string, atDate: Date): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { portfolioTransactions } = await import("../drizzle/schema");

  const rows = await db
    .select()
    .from(portfolioTransactions)
    .where(
      and(
        eq(portfolioTransactions.portfolioId, portfolioId),
        eq(portfolioTransactions.ticker, ticker)
      )
    );

  const atTime = atDate.getTime();
  const trades = rows
    .filter(
      (row: any) =>
        (row.transactionType === 'buy' || row.transactionType === 'sell') &&
        new Date(row.transactionDate).getTime() <= atTime
    )
    .sort(
      (a: any, b: any) =>
        new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime() ||
        a.id - b.id
    );

  let held = 0;
  for (const trade of trades) {
    const shares = parseFloat(trade.shares || '0');
    if (!(shares > 0)) continue;
    held = trade.transactionType === 'buy' ? held + shares : Math.max(0, held - shares);
  }
  return held;
}

/**
 * R-20: Oversell-Validierung — wirft einen deutschen Fehler, wenn `sharesSold`
 * den Bestand zum Verkaufszeitpunkt übersteigt (statt stillschweigend negative
 * Positionen/Kostenbasen zu erzeugen). Gemeinsame Validierung der Live-
 * Schreibpfade (createPortfolioTransaction, CSV-Import).
 */
export async function assertSellWithinHoldings(
  portfolioId: number,
  ticker: string,
  sharesSold: number,
  atDate: Date
): Promise<void> {
  const held = await getSharesHeldAt(portfolioId, ticker, atDate);
  const EPSILON = 1e-6; // Float-Toleranz (z. B. Bruchteils-Stücke aus Importen)
  if (sharesSold > held + EPSILON) {
    throw new Error(
      `Verkauf von ${formatShareCount(sharesSold)} Stück ${ticker} nicht möglich — Bestand ist ${formatShareCount(held)} Stück`
    );
  }
}

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
    if (!['USD', 'EUR', 'GBP', 'GBp', 'CHF'].includes(transaction.currency)) {
      console.warn(`[Validation] Invalid currency: ${transaction.currency}`);
      throw new Error(`Invalid currency: ${transaction.currency}. Supported currencies: USD, EUR, GBP, GBp, CHF`);
    }
    
    console.log(`[Validation] Foreign currency transaction validated: ${transaction.currency}, FX rate: ${transaction.fxRate}`);
  }
  
  // Cash balance validation for withdrawals and buys
  if (transaction.transactionType === 'withdrawal' || transaction.transactionType === 'buy') {
    const { portfolioTransactions } = await import("../drizzle/schema");
    const { eq, and } = await import("drizzle-orm");
    
    // Calculate current cash position
    const allTransactions = await db
      .select()
      .from(portfolioTransactions)
      .where(eq(portfolioTransactions.portfolioId, transaction.portfolioId));
    
    let cashPosition = 0;
    for (const tx of allTransactions) {
      const amount = parseFloat(tx.totalAmountCHF || '0');
      if (tx.transactionType === 'deposit') {
        cashPosition += amount;
      } else if (tx.transactionType === 'withdrawal') {
        cashPosition += amount; // already negative
      } else if (tx.transactionType === 'buy') {
        cashPosition -= amount;
      } else if (tx.transactionType === 'sell') {
        cashPosition += amount;
      }
    }
    
    // Check if new transaction would make cash negative
    const transactionAmount = Math.abs(parseFloat(transaction.totalAmountCHF || '0'));
    const newCashPosition = transaction.transactionType === 'withdrawal' 
      ? cashPosition - transactionAmount
      : cashPosition - transactionAmount;
    
    if (newCashPosition < 0) {
      throw new Error(`Unzureichende Liquidität: Cash-Position würde CHF ${Math.round(newCashPosition).toLocaleString('de-CH')} betragen. Bitte zahlen Sie zuerst Geld ein.`);
    }
  }

  // R-20: Oversell-Validierung VOR dem Insert — ein Verkauf über den Bestand
  // hinaus wird abgelehnt (vorher: negative Positionen/Kostenbasen, die
  // downstream stillschweigend auf 0 geklemmt wurden).
  if (transaction.transactionType === 'sell' && transaction.ticker) {
    await assertSellWithinHoldings(
      transaction.portfolioId,
      transaction.ticker,
      parseFloat(transaction.shares || '0'),
      new Date(transaction.transactionDate)
    );
  }

  // R-22: Schweizer Rappenrundung (0.05) für persistierte CASH-Beträge —
  // Ein-/Auszahlungen und Dividenden-Auszahlungen (Settlement) sowie Gebühren.
  // Kurse, Stückzahlen und Brutto-Handelswerte bleiben ungerundet
  // (Konvention: siehe server/lib/rounding.ts).
  if (['deposit', 'withdrawal', 'dividend'].includes(transaction.transactionType)) {
    const chf = parseFloat(transaction.totalAmountCHF ?? '');
    if (Number.isFinite(chf)) {
      transaction.totalAmountCHF = roundRappen(chf).toFixed(2);
    }
    if (!transaction.currency || transaction.currency === 'CHF') {
      const local = parseFloat(transaction.totalAmount ?? '');
      if (Number.isFinite(local)) {
        transaction.totalAmount = roundRappen(local).toFixed(2);
      }
    }
  }
  {
    const fees = parseFloat(transaction.fees ?? '');
    if (Number.isFinite(fees)) {
      transaction.fees = roundRappen(fees).toFixed(2);
    }
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
      
      // R-03: Moving-average cost basis over the FULL buy+sell ledger of this
      // ticker (chronological), so prior sells consume their share of the
      // basis instead of every buy ever counting forever (phantom gains).
      const ledgerRows = await db
        .select()
        .from(portfolioTransactions)
        .where(
          and(
            eq(portfolioTransactions.portfolioId, transaction.portfolioId),
            eq(portfolioTransactions.ticker, transaction.ticker)
          )
        );

      // Get stock currency and FX rates for gain/loss breakdown
      const { getStockCurrency, getFxRate } = await import("./fxHelper");
      const currency = await getStockCurrency(transaction.ticker);

      // Get FX rates (currency pair format: USDCHF, EURCHF, etc.)
      const currencyPair = currency === 'CHF' ? 'CHFCHF' : currency + 'CHF';

      // Only trades strictly before this sell (by date, then id) count — the
      // sell itself was already inserted above and must not consume itself.
      const sellTime = new Date(transaction.transactionDate).getTime();
      const priorTrades = ledgerRows
        .filter((row) => {
          if (row.transactionType !== 'buy' && row.transactionType !== 'sell') return false;
          if (row.id === transactionId) return false;
          const t = new Date(row.transactionDate).getTime();
          return t < sellTime || (t === sellTime && row.id < transactionId);
        })
        .sort(
          (a, b) =>
            new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime() ||
            a.id - b.id
        );

      // Running moving-average position. Local-currency basis EXCLUDES fees
      // (unchanged — fee treatment in the basis stays open, see R-24/E3).
      // totalCostChf tracks the same basis in CHF so the remaining position
      // carries a cost-weighted average buy FX rate (R-19).
      let totalShares = 0;
      let totalCost = 0; // local currency, excl. fees
      let totalCostChf = 0; // basis converted at each buy's FX rate

      for (const trade of priorTrades) {
        const shares = parseFloat(trade.shares || '0');
        if (shares <= 0) continue;
        if (trade.transactionType === 'buy') {
          const price = parseFloat(trade.pricePerShare || '0');
          // R-19: prefer the stored per-transaction fxRate; fall back to the
          // historical rate at the buy date.
          const storedFx = parseFloat(trade.fxRate || '');
          const buyFx =
            Number.isFinite(storedFx) && storedFx > 0
              ? storedFx
              : await getFxRate(new Date(trade.transactionDate).toISOString().split('T')[0], currencyPair);
          totalShares += shares;
          totalCost += shares * price;
          totalCostChf += shares * price * buyFx;
        } else {
          // Prior sell consumes basis proportionally (avg cost stays constant).
          // R-20: neue Oversells werden oben (assertSellWithinHoldings) VOR dem
          // Insert abgelehnt; der Clamp hier bleibt als Schutz für Legacy-Zeilen.
          const factor = totalShares > 0 ? Math.max(0, (totalShares - shares) / totalShares) : 0;
          totalCost *= factor;
          totalCostChf *= factor;
          totalShares = Math.max(0, totalShares - shares);
        }
      }

      // Guard: no remaining position (Legacy-Oversell / no prior buys) → basis 0
      // (neue Oversells werden seit R-20 vor dem Insert abgelehnt).
      const avgCostBasis = totalShares > 0 ? totalCost / totalShares : 0;
      const sellPrice = parseFloat(transaction.pricePerShare || '0');
      const sharesSold = parseFloat(transaction.shares || '0');

      const sellDateStr = new Date(transaction.transactionDate).toISOString().split('T')[0];
      const sellFxRate = await getFxRate(sellDateStr, currencyPair);
      // R-19: cost-weighted average buy FX rate of the REMAINING position
      // (was: FX rate at the FIRST buy's date). Empty basis → neutral (sell rate).
      const buyFxRate = totalCost > 0 ? totalCostChf / totalCost : sellFxRate;
      
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

// ============================================
// Price Alerts Functions
// ============================================

export async function createPriceAlert(alert: {
  userId: number;
  ticker: string;
  alertType: "above_price" | "below_price" | "percent_change";
  targetPrice?: string;
  percentChange?: string;
  notificationMethod: "email" | "whatsapp" | "both";
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    const { priceAlerts } = await import("../drizzle/schema");
    
    const [result] = await db.insert(priceAlerts).values({
      userId: alert.userId,
      ticker: alert.ticker,
      alertType: alert.alertType,
      targetPrice: alert.targetPrice || null,
      percentChange: alert.percentChange || null,
      notificationMethod: alert.notificationMethod,
      status: "active",
      isActive: 1,
    });

    return result;
  } catch (error) {
    console.error("[Database] Failed to create price alert:", error);
    throw error;
  }
}

export async function getUserPriceAlerts(userId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    const { priceAlerts } = await import("../drizzle/schema");
    
    const alerts = await db
      .select()
      .from(priceAlerts)
      .where(eq(priceAlerts.userId, userId))
      .orderBy(sql`${priceAlerts.createdAt} DESC`);

    return alerts;
  } catch (error) {
    console.error("[Database] Failed to get user price alerts:", error);
    return [];
  }
}

export async function getActivePriceAlerts() {
  const db = await getDb();
  if (!db) return [];

  try {
    const { priceAlerts } = await import("../drizzle/schema");
    
    const alerts = await db
      .select()
      .from(priceAlerts)
      .where(eq(priceAlerts.status, "active"))
      .orderBy(sql`${priceAlerts.createdAt} DESC`);

    return alerts;
  } catch (error) {
    console.error("[Database] Failed to get active price alerts:", error);
    return [];
  }
}

export async function updatePriceAlert(
  id: number,
  userId: number,
  updates: {
    targetPrice?: string;
    percentChange?: string;
    notificationMethod?: "email" | "whatsapp" | "both";
    status?: "active" | "triggered" | "disabled";
    isActive?: number;
    lastTriggered?: Date;
    triggeredAt?: Date;
  }
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    const { priceAlerts } = await import("../drizzle/schema");
    
    await db
      .update(priceAlerts)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(priceAlerts.id, id), eq(priceAlerts.userId, userId)));

    return { success: true };
  } catch (error) {
    console.error("[Database] Failed to update price alert:", error);
    throw error;
  }
}

export async function deletePriceAlert(id: number, userId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    const { priceAlerts } = await import("../drizzle/schema");
    
    await db
      .delete(priceAlerts)
      .where(and(eq(priceAlerts.id, id), eq(priceAlerts.userId, userId)));

    return { success: true };
  } catch (error) {
    console.error("[Database] Failed to delete price alert:", error);
    throw error;
  }
}

export async function togglePriceAlertStatus(id: number, userId: number, isActive: boolean) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    const { priceAlerts } = await import("../drizzle/schema");
    
    await db
      .update(priceAlerts)
      .set({
        isActive: isActive ? 1 : 0,
        status: isActive ? "active" : "disabled",
        updatedAt: new Date(),
      })
      .where(and(eq(priceAlerts.id, id), eq(priceAlerts.userId, userId)));

    return { success: true };
  } catch (error) {
    console.error("[Database] Failed to toggle price alert status:", error);
    throw error;
  }
}

export async function markPriceAlertTriggered(id: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    const { priceAlerts } = await import("../drizzle/schema");
    
    await db
      .update(priceAlerts)
      .set({
        status: "triggered",
        lastTriggered: new Date(),
        triggeredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(priceAlerts.id, id));

    return { success: true };
  } catch (error) {
    console.error("[Database] Failed to mark price alert as triggered:", error);
    throw error;
  }
}

// Password Reset Token Functions
import { passwordResetTokens, emailVerificationTokens, InsertPasswordResetToken, InsertEmailVerificationToken } from "../drizzle/schema";
import crypto from "crypto";

export async function createPasswordResetToken(userId: number): Promise<string> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

  await db.insert(passwordResetTokens).values({
    userId,
    token,
    expiresAt,
  });

  return token;
}

export async function verifyPasswordResetToken(token: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const tokenData = result[0];

  // Check if token is expired
  if (new Date() > tokenData.expiresAt) {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, tokenData.id));
    return null;
  }

  return tokenData;
}

export async function deletePasswordResetToken(tokenId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, tokenId));
}

// Email Verification Token Functions
export async function createEmailVerificationToken(userId: number): Promise<string> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 86400000); // 24 hours from now

  await db.insert(emailVerificationTokens).values({
    userId,
    token,
    expiresAt,
  });

  return token;
}

export async function verifyEmailVerificationToken(token: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.token, token))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const tokenData = result[0];

  // Check if token is expired
  if (new Date() > tokenData.expiresAt) {
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, tokenData.id));
    return null;
  }

  return tokenData;
}

export async function deleteEmailVerificationToken(tokenId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, tokenId));
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateUserPassword(userId: number, hashedPassword: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
}

export async function markEmailAsVerified(userId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.update(users).set({ emailVerified: 1 }).where(eq(users.id, userId));
}

// ============================================
// Portfolio Activation & Benchmark Functions
// ============================================

/**
 * Activate a portfolio by setting status to 'live', recording start capital, and generating initial buy transactions
 */
export async function activatePortfolio(
  portfolioId: number,
  userId: number,
  startCapital: string,
  benchmark?: "SMI" | "SP500" | "MSCI_WORLD"
) {
  const db = await getDb();
  if (!db) return null;

  try {
    // Get portfolio details
    const portfolio = await getSavedPortfolioById(portfolioId, userId);
    if (!portfolio) {
      throw new Error("Portfolio not found");
    }

    // Parse portfolio data to get holdings
    const portfolioData = JSON.parse(portfolio.portfolioData);
    const holdings = portfolioData.stocks || [];

    // Calculate transaction amounts based on weights
    const capitalNum = parseFloat(startCapital);
    const transactions = [];

    for (const holding of holdings) {
      const weight = parseFloat(holding.weight || "0") / 100;
      const allocationAmount = capitalNum * weight;
      const rawHoldingPrice = holding.currentPrice || '0';
      const currentPrice = (rawHoldingPrice === 'NA' || rawHoldingPrice === 'N/A') ? 0 : parseFloat(rawHoldingPrice);
      
      if (!isNaN(currentPrice) && currentPrice > 0) {
        const shares = (allocationAmount / currentPrice).toFixed(6);
        
        transactions.push({
          portfolioId,
          transactionType: "buy" as const,
          ticker: holding.ticker,
          shares,
          pricePerShare: holding.currentPrice,
          currency: holding.currency || "CHF",
          totalAmount: allocationAmount.toFixed(2),
          fxRate: holding.exchangeRateToChf || "1.0",
          totalAmountCHF: allocationAmount.toFixed(2),
          fees: "0",
          notes: `Initial purchase for portfolio activation`,
          transactionDate: new Date(),
        });
      }
    }

    // Create all transactions
    for (const transaction of transactions) {
      await createPortfolioTransaction(transaction);
    }

    // Update portfolio status
    const updates: any = {
      status: "live",
      startCapital,
      isLive: 1,
      liveStartDate: new Date(),
    };

    if (benchmark) {
      updates.benchmark = benchmark;
    }

    await db
      .update(savedPortfolios)
      .set(updates)
      .where(and(eq(savedPortfolios.id, portfolioId), eq(savedPortfolios.userId, userId)));

    return {
      success: true,
      transactionsCreated: transactions.length,
    };
  } catch (error) {
    console.error("[Database] Failed to activate portfolio:", error);
    throw error;
  }
}

/**
 * Get benchmark historical data for a specific benchmark and date range
 */
export async function getBenchmarkData(
  benchmark: "SMI" | "SP500" | "MSCI_WORLD",
  startDate?: string,
  endDate?: string
) {
  const db = await getDb();
  if (!db) return [];

  try {
    const { benchmarkData, historicalPrices } = await import("../drizzle/schema");
    
    const conditions = [eq(benchmarkData.benchmark, benchmark)];
    
    if (startDate) {
      conditions.push(gte(benchmarkData.date, startDate));
    }

    if (endDate) {
      conditions.push(lte(benchmarkData.date, endDate));
    }

    const results = await db
      .select()
      .from(benchmarkData)
      .where(and(...conditions))
      .orderBy(asc(benchmarkData.date));
      
    // If benchmarkData table has sufficient data covering the requested range, use it
    // Check that the data actually covers the requested period (not stale/old data)
    if (results.length >= 10) {
      const lastDate = results[results.length - 1]?.date;
      // Only use if the last data point is within 30 days of endDate
      const endDateObj = endDate ? new Date(endDate) : new Date();
      const lastDateObj = lastDate ? new Date(lastDate) : new Date(0);
      const daysDiff = (endDateObj.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff < 30) {
        return results;
      }
    }

    // Fallback: use historical_prices with proxy tickers
    const proxyTickers: Record<string, string> = {
      SMI: 'CHSPI.SW',
      SP500: 'SPY',
      MSCI_WORLD: 'ACWI.US',
    };
    const proxyTicker = proxyTickers[benchmark];
    if (!proxyTicker) return results;

    const hpConditions = [eq(historicalPrices.ticker, proxyTicker)];
    if (startDate) hpConditions.push(gte(historicalPrices.date, startDate));
    if (endDate) hpConditions.push(lte(historicalPrices.date, endDate));

    const hpResults = await db
      .select()
      .from(historicalPrices)
      .where(and(...hpConditions))
      .orderBy(asc(historicalPrices.date));

    return hpResults.map(r => ({
      id: 0,
      benchmark,
      date: r.date,
      close: r.close,
      source: 'historical_prices_fallback',
      createdAt: new Date(),
    }));
  } catch (error) {
    console.error("[Database] Failed to get benchmark data:", error);
    return [];
  }
}

/**
 * Insert or update benchmark data
 */
export async function upsertBenchmarkData(data: {
  benchmark: "SMI" | "SP500" | "MSCI_WORLD";
  date: string;
  close: string;
  source?: string;
}) {
  const db = await getDb();
  if (!db) return null;

  try {
    const { benchmarkData } = await import("../drizzle/schema");
    
    await db
      .insert(benchmarkData)
      .values({
        benchmark: data.benchmark,
        date: data.date,
        close: data.close,
        source: data.source || "eodhd",
      })
      .onDuplicateKeyUpdate({
        set: {
          close: data.close,
          updatedAt: new Date(),
        },
      });

    return { success: true };
  } catch (error) {
    console.error("[Database] Failed to upsert benchmark data:", error);
    throw error;
  }
}

/**
 * Calculate portfolio performance metrics (IRR, Beta, Sharpe Ratio)
 */
export async function calculatePortfolioMetrics(portfolioId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;

  try {
    // Get portfolio and transactions
    const portfolio = await getSavedPortfolioById(portfolioId, userId);
    if (!portfolio) return null;

    const transactions = await getPortfolioTransactions(portfolioId);
    
    // Calculate current portfolio value
    const portfolioData = JSON.parse(portfolio.portfolioData);
    const holdings = portfolioData.stocks || [];
    
    let currentValue = 0;
    let totalInvested = 0;

    // Calculate total invested from buy transactions
    for (const txn of transactions) {
      if (txn.transactionType === "buy") {
        totalInvested += parseFloat(txn.totalAmountCHF || "0");
      } else if (txn.transactionType === "sell") {
        totalInvested -= parseFloat(txn.totalAmountCHF || "0");
      }
    }

    // Calculate current value from holdings
    for (const holding of holdings) {
      const shares = parseFloat(holding.shares || "0");
      const rawCp = holding.currentPrice || '0';
      const currentPrice = (rawCp === 'NA' || rawCp === 'N/A') ? 0 : parseFloat(rawCp);
      if (!isNaN(currentPrice)) currentValue += shares * currentPrice;
    }

    // Simple return calculation
    const totalReturn = totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : 0;

    // Placeholder for more complex metrics (would need historical data)
    const metrics = {
      currentValue: currentValue.toFixed(2),
      totalInvested: totalInvested.toFixed(2),
      totalReturn: totalReturn.toFixed(2),
      irr: "0", // Would need cash flow dates for proper IRR calculation
      beta: "1.0", // Would need benchmark correlation
      sharpeRatio: "0", // Would need risk-free rate and volatility
    };

    return metrics;
  } catch (error) {
    console.error("[Database] Failed to calculate portfolio metrics:", error);
    return null;
  }
}


// ==========================================
// Logo Cache Functions
// ==========================================

/**
 * Get a cached logo by ticker
 * Returns null if not found or expired
 */
export async function getCachedLogo(ticker: string): Promise<LogoCache | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get cached logo: database not available");
    return null;
  }

  try {
    const result = await db
      .select()
      .from(logoCache)
      .where(eq(logoCache.ticker, ticker))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const cached = result[0];
    
    // Check if cache has expired
    if (cached.expiresAt && new Date(cached.expiresAt) < new Date()) {
      return null;
    }

    return cached;
  } catch (error) {
    console.error("[Database] Failed to get cached logo:", error);
    return null;
  }
}

/**
 * Save or update a logo in the cache
 * @param ticker Stock ticker
 * @param logoUrl URL of the logo (null if no logo found)
 * @param source Source of the logo (e.g., 'eodhd', 'fallback')
 * @param expiresInDays Number of days until cache expires (default: 30)
 */
export async function saveCachedLogo(
  ticker: string,
  logoUrl: string | null,
  source: string = "eodhd",
  expiresInDays: number = 30
): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot save cached logo: database not available");
    return;
  }

  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const values: InsertLogoCache = {
      ticker,
      logoUrl,
      source,
      lastFetched: new Date(),
      expiresAt,
    };

    await db
      .insert(logoCache)
      .values(values)
      .onDuplicateKeyUpdate({
        set: {
          logoUrl,
          source,
          lastFetched: new Date(),
          expiresAt,
        },
      });
  } catch (error) {
    console.error("[Database] Failed to save cached logo:", error);
  }
}

/**
 * Get multiple cached logos by tickers
 * Returns a map of ticker -> logoUrl
 */
export async function getCachedLogos(tickers: string[]): Promise<Map<string, string | null>> {
  const db = await getDb();
  const result = new Map<string, string | null>();
  
  if (!db || tickers.length === 0) {
    return result;
  }

  try {
    const { inArray } = await import("drizzle-orm");
    const cached = await db
      .select()
      .from(logoCache)
      .where(inArray(logoCache.ticker, tickers));

    const now = new Date();
    for (const item of cached) {
      // Skip expired entries
      if (item.expiresAt && new Date(item.expiresAt) < now) {
        continue;
      }
      result.set(item.ticker, item.logoUrl);
    }
  } catch (error) {
    console.error("[Database] Failed to get cached logos:", error);
  }

  return result;
}

/**
 * Delete expired logo cache entries
 * @returns Number of deleted entries
 */
export async function cleanupExpiredLogos(): Promise<number> {
  const db = await getDb();
  if (!db) {
    return 0;
  }

  try {
    const now = new Date();
    await db.delete(logoCache).where(lt(logoCache.expiresAt, now));
    return 1;
  } catch (error) {
    console.error("[Database] Failed to cleanup expired logos:", error);
    return 0;
  }
}
