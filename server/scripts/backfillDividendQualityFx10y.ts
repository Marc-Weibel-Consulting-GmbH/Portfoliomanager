/**
 * Einmaliger, rein additiver FX-Backfill für den 10-Jahres-Dividendenmodus.
 *
 * Voraussetzung: Die Aktie selbst muss vor dem Stichtag eine Kursreihe haben.
 * Es werden nur fehlende FX-Tage vor dem jeweils frühesten existierenden Satz
 * ergänzt. Bestehende Raten, Portfolios und Transaktionen werden nie geändert.
 */
import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { writeFile } from "node:fs/promises";
import { getDb } from "../db";
import { exchangeRates, historicalPrices, stocks } from "../../drizzle/schema";
import { normalizeTickerForDb } from "../tickerNormalization";
import {
  buildHistoricalFxBackfillPlan,
  currencyToChfPair,
  filterNewHistoricalFxRates,
} from "../lib/historicalFxBackfillPlan";

const REQUIRED_START_DATE = process.argv[2] ?? "2016-09-07";
const REQUEST_TIMEOUT_MS = 15_000;
const MANIFEST_PATH = "docs/audit/EODHD_DIVIDEND_QUALITY_10Y_FX_BACKFILL_2026-09-07.json";

type EodhdForexRow = { date?: string; close?: number | string | null };

function assertIsoDay(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Startdatum muss YYYY-MM-DD sein");
}

async function fetchForexWindow(currencyPair: string, from: string, to: string): Promise<EodhdForexRow[]> {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) throw new Error("EODHD_API_KEY fehlt");
  const url = new URL(`https://eodhd.com/api/eod/${currencyPair}.FOREX`);
  url.searchParams.set("api_token", apiKey);
  url.searchParams.set("fmt", "json");
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`EODHD HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error("EODHD lieferte keine Tagesreihe");
  return data as EodhdForexRow[];
}

async function main(): Promise<void> {
  assertIsoDay(REQUIRED_START_DATE);
  const db = await getDb();
  if (!db) throw new Error("Datenbank nicht verfügbar");

  const stockRows = await db
    .select({ ticker: stocks.ticker, currency: stocks.currency })
    .from(stocks)
    .where(eq(stocks.listType, "empfehlung"));
  const canonicalTickers = [...new Set(stockRows.map((row) => normalizeTickerForDb(row.ticker)))];
  const priceStarts = canonicalTickers.length === 0 ? [] : await db
    .select({ ticker: historicalPrices.ticker, firstDate: sql<string>`MIN(${historicalPrices.date})` })
    .from(historicalPrices)
    .where(inArray(historicalPrices.ticker, canonicalTickers))
    .groupBy(historicalPrices.ticker);
  const coveredTickers = new Set(priceStarts.filter((row) => row.firstDate <= REQUIRED_START_DATE).map((row) => row.ticker));
  const currencies = stockRows
    .filter((row) => coveredTickers.has(normalizeTickerForDb(row.ticker)))
    .map((row) => row.currency ?? "USD");
  const pairs = [...new Set(currencies.map(currencyToChfPair).filter((pair): pair is string => Boolean(pair)))];
  const currentRows = pairs.length === 0 ? [] : await db
    .select({ currencyPair: exchangeRates.currencyPair, date: exchangeRates.date })
    .from(exchangeRates)
    .where(inArray(exchangeRates.currencyPair, pairs));
  const earliestExistingByPair: Record<string, string | undefined> = {};
  const existingDatesByPair = new Map<string, Set<string>>();
  for (const row of currentRows) {
    const dates = existingDatesByPair.get(row.currencyPair) ?? new Set<string>();
    dates.add(row.date);
    existingDatesByPair.set(row.currencyPair, dates);
    if (!earliestExistingByPair[row.currencyPair] || row.date < earliestExistingByPair[row.currencyPair]!) {
      earliestExistingByPair[row.currencyPair] = row.date;
    }
  }
  const plan = buildHistoricalFxBackfillPlan({ currencies, requiredStartDate: REQUIRED_START_DATE, earliestExistingByPair });
  const manifest: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    requiredStartDate: REQUIRED_START_DATE,
    coveredRecommendationTitles: coveredTickers.size,
    requestedPairs: pairs,
    windows: [],
  };

  for (const window of plan) {
    process.stdout.write(`[FX-Backfill] ${window.currencyPair}: ${window.from} bis ${window.to} ... `);
    const entry: Record<string, unknown> = { ...window, status: "pending" };
    try {
      const rawRows = await fetchForexWindow(window.currencyPair, window.from, window.to);
      const newRates = filterNewHistoricalFxRates({
        rows: rawRows.map((row) => ({ date: row.date ?? "", close: row.close })),
        existingDates: existingDatesByPair.get(window.currencyPair) ?? new Set(),
        from: window.from,
        to: window.to,
      });
      for (let offset = 0; offset < newRates.length; offset += 250) {
        await db.insert(exchangeRates).values(newRates.slice(offset, offset + 250).map((row) => ({
          date: row.date,
          currencyPair: window.currencyPair,
          rate: String(row.rate),
        })));
      }
      entry.status = "completed";
      entry.providerRows = rawRows.length;
      entry.insertedRows = newRates.length;
      process.stdout.write(`${newRates.length} neue Raten\n`);
    } catch (error: any) {
      entry.status = "error";
      entry.error = String(error?.message ?? error).slice(0, 300);
      process.stdout.write(`Fehler: ${entry.error}\n`);
    }
    (manifest.windows as Record<string, unknown>[]).push(entry);
  }
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`[FX-Backfill] Manifest: ${MANIFEST_PATH}`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error("[FX-Backfill] Abbruch:", error?.message ?? error);
  process.exit(1);
});
