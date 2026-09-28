import YahooFinanceClass from "yahoo-finance2";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { savedPortfolios, splitAdjustedHistoricalPrices, totalReturnHistoricalPrices, stocks } from "../../drizzle/schema";
import { getDb } from "../db";
import { getEodhdApiKey } from "../_core/env";
import { eodhdDividendResponseSchema, eodhdEodResponseSchema, eodhdSplitResponseSchema, payloadSample } from "../_core/externalSchemas";
import { getHistoricalPriceCurrency, toEodhdSymbol, isHistoricalPriceSeriesCompatible } from "./eodhdSymbol";
import { resolveVerifiedNativeRiskSource } from "./nativeRiskHistory";
import {
  buildEventReconstructedTotalReturnRows,
  buildSplitAdjustedPriceRows,
  hasMaterialTotalReturnMismatch,
} from "./totalReturnFromEvents";

const EODHD_BASE_URL = "https://eodhd.com/api";
const yahooFinance: any = new (YahooFinanceClass as any)();

type SnapshotSource = "eodhd_adjusted" | "eodhd_events_total_return" | "yahoo_adjusted";

type SnapshotRow = {
  date: string;
  adjustedClose: number;
};

type EodhdPriceFeed = {
  providerRows: SnapshotRow[];
  rawRows: Array<{ date: string; close: number }>;
};

type YahooPriceFeed = {
  adjustedRows: SnapshotRow[];
  splitAdjustedRows: SnapshotRow[];
};

export type TotalReturnSnapshotResult = {
  ticker: string;
  status: "refreshed" | "no_source" | "invalid_response" | "no_prices" | "error";
  source: SnapshotSource | null;
  sourceSymbol: string | null;
  currency: string | null;
  rowsFetched: number;
  rowsStored: number;
  priceRowsStored: number;
  message: string;
};

/**
 * Both labelled 5J return measures depend on their own derived snapshot.
 *
 * A total-return snapshot cannot stand in for the split-adjusted, cash-
 * dividend-excluding price-return snapshot. Treating the total-return timestamp
 * as sufficient here caused newly introduced split snapshots to remain absent
 * forever for otherwise fresh portfolio positions.
 */
export function needsPortfolioReturnSnapshotRefresh(input: {
  totalReturnRetrievedAt: Date | string | number | null | undefined;
  splitAdjustedRetrievedAt: Date | string | number | null | undefined;
  totalReturnCoverage?: { firstDate: string | null; lastDate: string | null };
  splitAdjustedCoverage?: { firstDate: string | null; lastDate: string | null };
  requiredFrom?: string;
  requiredTo?: string;
  now: number;
  maxAgeMs: number;
}): boolean {
  const age = (value: Date | string | number | null | undefined): number | null => {
    if (value === null || value === undefined) return null;
    const timestamp = typeof value === "number"
      ? value
      : value instanceof Date
        ? value.getTime()
        : new Date(String(value)).getTime();
    return Number.isFinite(timestamp) ? input.now - timestamp : null;
  };

  const totalReturnAge = age(input.totalReturnRetrievedAt);
  const splitAdjustedAge = age(input.splitAdjustedRetrievedAt);
  const coversRequestedWindow = (coverage: { firstDate: string | null; lastDate: string | null } | undefined): boolean => {
    if (!input.requiredFrom || !input.requiredTo) return true;
    if (!coverage?.firstDate || !coverage.lastDate) return false;
    const earliestAcceptedStart = new Date(`${input.requiredFrom}T00:00:00.000Z`);
    earliestAcceptedStart.setUTCDate(earliestAcceptedStart.getUTCDate() + 7);
    const latestAcceptedEnd = new Date(`${input.requiredTo}T00:00:00.000Z`);
    latestAcceptedEnd.setUTCDate(latestAcceptedEnd.getUTCDate() - 7);
    const first = new Date(`${coverage.firstDate}T00:00:00.000Z`);
    const last = new Date(`${coverage.lastDate}T00:00:00.000Z`);
    return Number.isFinite(first.getTime())
      && Number.isFinite(last.getTime())
      && first <= earliestAcceptedStart
      && last >= latestAcceptedEnd;
  };
  return totalReturnAge === null
    || splitAdjustedAge === null
    || totalReturnAge >= input.maxAgeMs
    || splitAdjustedAge >= input.maxAgeMs
    || !coversRequestedWindow(input.totalReturnCoverage)
    || !coversRequestedWindow(input.splitAdjustedCoverage);
}

/**
 * A daily raw-price import may only cover a few recent business days. Derived
 * portfolio return snapshots are different: a source change replaces one
 * homogeneous series wholesale, so their refresh must always retain the whole
 * five-year analytical window. Otherwise a fresh short snapshot can erase a
 * prior complete five-year basis for the same source.
 */
export function resolvePortfolioReturnSnapshotWindow(input: {
  requestedFrom: string;
  to: string;
  minimumYears?: number;
}): { from: string; to: string } {
  const years = input.minimumYears ?? 5;
  const end = new Date(`${input.to.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(end.getTime())) {
    throw new Error(`Invalid snapshot end date: ${input.to}`);
  }
  end.setUTCFullYear(end.getUTCFullYear() - years);
  const requiredFrom = end.toISOString().slice(0, 10);
  const requestedFrom = input.requestedFrom.slice(0, 10);
  return {
    from: /^\d{4}-\d{2}-\d{2}$/.test(requestedFrom) && requestedFrom < requiredFrom
      ? requestedFrom
      : requiredFrom,
    to: input.to.slice(0, 10),
  };
}

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

async function fetchEodhdPriceFeed(ticker: string, from: string, to: string): Promise<EodhdPriceFeed | null> {
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
  return {
    providerRows: normaliseRows(parsed.data.map((row) => ({
      date: row.date,
      adjustedClose: Number(row.adjusted_close),
    }))),
    rawRows: parsed.data
      .filter((row) => Number.isFinite(row.close) && row.close > 0)
      .map((row) => ({ date: row.date, close: row.close })),
  };
}

async function fetchEodhdCashDividends(ticker: string, from: string, to: string): Promise<Array<{ date: string; amount: number; currency: string | null }>|null> {
  const apiKey = await getEodhdApiKey();
  if (!apiKey) return null;
  const symbol = toEodhdSymbol(ticker);
  const response = await fetch(`${EODHD_BASE_URL}/div/${encodeURIComponent(symbol)}?api_token=${apiKey}&fmt=json&from=${from}&to=${to}`);
  if (!response.ok) return null;
  const raw: unknown = await response.json();
  const parsed = eodhdDividendResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn(`[totalReturnHistory] Invalid EODHD dividend response for ${ticker}: ${payloadSample(raw)}`);
    return null;
  }
  return parsed.data
    .map((event) => ({
      date: event.date,
      amount: Number(event.unadjustedValue ?? event.value),
      currency: event.currency ?? null,
    }))
    .filter((event) => Number.isFinite(event.amount) && event.amount > 0);
}

async function fetchEodhdSplits(ticker: string, from: string, to: string): Promise<Array<{ date: string; split: string }>|null> {
  const apiKey = await getEodhdApiKey();
  if (!apiKey) return null;
  const symbol = toEodhdSymbol(ticker);
  const response = await fetch(`${EODHD_BASE_URL}/splits/${encodeURIComponent(symbol)}?api_token=${apiKey}&fmt=json&from=${from}&to=${to}`);
  if (!response.ok) return null;
  const raw: unknown = await response.json();
  const parsed = eodhdSplitResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn(`[totalReturnHistory] Invalid EODHD split response for ${ticker}: ${payloadSample(raw)}`);
    return null;
  }
  return parsed.data.map((event) => ({ date: event.date, split: event.split }));
}

async function fetchYahooPriceFeed(symbol: string, expectedCurrency: string, from: string, to: string): Promise<YahooPriceFeed | null> {
  const response = await yahooFinance.chart(symbol, { period1: from, period2: to, interval: "1d" }, { validateResult: false });
  if (normaliseCurrency(response?.meta?.currency) !== expectedCurrency) return null;
  return {
    // Yahoo's `close` is split-adjusted but does not reinvest cash dividends;
    // `adjclose` additionally incorporates those dividends.
    splitAdjustedRows: normaliseRows((response?.quotes ?? []).map((quote: any) => ({
      date: toIsoDate(quote?.date) ?? "",
      adjustedClose: Number(quote?.close),
    }))),
    adjustedRows: normaliseRows((response?.quotes ?? []).map((quote: any) => ({
      date: toIsoDate(quote?.date) ?? "",
      adjustedClose: Number(quote?.adjclose),
    }))),
  };
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
  let source: SnapshotSource | null = useEodhd ? "eodhd_adjusted" : nativeSource ? "yahoo_adjusted" : null;
  const sourceSymbol = useEodhd ? toEodhdSymbol(ticker) : nativeSource?.sourceSymbol ?? null;
  // A native LSE security is economically GBP-denominated but its EOD close is
  // in GBp.  The snapshot stores the quote unit used by adjustedClose so the
  // risk router can apply the correct historical FX conversion.
  const sourceCurrency = useEodhd ? getHistoricalPriceCurrency(ticker, currency) : nativeSource?.sourceCurrency ?? null;
  if (!source || !sourceSymbol || !sourceCurrency) {
    return { ticker, status: "no_source", source: null, sourceSymbol: null, currency: null, rowsFetched: 0, rowsStored: 0, priceRowsStored: 0, message: "Keine verifizierte Total-Return-Quelle für die native Handelslinie." };
  }

  try {
    let rows: SnapshotRow[] | null;
    let splitAdjustedRows: SnapshotRow[] | null;
    if (useEodhd) {
      const [priceFeed, dividends, splits] = await Promise.all([
        fetchEodhdPriceFeed(ticker, input.from, input.to),
        fetchEodhdCashDividends(ticker, input.from, input.to),
        fetchEodhdSplits(ticker, input.from, input.to),
      ]);
      rows = priceFeed?.providerRows ?? null;
      splitAdjustedRows = priceFeed
        ? buildSplitAdjustedPriceRows({ rawRows: priceFeed.rawRows, splits: splits ?? [] })
        : null;
      if (priceFeed && splitAdjustedRows && dividends && dividends.length > 0) {
        const reconstructedRows = buildEventReconstructedTotalReturnRows({
          quoteCurrency: sourceCurrency,
          rawRows: splitAdjustedRows.map((row) => ({ date: row.date, close: row.adjustedClose })),
          dividends,
        });
        if (hasMaterialTotalReturnMismatch({
          providerRows: priceFeed.providerRows,
          reconstructedRows,
        })) {
          rows = reconstructedRows;
          source = "eodhd_events_total_return";
        }
      }
    } else {
      const priceFeed = await fetchYahooPriceFeed(sourceSymbol, sourceCurrency, input.from, input.to);
      rows = priceFeed?.adjustedRows ?? null;
      splitAdjustedRows = priceFeed?.splitAdjustedRows ?? null;
    }
    if (rows === null) {
      return { ticker, status: "invalid_response", source, sourceSymbol, currency: sourceCurrency, rowsFetched: 0, rowsStored: 0, priceRowsStored: 0, message: "Die Quelle lieferte keine valide, währungskonsistente Adjusted-Close-Reihe." };
    }
    if (rows.length === 0) {
      return { ticker, status: "no_prices", source, sourceSymbol, currency: sourceCurrency, rowsFetched: 0, rowsStored: 0, priceRowsStored: 0, message: "Keine gültigen dividendenbereinigten Schlusskurse im angeforderten Zeitraum." };
    }

    const db = await getDb();
    if (!db) throw new Error("Datenbankverbindung nicht verfügbar");
    const retrievedAt = new Date();
    // The table is a refreshable derived snapshot, not an audit log. A prior
    // refresh may have selected `eodhd_events_total_return` while a later
    // split-aware validation confirms `eodhd_adjusted` (or vice versa). Keeping
    // both would make the selector pick stale rows based solely on source
    // priority. Retain exactly the current, fully recalculated basis per ticker.
    await db.delete(totalReturnHistoricalPrices).where(and(
      eq(totalReturnHistoricalPrices.ticker, ticker),
      ne(totalReturnHistoricalPrices.source, source),
    ));
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
    const priceRowsStored = splitAdjustedRows?.length ?? 0;
    if (splitAdjustedRows && splitAdjustedRows.length > 0) {
      const priceSource = useEodhd ? "eodhd_split_adjusted" : "yahoo_close_split_adjusted";
      await db.delete(splitAdjustedHistoricalPrices).where(and(
        eq(splitAdjustedHistoricalPrices.ticker, ticker),
        ne(splitAdjustedHistoricalPrices.source, priceSource),
      ));
      await db.insert(splitAdjustedHistoricalPrices).values(splitAdjustedRows.map((row) => ({
        ticker,
        date: row.date,
        adjustedClose: row.adjustedClose.toString(),
        currency: sourceCurrency,
        source: priceSource,
        sourceSymbol,
        retrievedAt,
      }))).onDuplicateKeyUpdate({
        set: { adjustedClose: sql`VALUES(adjustedClose)`, retrievedAt },
      });
    }
    // Historical snapshots feed every user's portfolio-risk proxy. They change
    // rarely (daily), so globally invalidating the small in-process cache is
    // preferable to showing a five-minute stale Sharpe/total-return result.
    const { invalidateAllCachedRiskMetrics } = await import("./riskMetricsCache");
    invalidateAllCachedRiskMetrics();
    return { ticker, status: "refreshed", source, sourceSymbol, currency: sourceCurrency, rowsFetched: rows.length, rowsStored: rows.length, priceRowsStored, message: `${rows.length} Total-Return- und ${priceRowsStored} splitbereinigte Kurszeilen aktualisiert.` };
  } catch (error) {
    return { ticker, status: "error", source, sourceSymbol, currency: sourceCurrency, rowsFetched: 0, rowsStored: 0, priceRowsStored: 0, message: error instanceof Error ? error.message : String(error) };
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
  if (!db) return tickers.map((ticker) => ({ ticker, status: "error" as const, source: null, sourceSymbol: null, currency: null, rowsFetched: 0, rowsStored: 0, priceRowsStored: 0, message: "Datenbankverbindung nicht verfügbar" }));
  const masters = await db.select({ ticker: stocks.ticker, currency: stocks.currency, isin: stocks.isin })
    .from(stocks).where(inArray(stocks.ticker, tickers));
  const byTicker = new Map(masters.map((master) => [master.ticker, master]));
  const results: TotalReturnSnapshotResult[] = [];
  for (const ticker of tickers) {
    const master = byTicker.get(ticker);
    results.push(await refreshTotalReturnHistoryForTicker({ ticker, nativeCurrency: master?.currency ?? "", isin: master?.isin, from: input.from, to: input.to }));
  }
  // The overview chart consumes the same split-adjusted snapshots as the risk
  // proxy. Do not let its 15-minute cache show pre-refresh raw-close history.
  // Only derived cache data is invalidated; no portfolio or price source row is
  // deleted by this operation.
  if (results.some((result) => result.status === "refreshed")) {
    const { perfCache } = await import("../_core/perfCache");
    await perfCache.invalidate("perf:hist:");
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
  const [totalReturnSnapshots, splitAdjustedSnapshots] = await Promise.all([
    db.select({ ticker: totalReturnHistoricalPrices.ticker, date: totalReturnHistoricalPrices.date, retrievedAt: totalReturnHistoricalPrices.retrievedAt })
      .from(totalReturnHistoricalPrices)
      .where(inArray(totalReturnHistoricalPrices.ticker, tickers)),
    db.select({ ticker: splitAdjustedHistoricalPrices.ticker, date: splitAdjustedHistoricalPrices.date, retrievedAt: splitAdjustedHistoricalPrices.retrievedAt })
      .from(splitAdjustedHistoricalPrices)
      .where(inArray(splitAdjustedHistoricalPrices.ticker, tickers)),
  ]);
  const summariseSnapshots = (snapshots: Array<{ ticker: string; date: string; retrievedAt: Date | string }>) => {
    const latestByTicker = new Map<string, number>();
    const coverageByTicker = new Map<string, { firstDate: string; lastDate: string }>();
    for (const snapshot of snapshots) {
      const timestamp = snapshot.retrievedAt instanceof Date ? snapshot.retrievedAt.getTime() : new Date(String(snapshot.retrievedAt)).getTime();
      if (Number.isFinite(timestamp)) latestByTicker.set(snapshot.ticker, Math.max(latestByTicker.get(snapshot.ticker) ?? 0, timestamp));
      const current = coverageByTicker.get(snapshot.ticker);
      coverageByTicker.set(snapshot.ticker, {
        firstDate: !current || snapshot.date < current.firstDate ? snapshot.date : current.firstDate,
        lastDate: !current || snapshot.date > current.lastDate ? snapshot.date : current.lastDate,
      });
    }
    return { latestByTicker, coverageByTicker };
  };
  const totalReturnSummary = summariseSnapshots(totalReturnSnapshots);
  const splitAdjustedSummary = summariseSnapshots(splitAdjustedSnapshots);
  const maxAgeMs = input.maxAgeMs ?? 24 * 60 * 60 * 1000;
  const now = Date.now();
  const staleTickers = tickers.filter((ticker) => needsPortfolioReturnSnapshotRefresh({
    totalReturnRetrievedAt: totalReturnSummary.latestByTicker.get(ticker) ?? null,
    splitAdjustedRetrievedAt: splitAdjustedSummary.latestByTicker.get(ticker) ?? null,
    totalReturnCoverage: totalReturnSummary.coverageByTicker.get(ticker) ?? null,
    splitAdjustedCoverage: splitAdjustedSummary.coverageByTicker.get(ticker) ?? null,
    requiredFrom: input.from,
    requiredTo: input.to,
    now,
    maxAgeMs,
  }));
  const snapshotWindow = resolvePortfolioReturnSnapshotWindow({ requestedFrom: input.from, to: input.to });
  return refreshTotalReturnHistoryForTickers({ tickers: staleTickers, ...snapshotWindow });
}
