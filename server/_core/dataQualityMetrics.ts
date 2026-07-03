/**
 * Data Quality Metrics
 * 
 * Analyzes stock data completeness and quality metrics:
 * - % stocks with Sharpe Ratio
 * - % stocks with dividend yield
 * - % stocks with PE ratio
 * - % stocks with PEG ratio
 * - % stocks with beta
 * - % stocks with volatility
 * - Stocks with stale data (>7 days old)
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { stocks } from '../../drizzle/schema';

import { ENV } from "./env";
export interface DataQualityMetrics {
  totalStocks: number;
  sharpeRatioCompleteness: number; // percentage
  dividendYieldCompleteness: number;
  peRatioCompleteness: number;
  pegRatioCompleteness: number;
  betaCompleteness: number;
  volatilityCompleteness: number;
  staleDataCount: number; // stocks with data >7 days old
  staleDataStocks: string[]; // tickers with stale data
  missingMetrics: {
    sharpeRatio: string[];
    dividendYield: string[];
    peRatio: string[];
    pegRatio: string[];
    beta: string[];
    volatility: string[];
  };
}

/**
 * Calculate data quality metrics for all stocks
 */
export async function calculateDataQualityMetrics(): Promise<DataQualityMetrics> {
  let connection: mysql.Connection | null = null;

  try {
    if (!ENV.databaseUrl) {
      throw new Error('DATABASE_URL not configured');
    }

    connection = await mysql.createConnection(ENV.databaseUrl);
    const db = drizzle(connection);

    // Get all stocks
    const allStocks = await db.select().from(stocks);
    const totalStocks = allStocks.length;

    if (totalStocks === 0) {
      return {
        totalStocks: 0,
        sharpeRatioCompleteness: 0,
        dividendYieldCompleteness: 0,
        peRatioCompleteness: 0,
        pegRatioCompleteness: 0,
        betaCompleteness: 0,
        volatilityCompleteness: 0,
        staleDataCount: 0,
        staleDataStocks: [],
        missingMetrics: {
          sharpeRatio: [],
          dividendYield: [],
          peRatio: [],
          pegRatio: [],
          beta: [],
          volatility: [],
        },
      };
    }

    // Calculate completeness for each metric
    const hasValue = (value: string | null | undefined): boolean => {
      if (value === null || value === undefined) return false;
      const num = parseFloat(value);
      return !isNaN(num);
    };

    let sharpeCount = 0;
    let dividendCount = 0;
    let peCount = 0;
    let pegCount = 0;
    let betaCount = 0;
    let volatilityCount = 0;

    const missingSharpe: string[] = [];
    const missingDividend: string[] = [];
    const missingPe: string[] = [];
    const missingPeg: string[] = [];
    const missingBeta: string[] = [];
    const missingVolatility: string[] = [];

    // Calculate stale data (>7 days old)
    const staleThreshold = new Date();
    staleThreshold.setDate(staleThreshold.getDate() - 7);
    const staleStocks: string[] = [];

    for (const stock of allStocks) {
      // Count completeness
      if (hasValue(stock.sharpeRatio)) {
        sharpeCount++;
      } else {
        missingSharpe.push(stock.ticker);
      }

      if (hasValue(stock.dividendYield)) {
        dividendCount++;
      } else {
        missingDividend.push(stock.ticker);
      }

      if (hasValue(stock.peRatio)) {
        peCount++;
      } else {
        missingPe.push(stock.ticker);
      }

      if (hasValue(stock.pegRatio)) {
        pegCount++;
      } else {
        missingPeg.push(stock.ticker);
      }

      if (hasValue(stock.beta)) {
        betaCount++;
      } else {
        missingBeta.push(stock.ticker);
      }

      if (hasValue(stock.volatility)) {
        volatilityCount++;
      } else {
        missingVolatility.push(stock.ticker);
      }

      // Check for stale data
      if (!stock.lastDataRefresh || stock.lastDataRefresh < staleThreshold) {
        staleStocks.push(stock.ticker);
      }
    }

    return {
      totalStocks,
      sharpeRatioCompleteness: Math.round((sharpeCount / totalStocks) * 100),
      dividendYieldCompleteness: Math.round((dividendCount / totalStocks) * 100),
      peRatioCompleteness: Math.round((peCount / totalStocks) * 100),
      pegRatioCompleteness: Math.round((pegCount / totalStocks) * 100),
      betaCompleteness: Math.round((betaCount / totalStocks) * 100),
      volatilityCompleteness: Math.round((volatilityCount / totalStocks) * 100),
      staleDataCount: staleStocks.length,
      staleDataStocks: staleStocks,
      missingMetrics: {
        sharpeRatio: missingSharpe,
        dividendYield: missingDividend,
        peRatio: missingPe,
        pegRatio: missingPeg,
        beta: missingBeta,
        volatility: missingVolatility,
      },
    };

  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
