import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { historicalPrices, splitAdjustedHistoricalPrices, stocks } from "../../drizzle/schema";
import { getDb } from "../db";
import { isHistoricalPriceSeriesCompatible } from "./eodhdSymbol";
import { assessRawPriceSeriesIntegrity } from "./priceSeriesIntegrity";
import {
  calculateSplitAdjustedMarketMetrics,
  selectDirectSplitAdjustedMetricSeries,
} from "./splitAdjustedMarketMetrics";

export const PRICE_BASIS_GATE_MARKER = "[Preisbasis]";

export type MarketMetricRefreshAuditRow = {
  ticker: string;
  status: "updated" | "blocked" | "skipped";
  source: string | null;
  reason: string | null;
  before: {
    currentPrice: string | null;
    ytdStartPrice: string | null;
    ytdPerformance: string | null;
    week52High: string | null;
    week52Low: string | null;
  };
  after: {
    currentPrice: string | null;
    ytdStartPrice: string | null;
    ytdPerformance: string | null;
    week52High: string | null;
    week52Low: string | null;
  };
};

function withoutPriceBasisGate(notes: string | null | undefined): string | null {
  const remaining = (notes ?? "")
    .split(" · ")
    .filter(Boolean)
    .filter((note) => !note.startsWith(PRICE_BASIS_GATE_MARKER));
  return remaining.length > 0 ? remaining.join(" · ") : null;
}

function withPriceBasisGate(notes: string | null | undefined, reason: string): string {
  return [
    withoutPriceBasisGate(notes),
    `${PRICE_BASIS_GATE_MARKER} ${reason}`,
  ].filter(Boolean).join(" · ");
}

function displayFields(row: typeof stocks.$inferSelect): MarketMetricRefreshAuditRow["before"] {
  return {
    currentPrice: row.currentPrice,
    ytdStartPrice: row.ytdStartPrice,
    ytdPerformance: row.ytdPerformance,
    week52High: row.week52High,
    week52Low: row.week52Low,
  };
}

/**
 * Updates only derived point-in-time market fields. Immutable raw historical
 * prices, portfolio contents, cash, ledger entries and transactions are never
 * read for mutation or written by this function.
 */
export async function refreshSplitAdjustedMarketMetrics(input: {
  tickers?: string[];
  asOf?: Date;
  timeLimitMs?: number;
  preserveExistingCurrentPrice?: boolean;
} = {}): Promise<{
  updated: number;
  blocked: number;
  skipped: number;
  rows: MarketMetricRefreshAuditRow[];
}> {
  const db = await getDb();
  if (!db) throw new Error("Datenbankverbindung nicht verfügbar");

  const asOf = input.asOf ?? new Date();
  const today = asOf.toISOString().slice(0, 10);
  const oneYearAgo = new Date(asOf);
  oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1);
  oneYearAgo.setUTCDate(oneYearAgo.getUTCDate() - 10);
  const seriesFrom = oneYearAgo.toISOString().slice(0, 10);
  const requestedTickers = input.tickers
    ? [...new Set(input.tickers.map((ticker) => ticker.trim()).filter(Boolean))]
    : null;
  const selectedStocks = requestedTickers && requestedTickers.length > 0
    ? await db.select().from(stocks).where(inArray(stocks.ticker, requestedTickers))
    : requestedTickers
      ? []
      : await db.select().from(stocks);
  const tickers = selectedStocks.map((stock) => stock.ticker).filter(Boolean);
  if (tickers.length === 0) return { updated: 0, blocked: 0, skipped: 0, rows: [] };

  const [rawRows, splitRows] = await Promise.all([
    db.select({
      ticker: historicalPrices.ticker,
      date: historicalPrices.date,
      close: historicalPrices.close,
    }).from(historicalPrices).where(and(
      inArray(historicalPrices.ticker, tickers),
      gte(historicalPrices.date, seriesFrom),
      lte(historicalPrices.date, today),
    )),
    db.select({
      ticker: splitAdjustedHistoricalPrices.ticker,
      date: splitAdjustedHistoricalPrices.date,
      adjustedClose: splitAdjustedHistoricalPrices.adjustedClose,
      currency: splitAdjustedHistoricalPrices.currency,
      source: splitAdjustedHistoricalPrices.source,
      sourceSymbol: splitAdjustedHistoricalPrices.sourceSymbol,
    }).from(splitAdjustedHistoricalPrices).where(and(
      inArray(splitAdjustedHistoricalPrices.ticker, tickers),
      gte(splitAdjustedHistoricalPrices.date, seriesFrom),
      lte(splitAdjustedHistoricalPrices.date, today),
    )),
  ]);

  const rawByTicker = new Map<string, Array<{ date: string; close: number }>>();
  for (const row of rawRows) {
    const close = Number(row.close);
    if (!Number.isFinite(close) || close <= 0) continue;
    const rows = rawByTicker.get(row.ticker) ?? [];
    rows.push({ date: String(row.date).slice(0, 10), close });
    rawByTicker.set(row.ticker, rows);
  }
  for (const rows of rawByTicker.values()) {
    rows.sort((left, right) => left.date.localeCompare(right.date));
  }
  const splitByTicker = new Map<string, typeof splitRows>();
  for (const row of splitRows) {
    const rows = splitByTicker.get(row.ticker) ?? [];
    rows.push(row);
    splitByTicker.set(row.ticker, rows);
  }

  const startedAt = Date.now();
  let updated = 0;
  let blocked = 0;
  let skipped = 0;
  const rows: MarketMetricRefreshAuditRow[] = [];

  for (const stock of selectedStocks) {
    if (input.timeLimitMs && Date.now() - startedAt > input.timeLimitMs) {
      skipped += 1;
      rows.push({
        ticker: stock.ticker,
        status: "skipped",
        source: null,
        reason: "Zeitbudget des Refresh-Laufs erreicht.",
        before: displayFields(stock),
        after: displayFields(stock),
      });
      continue;
    }

    const before = displayFields(stock);
    const splitSeries = selectDirectSplitAdjustedMetricSeries({
      ticker: stock.ticker,
      currency: stock.currency,
      isin: stock.isin,
    }, splitByTicker.get(stock.ticker) ?? []);
    const rawSeries = rawByTicker.get(stock.ticker) ?? [];
    const rawIntegrity = assessRawPriceSeriesIntegrity(rawSeries);
    // A stored split snapshot is not a proof by itself: an older snapshot made
    // from raw closes with a missing event still contains the mechanical jump.
    // It must be rejected just like raw data, otherwise a vendor/listing error
    // (WILC) can overwrite a plausible point quote with a 100x+ false value.
    const splitIntegrity = splitSeries
      ? assessRawPriceSeriesIntegrity(splitSeries.rows)
      : { valid: false, reason: undefined };
    const verifiedSplitSeries = splitSeries && splitIntegrity.valid ? splitSeries : null;
    const rawFallbackAllowed = isHistoricalPriceSeriesCompatible(stock.ticker, stock.currency ?? "")
      && rawIntegrity.valid;
    const metrics = calculateSplitAdjustedMarketMetrics(
      verifiedSplitSeries?.rows ?? (rawFallbackAllowed ? rawSeries : []),
      asOf,
      input.preserveExistingCurrentPrice ? Number(stock.currentPrice) : null,
    );

    if (!metrics) {
      const reason = splitIntegrity.reason
        ?? rawIntegrity.reason
        ?? "Keine direkt verifizierte, splitbereinigte Preisreihe für YTD/52W verfügbar.";
      if (!verifiedSplitSeries && !rawFallbackAllowed) {
        await db.update(stocks).set({
          dataQualityStatus: "pruefen",
          dataQualityNotes: withPriceBasisGate(stock.dataQualityNotes, reason),
          dataQualityUpdatedAt: new Date(),
        }).where(eq(stocks.id, stock.id));
        blocked += 1;
        rows.push({ ticker: stock.ticker, status: "blocked", source: null, reason, before, after: before });
      } else {
        skipped += 1;
        rows.push({ ticker: stock.ticker, status: "skipped", source: verifiedSplitSeries?.source ?? "raw_close", reason, before, after: before });
      }
      continue;
    }

    const clearedNotes = withoutPriceBasisGate(stock.dataQualityNotes);
    const after = {
      currentPrice: metrics.endPrice.toFixed(4),
      ytdStartPrice: metrics.startPrice.toFixed(4),
      ytdPerformance: metrics.ytdPerformancePct.toFixed(2),
      week52High: metrics.week52High.toFixed(4),
      week52Low: metrics.week52Low.toFixed(4),
    };
    await db.update(stocks).set({
      ...after,
      lastMetricsUpdate: new Date(),
      ...(stock.dataQualityNotes?.includes(PRICE_BASIS_GATE_MARKER)
        ? {
          dataQualityNotes: clearedNotes,
          dataQualityStatus: clearedNotes || stock.dataQualityStatus !== "pruefen" ? undefined : null,
          dataQualityUpdatedAt: new Date(),
        }
        : {}),
    }).where(eq(stocks.id, stock.id));
    updated += 1;
    rows.push({
      ticker: stock.ticker,
      status: "updated",
      source: verifiedSplitSeries?.source ?? "raw_close_without_unresolved_jump",
      reason: null,
      before,
      after,
    });
  }

  return { updated, blocked, skipped, rows };
}
