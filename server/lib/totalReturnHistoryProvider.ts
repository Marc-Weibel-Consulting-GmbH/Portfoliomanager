import YahooFinanceClass from "yahoo-finance2";
import { inArray, sql } from "drizzle-orm";
import { savedPortfolios, totalReturnHistoricalPrices, stocks } from "../../drizzle/schema";
import { getDb } from "../db";
import { getEodhdApiKey } from "../_core/env";
import { eodhdEodResponseSchema, payloadSample } from "../_core/externalSchemas";
import { toEodhdSymbol, isHistoricalPriceSeriesCompatible } from "./eodhdSymbol";
import { resolveVerifiedNativeRiskSource } from "./nativeRiskHistory";

const EODHD_BASE_URL = "https://eodhd.com/api";
const yahooFinance: any = new (YahooFinanceClass as any)();

type SnapshotSource = "eodhd_adjusted" | "yahoo_adjusted";

type SnapshotRow = {
  date: string;
  adjustedClose: number;
};

export type TotalReturnSnapshotResult = {
  ticker: string;
  status: "refreshed" | "no_source" | "invalid_response" | "no_prices" | "error";
  source: SnapshotSource | null;
  sourceSymbol: string | null;
  currency: string | null;
  rowsFetched: number;
  rowsStored: number;
  message: string;
};

function normaliseCurrency(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function toIsoDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function normaliseRows(rows: SnapshotRow[]): SnapshotRow[] {
  const byDate = new Map<string, SnapshotRow>();
  for (const row of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) continue;
    if (!Number.isFinite(row.adjustedClose) || row.adjustedClose <= 0) continue;
    byDate.set(row.date, row);
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchEodhdAdjustedRows(ticker: string, from: string, to: string): Promise<SnapshotRow[] | null> {
  const apiKey = await getEodhdApiKey();
  if (!apiKey) return null;
  const symbol = toEodhdSymbol(ticker);
  const response = await fetch(`${EODHD_BASE_URL}/eod/${encodeURIComponent(symbol)}?api_token=${apiKey}&fmt=json&from=${from}&to=${to}`);
  if (!response.ok) return null;
  const raw: unknown = await response.json();
  const parsed = eodhdEodResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn(`[totalReturnHistory] Invalid EODHD response for ${ticker}: ${payloadSample(raw)}`);
    return null;
  }
  return normaliseRows(parsed.data.map((row) => ({
    date: row.date,
    adjustedClose: Number(row.adjusted_close),
  })));
}

async function fetchYahooAdjustedRows(symbol: string, expectedCurrency: string, from: string, to: string): Promise<SnapshotRow[] | null> {
  const response = await yahooFinance.chart(symbol, { period1: from, period2: to, interval: "1d" }, { validateResult: false });
  if (normaliseCurrency(response?.meta?.currency) !== expectedCurrency) return null;
  return normaliseRows((response?.quotes ?? []).map((quote: any) => ({
    date: toIsoDate(quote?.date) ?? "",
    adjustedClose: Number(quote?.adjclose),
  })));
}

/**
 * Refreshes a complete, provider-adjusted snapshot for one instrument.
 *
 * The raw `historical_prices.close` basis is never changed. This table is
 * intentionally mutable because an adjusted-close provider recalculates every
 * earlier value when a new dividend occurs; `retrievedAt` makes the resulting
 * total-return observation traceable.
 */
export async function refreshTotalReturnHistoryForTicker(input: {
  ticker: string;
  nativeCurrency: string;
  isin?: string | null;
  from: string;
  to: string;
}): Promise<TotalReturnSnapshotResult> {
  const currency = normaliseCurrency(input.nativeCurrency);
  const ticker = input.ticker.trim();
  const nativeSource = resolveVerifiedNativeRiskSource({ ticker, nativeCurrency: currency, isin: input.isin ?? null });
  const useEodhd = isHistoricalPriceSeriesCompatible(ticker, currency);
  const source: SnapshotSource | null = useEodhd ? "eodhd_adjusted" : nativeSource ? "yahoo_adjusted" : null;
  const sourceSymbol = useEodhd ? toEodhdSymbol(ticker) : nativeSource?.sourceSymbol ?? null;
  const sourceCurrency = useEodhd ? currency : nativeSource?.sourceCurrency ?? null;
  if (!source || !sourceSymbol || !sourceCurrency) {
    return { ticker, status: "no_source", source: null, sourceSymbol: null, currency: null, rowsFetched: 0, rowsStored: 0, message: "Keine verifizierte Total-Return-Quelle für die native Handelslinie." };
  }

  try {
    const rows = useEodhd
      ? await fetchEodhdAdjustedRows(ticker, input.from, input.to)
      : await fetchYahooAdjustedRows(sourceSymbol, sourceCurrency, input.from, input.to);
    if (rows === null) {
      return { ticker, status: "invalid_response", source, sourceSymbol, currency: sourceCurrency, rowsFetched: 0, rowsStored: 0, message: "Die Quelle lieferte keine valide, währungskonsistente Adjusted-Close-Reihe." };
    }
    if (rows.length === 0) {
      return { ticker, status: "no_prices", source, sourceSymbol, currency: sourceCurrency, rowsFetched: 0, rowsStored: 0, message: "Keine gültigen dividendenbereinigten Schlusskurse im angeforderten Zeitraum." };
    }

    const db = await getDb();
    if (!db) throw new Error("Datenbankverbindung nicht verfügbar");
    const retrievedAt = new Date();
    await db.insert(totalReturnHistoricalPrices).values(rows.map((row) => ({
      ticker,
      date: row.date,
      adjustedClose: row.adjustedClose.toString(),
      currency: sourceCurrency,
      source,
      sourceSymbol,
      retrievedAt,
    }))).onDuplicateKeyUpdate({
      // Adjusted close changes legitimately after each dividend. Replacing only
      // this dedicated snapshot is intentional and does not overwrite raw prices.
      set: { adjustedClose: sql`VALUES(adjustedClose)`, retrievedAt },
    });
    return { ticker, status: "refreshed", source, sourceSymbol, currency: sourceCurrency, rowsFetched: rows.length, rowsStored: rows.length, message: `${rows.length} Total-Return-Snapshotzeilen aktualisiert.` };
  } catch (error) {
    return { ticker, status: "error", source, sourceSymbol, currency: sourceCurrency, rowsFetched: 0, rowsStored: 0, message: error instanceof Error ? error.message : String(error) };
  }
}

/** Refreshes only known tickers and keeps source identity in the stock master. */
export async function refreshTotalReturnHistoryForTickers(input: {
  tickers: string[];
  from: string;
  to: string;
}): Promise<TotalReturnSnapshotResult[]> {
  const tickers = Array.from(new Set(input.tickers.map((ticker) => ticker.trim()).filter(Boolean)));
  if (tickers.length === 0) return [];
  const db = await getDb();
  if (!db) return tickers.map((ticker) => ({ ticker, status: "error" as const, source: null, sourceSymbol: null, currency: null, rowsFetched: 0, rowsStored: 0, message: "Datenbankverbindung nicht verfügbar" }));
  const masters = await db.select({ ticker: stocks.ticker, currency: stocks.currency, isin: stocks.isin })
    .from(stocks).where(inArray(stocks.ticker, tickers));
  const byTicker = new Map(masters.map((master) => [master.ticker, master]));
  const results: TotalReturnSnapshotResult[] = [];
  for (const ticker of tickers) {
    const master = byTicker.get(ticker);
    results.push(await refreshTotalReturnHistoryForTicker({ ticker, nativeCurrency: master?.currency ?? "", isin: master?.isin, from: input.from, to: input.to }));
  }
  return results;
}

/**
 * Refreshes adjusted-price snapshots only for positions that actually occur in
 * a saved portfolio and only once per 24 hours by default. The daily raw-price
 * import can cover a far broader screener universe; duplicating adjusted-close
 * calls for that universe would spend provider quota without improving a
 * portfolio metric.
 */
export async function refreshStaleTotalReturnHistoryForPortfolioHoldings(input: {
  from: string;
  to: string;
  maxAgeMs?: number;
}): Promise<TotalReturnSnapshotResult[]> {
  const db = await getDb();
  if (!db) return [];
  const portfolios = await db.select({ portfolioData: savedPortfolios.portfolioData }).from(savedPortfolios);
  const tickers = Array.from(new Set(portfolios.flatMap((portfolio) => {
    try {
      const parsed = JSON.parse(portfolio.portfolioData ?? "{}");
      const positions = Array.isArray(parsed.stocks) ? parsed.stocks : Array.isArray(parsed.positions) ? parsed.positions : [];
      return positions.map((position: { ticker?: unknown }) => typeof position.ticker === "string" ? position.ticker.trim() : "").filter(Boolean);
    } catch {
      return [];
    }
  })));
  if (tickers.length === 0) return [];
  const snapshots = await db.select({ ticker: totalReturnHistoricalPrices.ticker, retrievedAt: totalReturnHistoricalPrices.retrievedAt })
    .from(totalReturnHistoricalPrices)
    .where(inArray(totalReturnHistoricalPrices.ticker, tickers));
  const latestByTicker = new Map<string, number>();
  for (const snapshot of snapshots) {
    const timestamp = snapshot.retrievedAt instanceof Date ? snapshot.retrievedAt.getTime() : new Date(String(snapshot.retrievedAt)).getTime();
    if (Number.isFinite(timestamp)) latestByTicker.set(snapshot.ticker, Math.max(latestByTicker.get(snapshot.ticker) ?? 0, timestamp));
  }
  const maxAgeMs = input.maxAgeMs ?? 24 * 60 * 60 * 1000;
  const staleTickers = tickers.filter((ticker) => Date.now() - (latestByTicker.get(ticker) ?? 0) >= maxAgeMs);
  return refreshTotalReturnHistoryForTickers({ tickers: staleTickers, from: input.from, to: input.to });
}
