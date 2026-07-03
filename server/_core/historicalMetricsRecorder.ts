/**
 * Historical Metrics Recorder
 * 
 * Automatically records stock metrics to historicalMetrics table
 * whenever stock data is refreshed.
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { historicalMetrics, type InsertHistoricalMetric } from '../../drizzle/schema';

import { ENV } from "./env";
export interface MetricsSnapshot {
  ticker: string;
  sharpeRatio?: string | null;
  peRatio?: string | null;
  pegRatio?: string | null;
  dividendYield?: string | null;
  beta?: string | null;
  volatility?: string | null;
  currentPrice?: string | null;
}

/**
 * Record a metrics snapshot to historical table
 */
export async function recordMetricsSnapshot(snapshot: MetricsSnapshot): Promise<void> {
  let connection: mysql.Connection | null = null;

  try {
    if (!ENV.databaseUrl) {
      console.warn('[HistoricalMetrics] DATABASE_URL not configured');
      return;
    }

    connection = await mysql.createConnection(ENV.databaseUrl);
    const db = drizzle(connection);

    const record: InsertHistoricalMetric = {
      ticker: snapshot.ticker,
      recordedAt: new Date(),
      sharpeRatio: snapshot.sharpeRatio || null,
      peRatio: snapshot.peRatio || null,
      pegRatio: snapshot.pegRatio || null,
      dividendYield: snapshot.dividendYield || null,
      beta: snapshot.beta || null,
      volatility: snapshot.volatility || null,
      currentPrice: snapshot.currentPrice || null,
    };

    await db.insert(historicalMetrics).values(record);
    console.log(`[HistoricalMetrics] Recorded snapshot for ${snapshot.ticker}`);

  } catch (error: any) {
    console.error(`[HistoricalMetrics] Failed to record snapshot for ${snapshot.ticker}:`, error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

/**
 * Get historical metrics for a ticker
 * @param ticker Stock ticker symbol
 * @param days Number of days to look back (default: 30)
 */
export async function getHistoricalMetrics(ticker: string, days: number = 30) {
  let connection: mysql.Connection | null = null;

  try {
    if (!ENV.databaseUrl) {
      throw new Error('DATABASE_URL not configured');
    }

    connection = await mysql.createConnection(ENV.databaseUrl);
    const db = drizzle(connection);

    const { eq, gte, desc, and } = await import('drizzle-orm');

    // Calculate date threshold
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);

    // Query historical metrics
    const results = await db
      .select()
      .from(historicalMetrics)
      .where(and(
        eq(historicalMetrics.ticker, ticker),
        gte(historicalMetrics.recordedAt, dateThreshold)
      ))
      .orderBy(desc(historicalMetrics.recordedAt));

    return results;

  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

/**
 * Get trend summary for a ticker
 * Calculates change percentage for key metrics
 */
export async function getTrendSummary(ticker: string, days: number = 30) {
  const history = await getHistoricalMetrics(ticker, days);

  if (history.length < 2) {
    return null; // Not enough data for trend
  }

  const latest = history[0];
  const oldest = history[history.length - 1];

  const calculateChange = (current: string | null, previous: string | null): number | null => {
    if (!current || !previous) return null;
    const curr = parseFloat(current);
    const prev = parseFloat(previous);
    if (isNaN(curr) || isNaN(prev) || prev === 0) return null;
    return ((curr - prev) / prev) * 100;
  };

  return {
    ticker,
    period: `${days} days`,
    dataPoints: history.length,
    sharpeRatioChange: calculateChange(latest.sharpeRatio, oldest.sharpeRatio),
    peRatioChange: calculateChange(latest.peRatio, oldest.peRatio),
    dividendYieldChange: calculateChange(latest.dividendYield, oldest.dividendYield),
    priceChange: calculateChange(latest.currentPrice, oldest.currentPrice),
    latestValues: {
      sharpeRatio: latest.sharpeRatio,
      peRatio: latest.peRatio,
      dividendYield: latest.dividendYield,
      currentPrice: latest.currentPrice,
    },
  };
}
