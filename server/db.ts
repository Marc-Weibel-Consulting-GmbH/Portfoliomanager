import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertStock, InsertUser, stocks, users } from "../drizzle/schema";
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
