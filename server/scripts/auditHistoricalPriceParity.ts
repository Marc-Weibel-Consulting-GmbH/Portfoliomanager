import { readFile, writeFile } from "node:fs/promises";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import YahooFinanceClass from "yahoo-finance2";
import { historicalPrices } from "../../drizzle/schema";
import { getEodhdApiKey } from "../_core/env";
import { eodhdEodResponseSchema } from "../_core/externalSchemas";
import { getDb } from "../db";
import { toEodhdSymbol } from "../lib/eodhdSymbol";

type WorkbookSample = {
  ticker: string;
  quoteCurrency: string;
  samples: Array<{ date: string; close: number; total: number }>;
};

type ProviderRow = { date: string; close: number; adjustedClose: number | null };

const EODHD_BASE_URL = "https://eodhd.com/api";
const yahooFinance: any = new (YahooFinanceClass as any)();

function dateIso(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function yahooTicker(ticker: string): string {
  return ticker.endsWith(".US") ? ticker.slice(0, -3) : ticker;
}

async function fetchEodhdRows(ticker: string, from: string, to: string): Promise<{ symbol: string; rows: ProviderRow[]; currency: string | null; error?: string }> {
  const apiKey = await getEodhdApiKey();
  if (!apiKey) return { symbol: toEodhdSymbol(ticker), rows: [], currency: null, error: "EODHD key missing" };

  const symbolCandidates = Array.from(new Set([
    toEodhdSymbol(ticker),
    !ticker.includes(".") ? `${ticker}.US` : ticker,
  ]));

  for (const symbol of symbolCandidates) {
    const url = `${EODHD_BASE_URL}/eod/${symbol}?api_token=${apiKey}&fmt=json&from=${from}&to=${to}`;
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const parsed = eodhdEodResponseSchema.safeParse(await response.json());
      if (!parsed.success || parsed.data.length === 0) continue;
      const fundamentalsUrl = `${EODHD_BASE_URL}/fundamentals/${symbol}?api_token=${apiKey}&fmt=json`;
      let currency: string | null = null;
      try {
        const fundamentalsResponse = await fetch(fundamentalsUrl);
        if (fundamentalsResponse.ok) {
          const fundamentals: any = await fundamentalsResponse.json();
          currency = typeof fundamentals?.General?.CurrencyCode === "string" ? fundamentals.General.CurrencyCode : null;
        }
      } catch { /* Currency is diagnostic only. */ }
      return {
        symbol,
        currency,
        rows: parsed.data.map((row) => ({
          date: row.date,
          close: row.close,
          adjustedClose: Number.isFinite(row.adjusted_close) && (row.adjusted_close ?? 0) > 0 ? row.adjusted_close! : null,
        })),
      };
    } catch { /* Try the explicit fallback symbol. */ }
  }

  return { symbol: symbolCandidates[0], rows: [], currency: null, error: "No EODHD series" };
}

async function fetchYahooRows(ticker: string, from: string, to: string): Promise<{ symbol: string; rows: ProviderRow[]; currency: string | null; error?: string }> {
  const symbol = yahooTicker(ticker);
  try {
    const response = await yahooFinance.chart(symbol, { period1: from, period2: to, interval: "1d" }, { validateResult: false });
    const quotes = Array.isArray(response?.quotes) ? response.quotes : [];
    return {
      symbol,
      currency: typeof response?.meta?.currency === "string" ? response.meta.currency : null,
      rows: quotes.flatMap((quote: any) => {
        const date = dateIso(quote.date);
        const close = Number(quote.close);
        if (!date || !Number.isFinite(close) || close <= 0) return [];
        const adjustedClose = Number(quote.adjclose);
        return [{ date, close, adjustedClose: Number.isFinite(adjustedClose) && adjustedClose > 0 ? adjustedClose : null }];
      }),
    };
  } catch (error) {
    return { symbol, rows: [], currency: null, error: error instanceof Error ? error.message : String(error) };
  }
}

function percentDiff(actual: number | null | undefined, expected: number | null | undefined): number | null {
  if (!Number.isFinite(actual) || !Number.isFinite(expected) || !expected) return null;
  return ((actual! / expected!) - 1) * 100;
}

function selectAtOrBefore(rows: ProviderRow[], date: string): { row: ProviderRow | undefined; lagDays: number | null } {
  const target = new Date(`${date}T00:00:00Z`).getTime();
  let selected: ProviderRow | undefined;
  for (const row of rows) {
    const rowTime = new Date(`${row.date}T00:00:00Z`).getTime();
    if (rowTime <= target && (!selected || row.date > selected.date)) selected = row;
  }
  if (!selected) return { row: undefined, lagDays: null };
  return { row: selected, lagDays: Math.round((target - new Date(`${selected.date}T00:00:00Z`).getTime()) / 86_400_000) };
}

function match(
  row: ProviderRow | undefined,
  workbook: { close: number; total: number },
  field: "close" | "adjustedClose",
  options: { sourceDate?: string; lagDays?: number | null } = {},
) {
  const actual = row?.[field] ?? null;
  const expected = field === "close" ? workbook.close : workbook.total;
  const diffPct = percentDiff(actual, expected);
  const status = diffPct === null
    ? "missing"
    : Math.abs(diffPct) <= 0.5
      ? options.lagDays && options.lagDays > 0 ? "calendar_carried" : "match"
      : "mismatch";
  return { actual, expected, diffPct, sourceDate: options.sourceDate ?? null, lagDays: options.lagDays ?? 0, status };
}

async function main() {
  const inputPath = process.argv[2] ?? "/tmp/historical_audit_samples.json";
  const outputPath = process.argv[3] ?? "audit_runs/mami_historical_2026-09-27/external_price_parity_2026-09-28.json";
  const input = JSON.parse(await readFile(inputPath, "utf8")) as { from: string; to: string; samples: WorkbookSample[] };
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const tickers = input.samples.map((sample) => sample.ticker);
  const dbRows = await db
    .select({ ticker: historicalPrices.ticker, date: historicalPrices.date, close: historicalPrices.close, adjustedClose: historicalPrices.adjustedClose })
    .from(historicalPrices)
    .where(and(inArray(historicalPrices.ticker, tickers), gte(historicalPrices.date, input.from), lte(historicalPrices.date, input.to)));
  const dbByTickerDate = new Map<string, ProviderRow>();
  for (const row of dbRows) {
    const date = dateIso(row.date);
    const close = Number(row.close);
    if (!date || !Number.isFinite(close) || close <= 0) continue;
    dbByTickerDate.set(`${row.ticker}:${date}`, { date, close, adjustedClose: Number(row.adjustedClose) || null });
  }

  const results: any[] = [];
  for (const sample of input.samples) {
    const [eodhd, yahoo] = await Promise.all([
      fetchEodhdRows(sample.ticker, input.from, input.to),
      fetchYahooRows(sample.ticker, input.from, input.to),
    ]);
    const eodhdMap = new Map(eodhd.rows.map((row) => [row.date, row]));
    const yahooMap = new Map(yahoo.rows.map((row) => [row.date, row]));
    const comparisons = sample.samples.map((workbook) => {
      const dbRow = dbByTickerDate.get(`${sample.ticker}:${workbook.date}`);
      const eodhdExactRow = eodhdMap.get(workbook.date);
      const yahooExactRow = yahooMap.get(workbook.date);
      const eodhdPrevious = eodhdExactRow ? { row: eodhdExactRow, lagDays: 0 } : selectAtOrBefore(eodhd.rows, workbook.date);
      const yahooPrevious = yahooExactRow ? { row: yahooExactRow, lagDays: 0 } : selectAtOrBefore(yahoo.rows, workbook.date);
      return {
        date: workbook.date,
        dbClose: match(dbRow, workbook, "close"),
        dbTotal: match(dbRow, workbook, "adjustedClose"),
        eodhdClose: match(eodhdPrevious.row, workbook, "close", { sourceDate: eodhdPrevious.row?.date, lagDays: eodhdPrevious.lagDays }),
        eodhdAdjusted: match(eodhdPrevious.row, workbook, "adjustedClose", { sourceDate: eodhdPrevious.row?.date, lagDays: eodhdPrevious.lagDays }),
        yahooClose: match(yahooPrevious.row, workbook, "close", { sourceDate: yahooPrevious.row?.date, lagDays: yahooPrevious.lagDays }),
        yahooAdjusted: match(yahooPrevious.row, workbook, "adjustedClose", { sourceDate: yahooPrevious.row?.date, lagDays: yahooPrevious.lagDays }),
      };
    });
    const mismatchCount = comparisons.flatMap((comparison) => Object.values(comparison).filter((value: any) => value?.status === "mismatch")).length;
    const missingCount = comparisons.flatMap((comparison) => Object.values(comparison).filter((value: any) => value?.status === "missing")).length;
    results.push({
      ticker: sample.ticker,
      workbookQuoteCurrency: sample.quoteCurrency,
      eodhd: { symbol: eodhd.symbol, currency: eodhd.currency, rowCount: eodhd.rows.length, error: eodhd.error },
      yahoo: { symbol: yahoo.symbol, currency: yahoo.currency, rowCount: yahoo.rows.length, error: yahoo.error },
      localRowCount: dbRows.filter((row) => row.ticker === sample.ticker).length,
      samples: comparisons,
      mismatchCount,
      missingCount,
    });
    console.log(`[parity] ${sample.ticker}: eodhd=${eodhd.rows.length}, yahoo=${yahoo.rows.length}, mismatches=${mismatchCount}, missing=${missingCount}`);
    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  const result = {
    generatedAt: new Date().toISOString(),
    range: { from: input.from, to: input.to },
    tolerancePercent: 0.5,
    comparisonBasis: "Workbook raw close and total-return fields are compared separately. Provider close/adjusted-close values are never intermingled.",
    results,
  };
  await writeFile(outputPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ outputPath, tickers: results.length, mismatchTickers: results.filter((result) => result.mismatchCount > 0).map((result) => result.ticker), missingTickers: results.filter((result) => result.missingCount > 0).map((result) => result.ticker) }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
