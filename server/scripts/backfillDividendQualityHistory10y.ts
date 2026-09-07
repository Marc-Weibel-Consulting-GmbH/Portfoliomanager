/**
 * Targeted EODHD backfill for active curated recommendation titles that do not
 * yet prove a ten-calendar-year local history. It writes only price dates before
 * the earliest stored price for each ticker (or the whole range if absent), and
 * therefore never replaces an already persisted observation.
 *
 * Run via: pnpm tsx server/scripts/backfillDividendQualityHistory10y.ts
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import { historicalPrices, stocks } from '../../drizzle/schema';
import { getDb } from '../db';
import { getEodhdApiKey } from '../_core/env';
import { toEodhdSymbol } from '../lib/eodhdSymbol';
import { buildTenYearHistoryBackfillPlan, filterStrictlyMissingHistoryDays, filterUnpersistedHistoryDays, findEarliestNormalizedHistoryDate } from '../lib/historicalBackfillPlan';
import { normalizeTickerForDb } from '../tickerNormalization';

const AS_OF_DATE = new Date().toISOString().slice(0, 10);
const REQUEST_INTERVAL_MS = 250;
const REQUEST_TIMEOUT_MS = 15_000;
const EODHD_BASE_URL = 'https://eodhd.com/api/eod';

interface EodhdDay {
  date: string;
  close: number;
  adjusted_close?: number;
}

interface ManifestRow {
  ticker: string;
  companyName: string;
  eodhdSymbol: string;
  earliestBefore: string | null;
  plan: ReturnType<typeof buildTenYearHistoryBackfillPlan>;
  fetchedRows: number;
  insertedRows: number;
  earliestAfter: string | null;
  status: 'skipped_complete' | 'backfilled' | 'no_eodhd_data' | 'error';
  error?: string;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchRange(symbol: string, fromDate: string, toDate: string, apiKey: string): Promise<EodhdDay[]> {
  const url = `${EODHD_BASE_URL}/${encodeURIComponent(symbol)}?api_token=${encodeURIComponent(apiKey)}&fmt=json&from=${fromDate}&to=${toDate}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`EODHD HTTP ${response.status} for ${symbol}`);
  const payload = await response.json();
  return Array.isArray(payload)
    ? payload.filter((row): row is EodhdDay => typeof row?.date === 'string' && Number.isFinite(Number(row?.close)))
    : [];
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const apiKey = await getEodhdApiKey();
  if (!apiKey) throw new Error('EODHD_API_KEY is not configured');

  const activeRecommendations = await db
    .select({ ticker: stocks.ticker, companyName: stocks.companyName })
    .from(stocks)
    .where(and(eq(stocks.listType, 'empfehlung'), eq(stocks.isActive, 1)))
    .orderBy(asc(stocks.ticker));
  const historyCoverage = await db
    .select({
      ticker: historicalPrices.ticker,
      earliestDate: sql<string | null>`MIN(${historicalPrices.date})`,
    })
    .from(historicalPrices)
    .groupBy(historicalPrices.ticker);

  const manifest: ManifestRow[] = [];
  console.log(`[DividendQuality10Y] ${activeRecommendations.length} active curated recommendation titles; reference date ${AS_OF_DATE}`);

  for (const [index, stock] of activeRecommendations.entries()) {
    const ticker = normalizeTickerForDb(stock.ticker);
    const earliestBefore = findEarliestNormalizedHistoryDate(stock.ticker, historyCoverage);
    const plan = buildTenYearHistoryBackfillPlan({ ticker, earliestDate: earliestBefore, asOfDate: AS_OF_DATE });
    const base: Omit<ManifestRow, 'fetchedRows' | 'insertedRows' | 'earliestAfter' | 'status'> = {
      ticker,
      companyName: stock.companyName,
      eodhdSymbol: toEodhdSymbol(ticker),
      earliestBefore,
      plan,
    };

    if (!plan) {
      manifest.push({ ...base, fetchedRows: 0, insertedRows: 0, earliestAfter: earliestBefore, status: 'skipped_complete' });
      continue;
    }

    try {
      console.log(`[DividendQuality10Y] ${index + 1}/${activeRecommendations.length} ${ticker}: ${plan.reason}`);
      const days = await fetchRange(base.eodhdSymbol, plan.fromDate, plan.toDate, apiKey);
      await sleep(REQUEST_INTERVAL_MS);
      if (days.length === 0) {
        manifest.push({ ...base, fetchedRows: 0, insertedRows: 0, earliestAfter: earliestBefore, status: 'no_eodhd_data' });
        continue;
      }

      const persistedDays = await db
        .select({ date: historicalPrices.date })
        .from(historicalPrices)
        .where(and(
          eq(historicalPrices.ticker, ticker),
          gte(historicalPrices.date, plan.fromDate),
          lte(historicalPrices.date, plan.toDate),
        ));
      const onlyNewDays = filterUnpersistedHistoryDays(
        filterStrictlyMissingHistoryDays(days, earliestBefore),
        persistedDays.map(day => day.date),
      );
      if (onlyNewDays.length > 0) {
        await db.insert(historicalPrices).values(onlyNewDays.map(day => ({
          ticker,
          date: day.date,
          close: String(day.close),
          adjustedClose: String(day.adjusted_close ?? day.close),
          source: 'eodhd',
        })));
      }

      const earliestAfter = onlyNewDays.reduce<string | null>(
        (earliest, day) => !earliest || day.date < earliest ? day.date : earliest,
        earliestBefore,
      );
      manifest.push({
        ...base,
        fetchedRows: days.length,
        insertedRows: onlyNewDays.length,
        earliestAfter,
        status: 'backfilled',
      });
    } catch (error) {
      manifest.push({
        ...base,
        fetchedRows: 0,
        insertedRows: 0,
        earliestAfter: earliestBefore,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
      await sleep(REQUEST_INTERVAL_MS);
    }
  }

  const directory = join(process.cwd(), 'docs', 'audit');
  await mkdir(directory, { recursive: true });
  const manifestPath = join(directory, `EODHD_DIVIDEND_QUALITY_10Y_BACKFILL_${AS_OF_DATE}.json`);
  await writeFile(manifestPath, `${JSON.stringify({ asOfDate: AS_OF_DATE, rows: manifest }, null, 2)}\n`, 'utf8');

  const summary = manifest.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    acc.fetchedRows += row.fetchedRows;
    acc.insertedRows += row.insertedRows;
    return acc;
  }, { skipped_complete: 0, backfilled: 0, no_eodhd_data: 0, error: 0, fetchedRows: 0, insertedRows: 0 });
  console.log('[DividendQuality10Y] Summary:', JSON.stringify(summary));
  console.log(`[DividendQuality10Y] Manifest: ${manifestPath}`);
  process.exit(0);
}

main().catch(error => {
  console.error('[DividendQuality10Y] Fatal error:', error);
  process.exitCode = 1;
});
