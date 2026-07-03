/**
 * Realized Gains Database Functions
 * Separate file to avoid circular dependencies
 */

import { eq } from "drizzle-orm";
import { getDb } from "./db";

/**
 * Get all realized gains for a portfolio
 */
export async function getRealizedGainsByPortfolio(portfolioId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    const { realizedGains } = await import("../drizzle/schema");

    const gains = await db
      .select()
      .from(realizedGains)
      .where(eq(realizedGains.portfolioId, portfolioId))
      .orderBy(realizedGains.transactionDate);

    return gains;
  } catch (error) {
    console.error("[Database] Failed to get realized gains:", error);
    return [];
  }
}
