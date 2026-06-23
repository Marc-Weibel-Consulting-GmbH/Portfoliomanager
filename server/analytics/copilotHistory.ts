/**
 * Copilot History Service
 * 
 * Tracks all copilot recommendations over time and validates their accuracy
 * by checking actual price movements after 30, 60, and 90 days.
 */

import { getDb } from "../db";
import { copilotHistory } from "../../drizzle/schema";
import { eq, and, lte, isNull, desc, sql } from "drizzle-orm";
import yahooFinance from 'yahoo-finance2';

// ============ TYPES ============

export interface CopilotRecommendation {
  portfolioId: number;
  userId: number;
  ticker: string;
  companyName?: string;
  signal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  rankScore: number;
  confidence?: string;
  priceAtSignal: string;
  currency?: string;
  targetWeight?: string;
  currentWeight?: string;
  source: 'copilot_analysis' | 'walk_forward' | 'rebalancing';
}

export interface HistoryEntry {
  id: number;
  ticker: string;
  companyName: string | null;
  signal: string;
  rankScore: number;
  confidence: string | null;
  priceAtSignal: string;
  currency: string | null;
  priceAfter30d: string | null;
  priceAfter60d: string | null;
  priceAfter90d: string | null;
  returnAfter30d: string | null;
  returnAfter60d: string | null;
  returnAfter90d: string | null;
  wasCorrect30d: number | null;
  wasCorrect60d: number | null;
  wasCorrect90d: number | null;
  source: string;
  appliedAsTransaction: number;
  createdAt: Date;
}

export interface HistoryStats {
  totalRecommendations: number;
  evaluatedRecommendations: number;
  hitRate30d: number;
  hitRate60d: number;
  hitRate90d: number;
  avgReturn30d: number;
  avgReturn60d: number;
  avgReturn90d: number;
  bestPick: { ticker: string; return90d: number } | null;
  worstPick: { ticker: string; return90d: number } | null;
  bySignalType: Record<string, { count: number; hitRate: number; avgReturn: number }>;
}

// ============ SAVE RECOMMENDATIONS ============

/**
 * Save a copilot recommendation to history
 */
export async function saveCopilotRecommendation(rec: CopilotRecommendation): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(copilotHistory).values({
      portfolioId: rec.portfolioId,
      userId: rec.userId,
      ticker: rec.ticker,
      companyName: rec.companyName || null,
      signal: rec.signal,
      rankScore: rec.rankScore,
      confidence: rec.confidence || null,
      priceAtSignal: rec.priceAtSignal,
      currency: rec.currency || 'USD',
      targetWeight: rec.targetWeight || null,
      currentWeight: rec.currentWeight || null,
      source: rec.source,
      appliedAsTransaction: 0,
    });

    return (result as any)[0]?.insertId || null;
  } catch (error) {
    console.error(`[CopilotHistory] Failed to save recommendation:`, error);
    return null;
  }
}

/**
 * Save multiple recommendations at once (batch)
 */
export async function saveCopilotRecommendations(recs: CopilotRecommendation[]): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  let saved = 0;
  for (const rec of recs) {
    const id = await saveCopilotRecommendation(rec);
    if (id) saved++;
  }
  return saved;
}

// ============ MARK AS APPLIED ============

/**
 * Mark a recommendation as applied (converted to transaction)
 */
export async function markRecommendationAsApplied(historyId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .update(copilotHistory)
      .set({ appliedAsTransaction: 1 })
      .where(eq(copilotHistory.id, historyId));
    return true;
  } catch (error) {
    console.error(`[CopilotHistory] Failed to mark as applied:`, error);
    return false;
  }
}

// ============ EVALUATE RECOMMENDATIONS ============

/**
 * Evaluate past recommendations by checking current prices
 * Called periodically (e.g., daily) to update 30d/60d/90d performance
 */
export async function evaluateRecommendations(): Promise<{ evaluated: number; errors: number }> {
  const db = await getDb();
  if (!db) return { evaluated: 0, errors: 0 };

  let evaluated = 0;
  let errors = 0;

  // Find recommendations that need evaluation
  // 30d: created >= 30 days ago, priceAfter30d is null
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Get recommendations needing 30d evaluation
  const needs30d = await db
    .select()
    .from(copilotHistory)
    .where(and(
      lte(copilotHistory.createdAt, thirtyDaysAgo),
      isNull(copilotHistory.priceAfter30d)
    ))
    .limit(50);

  // Get recommendations needing 60d evaluation
  const needs60d = await db
    .select()
    .from(copilotHistory)
    .where(and(
      lte(copilotHistory.createdAt, sixtyDaysAgo),
      isNull(copilotHistory.priceAfter60d)
    ))
    .limit(50);

  // Get recommendations needing 90d evaluation
  const needs90d = await db
    .select()
    .from(copilotHistory)
    .where(and(
      lte(copilotHistory.createdAt, ninetyDaysAgo),
      isNull(copilotHistory.priceAfter90d)
    ))
    .limit(50);

  // Process 30d evaluations
  for (const rec of needs30d) {
    try {
      const targetDate = new Date(rec.createdAt);
      targetDate.setDate(targetDate.getDate() + 30);
      
      const price = await getHistoricalPrice(rec.ticker, targetDate);
      if (price !== null) {
        const signalPrice = parseFloat(rec.priceAtSignal);
        const returnPct = signalPrice > 0 ? ((price - signalPrice) / signalPrice) * 100 : 0;
        const wasCorrect = isSignalCorrect(rec.signal, returnPct);
        
        await db.update(copilotHistory).set({
          priceAfter30d: price.toString(),
          returnAfter30d: returnPct.toFixed(2),
          wasCorrect30d: wasCorrect ? 1 : 0,
        }).where(eq(copilotHistory.id, rec.id));
        
        evaluated++;
      }
    } catch (e) {
      errors++;
    }
    await new Promise(r => setTimeout(r, 200)); // Rate limit
  }

  // Process 60d evaluations
  for (const rec of needs60d) {
    try {
      const targetDate = new Date(rec.createdAt);
      targetDate.setDate(targetDate.getDate() + 60);
      
      const price = await getHistoricalPrice(rec.ticker, targetDate);
      if (price !== null) {
        const signalPrice = parseFloat(rec.priceAtSignal);
        const returnPct = signalPrice > 0 ? ((price - signalPrice) / signalPrice) * 100 : 0;
        const wasCorrect = isSignalCorrect(rec.signal, returnPct);
        
        await db.update(copilotHistory).set({
          priceAfter60d: price.toString(),
          returnAfter60d: returnPct.toFixed(2),
          wasCorrect60d: wasCorrect ? 1 : 0,
        }).where(eq(copilotHistory.id, rec.id));
        
        evaluated++;
      }
    } catch (e) {
      errors++;
    }
    await new Promise(r => setTimeout(r, 200));
  }

  // Process 90d evaluations
  for (const rec of needs90d) {
    try {
      const targetDate = new Date(rec.createdAt);
      targetDate.setDate(targetDate.getDate() + 90);
      
      const price = await getHistoricalPrice(rec.ticker, targetDate);
      if (price !== null) {
        const signalPrice = parseFloat(rec.priceAtSignal);
        const returnPct = signalPrice > 0 ? ((price - signalPrice) / signalPrice) * 100 : 0;
        const wasCorrect = isSignalCorrect(rec.signal, returnPct);
        
        await db.update(copilotHistory).set({
          priceAfter90d: price.toString(),
          returnAfter90d: returnPct.toFixed(2),
          wasCorrect90d: wasCorrect ? 1 : 0,
        }).where(eq(copilotHistory.id, rec.id));
        
        evaluated++;
      }
    } catch (e) {
      errors++;
    }
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`[CopilotHistory] Evaluated ${evaluated} recommendations, ${errors} errors`);
  return { evaluated, errors };
}

/**
 * Get historical price for a ticker at a specific date
 */
async function getHistoricalPrice(ticker: string, date: Date): Promise<number | null> {
  try {
    // Try to get from DB first
    const db = await getDb();
    if (db) {
      const { historicalPrices } = await import("../../drizzle/schema");
      const { eq, and, lte, desc } = await import("drizzle-orm");
      
      const dateStr = date.toISOString().split('T')[0];
      const result = await db
        .select({ close: historicalPrices.close })
        .from(historicalPrices)
        .where(and(
          eq(historicalPrices.ticker, ticker),
          lte(historicalPrices.date, dateStr)
        ))
        .orderBy(desc(historicalPrices.date))
        .limit(1);
      
      if (result.length > 0) {
        return parseFloat(String(result[0].close));
      }
    }
    
    // Fallback to Yahoo Finance
    const startDate = new Date(date);
    startDate.setDate(startDate.getDate() - 5);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 5);
    
    // Convert DB ticker format to Yahoo format
    const yahooTicker = convertToYahooTicker(ticker);
    
    const result: any = await yahooFinance.chart(yahooTicker, {
      period1: startDate.toISOString().split('T')[0],
      period2: endDate.toISOString().split('T')[0],
      interval: '1d'
    });
    
    if (result?.quotes && result.quotes.length > 0) {
      // Find closest date
      const targetTime = date.getTime();
      let closest = result.quotes[0];
      for (const q of result.quotes) {
        if (Math.abs(new Date(q.date).getTime() - targetTime) < Math.abs(new Date(closest.date).getTime() - targetTime)) {
          closest = q;
        }
      }
      return closest.close || null;
    }
    
    return null;
  } catch (error) {
    console.error(`[CopilotHistory] Failed to get price for ${ticker}:`, error);
    return null;
  }
}

/**
 * Convert DB ticker format (AAPL.US) to Yahoo format (AAPL)
 */
function convertToYahooTicker(ticker: string): string {
  if (ticker.endsWith('.US')) return ticker.replace('.US', '');
  if (ticker.endsWith('.SW')) return ticker.replace('.SW', '.SW'); // Yahoo uses .SW for Swiss
  if (ticker.endsWith('.DE')) return ticker.replace('.DE', '.DE'); // Yahoo uses .DE for German
  return ticker;
}

/**
 * Check if a signal was correct based on actual return
 */
function isSignalCorrect(signal: string, returnPct: number): boolean {
  switch (signal) {
    case 'strong_buy':
    case 'buy':
      return returnPct > 0; // Price went up = correct
    case 'sell':
    case 'strong_sell':
      return returnPct < 0; // Price went down = correct
    case 'hold':
      return Math.abs(returnPct) < 5; // Stayed within 5% = correct
    default:
      return false;
  }
}

// ============ QUERY HISTORY ============

/**
 * Get copilot history for a portfolio
 */
export async function getCopilotHistoryForPortfolio(
  portfolioId: number | undefined,
  userId: number,
  limit: number = 50
): Promise<HistoryEntry[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(copilotHistory.userId, userId)];
  if (portfolioId) {
    conditions.push(eq(copilotHistory.portfolioId, portfolioId));
  }

  const results = await db
    .select()
    .from(copilotHistory)
    .where(and(...conditions))
    .orderBy(desc(copilotHistory.createdAt))
    .limit(limit);

  return results as HistoryEntry[];
}

/**
 * Get aggregated stats for copilot history
 */
export async function getCopilotHistoryStats(
  userId: number,
  portfolioId?: number
): Promise<HistoryStats> {
  const db = await getDb();
  if (!db) return getEmptyStats();

  const conditions = [eq(copilotHistory.userId, userId)];
  if (portfolioId) {
    conditions.push(eq(copilotHistory.portfolioId, portfolioId));
  }

  const allRecs = await db
    .select()
    .from(copilotHistory)
    .where(and(...conditions))
    .orderBy(desc(copilotHistory.createdAt));

  if (allRecs.length === 0) return getEmptyStats();

  // Calculate stats
  const evaluated30d = allRecs.filter(r => r.wasCorrect30d !== null);
  const evaluated60d = allRecs.filter(r => r.wasCorrect60d !== null);
  const evaluated90d = allRecs.filter(r => r.wasCorrect90d !== null);

  const hitRate30d = evaluated30d.length > 0
    ? evaluated30d.filter(r => r.wasCorrect30d === 1).length / evaluated30d.length
    : 0;
  const hitRate60d = evaluated60d.length > 0
    ? evaluated60d.filter(r => r.wasCorrect60d === 1).length / evaluated60d.length
    : 0;
  const hitRate90d = evaluated90d.length > 0
    ? evaluated90d.filter(r => r.wasCorrect90d === 1).length / evaluated90d.length
    : 0;

  const returns30d = evaluated30d
    .filter(r => r.returnAfter30d)
    .map(r => parseFloat(r.returnAfter30d!));
  const returns60d = evaluated60d
    .filter(r => r.returnAfter60d)
    .map(r => parseFloat(r.returnAfter60d!));
  const returns90d = evaluated90d
    .filter(r => r.returnAfter90d)
    .map(r => parseFloat(r.returnAfter90d!));

  const avgReturn30d = returns30d.length > 0 ? returns30d.reduce((a, b) => a + b, 0) / returns30d.length : 0;
  const avgReturn60d = returns60d.length > 0 ? returns60d.reduce((a, b) => a + b, 0) / returns60d.length : 0;
  const avgReturn90d = returns90d.length > 0 ? returns90d.reduce((a, b) => a + b, 0) / returns90d.length : 0;

  // Best and worst picks
  let bestPick = null;
  let worstPick = null;
  if (evaluated90d.length > 0) {
    const sorted = evaluated90d
      .filter(r => r.returnAfter90d)
      .sort((a, b) => parseFloat(b.returnAfter90d!) - parseFloat(a.returnAfter90d!));
    if (sorted.length > 0) {
      bestPick = { ticker: sorted[0].ticker, return90d: parseFloat(sorted[0].returnAfter90d!) };
      worstPick = { ticker: sorted[sorted.length - 1].ticker, return90d: parseFloat(sorted[sorted.length - 1].returnAfter90d!) };
    }
  }

  // By signal type
  const bySignalType: Record<string, { count: number; hitRate: number; avgReturn: number }> = {};
  const signalTypes = ['strong_buy', 'buy', 'hold', 'sell', 'strong_sell'];
  for (const signal of signalTypes) {
    const signalRecs = allRecs.filter(r => r.signal === signal);
    const signalEvaluated = signalRecs.filter(r => r.wasCorrect30d !== null);
    const signalHits = signalEvaluated.filter(r => r.wasCorrect30d === 1);
    const signalReturns = signalRecs
      .filter(r => r.returnAfter30d)
      .map(r => parseFloat(r.returnAfter30d!));
    
    bySignalType[signal] = {
      count: signalRecs.length,
      hitRate: signalEvaluated.length > 0 ? signalHits.length / signalEvaluated.length : 0,
      avgReturn: signalReturns.length > 0 ? signalReturns.reduce((a, b) => a + b, 0) / signalReturns.length : 0,
    };
  }

  return {
    totalRecommendations: allRecs.length,
    evaluatedRecommendations: evaluated30d.length,
    hitRate30d,
    hitRate60d,
    hitRate90d,
    avgReturn30d,
    avgReturn60d,
    avgReturn90d,
    bestPick,
    worstPick,
    bySignalType,
  };
}

function getEmptyStats(): HistoryStats {
  return {
    totalRecommendations: 0,
    evaluatedRecommendations: 0,
    hitRate30d: 0,
    hitRate60d: 0,
    hitRate90d: 0,
    avgReturn30d: 0,
    avgReturn60d: 0,
    avgReturn90d: 0,
    bestPick: null,
    worstPick: null,
    bySignalType: {},
  };
}
