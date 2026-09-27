import YahooFinanceClass from "yahoo-finance2";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { nativeHistoricalPrices, stocks } from "../../drizzle/schema";
import { getDb } from "../db";
import {
  resolveVerifiedNativeRiskSource,
  type NativeRiskPriceRow,
  type VerifiedNativeRiskSource,
} from "./nativeRiskHistory";

const yahooFinance: any = new (YahooFinanceClass as any)();

function toIsoDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const candidate = new Date(String(value));
  return Number.isNaN(candidate.getTime()) ? null : candidate.toISOString().slice(0, 10);
}

function normaliseCurrency(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

export type NativeRiskHistoryImportResult = {
  ticker: string;
  status: "imported" | "no_source" | "invalid_response" | "no_prices" | "error";
  source: VerifiedNativeRiskSource | null;
  rowsFetched: number;
  rowsStored: number;
  message: string;
};

/**
 * Fetches and ADDITIVELY stores a verified secondary-native price series.
 *
 * The source must be whitelisted in `nativeRiskHistory.ts` and its returned
 * currency must match the expected native listing currency. The function does
 * not change `historical_prices`, stocks, portfolioData, current prices, cash,
 * ledger entries, or transactions.
 */
export async function importVerifiedNativeRiskHistory(input: {
  ticker: string;
  nativeCurrency: string;
  isin?: string | null;
  from: string;
  to: string;
}): Promise<NativeRiskHistoryImportResult> {
  const source = resolveVerifiedNativeRiskSource({
    ticker: input.ticker,
    nativeCurrency: input.nativeCurrency,
    isin: input.isin ?? null,
  });
  if (!source) {
    return {
      ticker: input.ticker,
      status: "no_source",
      source: null,
      rowsFetched: 0,
      rowsStored: 0,
      message: "Keine verifizierte native Sekundärquelle für die Instrumentidentität.",
    };
  }

  try {
    const response = await yahooFinance.chart(source.sourceSymbol, {
      period1: input.from,
      period2: input.to,
      interval: "1d",
    }, { validateResult: false });
    const responseCurrency = normaliseCurrency(response?.meta?.currency);
    if (responseCurrency !== source.sourceCurrency) {
      return {
        ticker: input.ticker,
        status: "invalid_response",
        source,
        rowsFetched: 0,
        rowsStored: 0,
        message: `Quellwährung ${responseCurrency || "unbekannt"} stimmt nicht mit ${source.sourceCurrency} überein.`,
      };
    }

    const byDate = new Map<string, NativeRiskPriceRow>();
    for (const quote of response?.quotes ?? []) {
      const date = toIsoDate(quote?.date);
      const close = Number(quote?.close);
      if (date && Number.isFinite(close) && close > 0) byDate.set(date, { date, close });
    }
    const rows = Array.from(byDate.values()).sort((left, right) => left.date.localeCompare(right.date));
    if (rows.length === 0) {
      return {
        ticker: input.ticker,
        status: "no_prices",
        source,
        rowsFetched: 0,
        rowsStored: 0,
        message: "Die verifizierte Quelle liefert im angeforderten Zeitraum keine gültigen Schlusskurse.",
      };
    }

    const db = await getDb();
    if (!db) throw new Error("Datenbankverbindung nicht verfügbar");
    const retrievedAt = new Date();
    await db.insert(nativeHistoricalPrices).values(rows.map((row) => ({
      ticker: input.ticker,
      date: row.date,
      close: row.close.toString(),
      currency: source.sourceCurrency,
      source: source.source,
      sourceSymbol: source.sourceSymbol,
      identity: source.identity,
      conversionRatio: String(source.conversionRatio ?? 1),
      retrievedAt,
    }))).onDuplicateKeyUpdate({
      // Preserve source close values once captured; a later run can only record
      // its retrieval time, never silently rewrite an established risk basis.
      set: { retrievedAt },
    });

    return {
      ticker: input.ticker,
      status: "imported",
      source,
      rowsFetched: rows.length,
      rowsStored: rows.length,
      message: `${rows.length} native Schlusskurse additiv gespeichert.`,
    };
  } catch (error) {
    return {
      ticker: input.ticker,
      status: "error",
      source,
      rowsFetched: 0,
      rowsStored: 0,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Reads exactly the rows belonging to a selected secondary source. This avoids
 * mixing a primary-listing series with other provider rows even if the ticker
 * later gains additional source variants.
 */
export async function readStoredNativeRiskHistory(input: {
  ticker: string;
  source: VerifiedNativeRiskSource;
  from: string;
  to: string;
}): Promise<NativeRiskPriceRow[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    date: nativeHistoricalPrices.date,
    close: nativeHistoricalPrices.close,
  }).from(nativeHistoricalPrices).where(and(
    eq(nativeHistoricalPrices.ticker, input.ticker),
    eq(nativeHistoricalPrices.source, input.source.source),
    eq(nativeHistoricalPrices.sourceSymbol, input.source.sourceSymbol),
    eq(nativeHistoricalPrices.currency, input.source.sourceCurrency),
    gte(nativeHistoricalPrices.date, input.from),
    lte(nativeHistoricalPrices.date, input.to),
  ));
  return rows
    .map((row) => ({ date: String(row.date).slice(0, 10), close: Number(row.close) }))
    .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && Number.isFinite(row.close) && row.close > 0)
    .sort((left, right) => left.date.localeCompare(right.date));
}

/**
 * Backfills the known exceptions that occur in a portfolio. Unknown symbols
 * remain EODHD-only and are never sent to a secondary provider opportunistically.
 */
export async function importVerifiedNativeRiskHistoryForTickers(input: {
  tickers: string[];
  from: string;
  to: string;
}): Promise<NativeRiskHistoryImportResult[]> {
  const uniqueTickers = Array.from(new Set(input.tickers.map((ticker) => ticker.trim()).filter(Boolean)));
  if (uniqueTickers.length === 0) return [];
  const db = await getDb();
  if (!db) return uniqueTickers.map((ticker) => ({
    ticker,
    status: "error" as const,
    source: null,
    rowsFetched: 0,
    rowsStored: 0,
    message: "Datenbankverbindung nicht verfügbar",
  }));

  const masters = await db.select({
    ticker: stocks.ticker,
    currency: stocks.currency,
    isin: stocks.isin,
  }).from(stocks).where(inArray(stocks.ticker, uniqueTickers));
  const masterByTicker = new Map(masters.map((master) => [master.ticker, master]));

  const results: NativeRiskHistoryImportResult[] = [];
  for (const ticker of uniqueTickers) {
    const master = masterByTicker.get(ticker);
    results.push(await importVerifiedNativeRiskHistory({
      ticker,
      nativeCurrency: master?.currency ?? "",
      isin: master?.isin,
      from: input.from,
      to: input.to,
    }));
  }
  return results;
}
