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

/**
 * Get realized gains for a specific ticker in a portfolio
 */
export async function getRealizedGainsByTicker(portfolioId: number, ticker: string) {
  const db = await getDb();
  if (!db) return [];

  try {
    const { realizedGains } = await import("../drizzle/schema");
    const { and } = await import("drizzle-orm");

    const gains = await db
      .select()
      .from(realizedGains)
      .where(
        and(
          eq(realizedGains.portfolioId, portfolioId),
          eq(realizedGains.ticker, ticker)
        )
      )
      .orderBy(realizedGains.transactionDate);

    return gains;
  } catch (error) {
    console.error("[Database] Failed to get realized gains by ticker:", error);
    return [];
  }
}

/**
 * Get total realized gains for a portfolio
 */
export async function getTotalRealizedGains(portfolioId: number): Promise<number> {
  const gains = await getRealizedGainsByPortfolio(portfolioId);
  return gains.reduce((sum, gain) => sum + parseFloat(gain.realizedGain || "0"), 0);
}
