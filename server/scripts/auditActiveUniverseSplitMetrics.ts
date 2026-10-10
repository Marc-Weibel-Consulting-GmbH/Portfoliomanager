import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { historicalPrices, splitAdjustedHistoricalPrices, stocks } from "../../drizzle/schema";
import { getEodhdApiKey } from "../_core/env";
import { getDb } from "../db";
import { isHistoricalPriceSeriesCompatible, toEodhdSymbol } from "../lib/eodhdSymbol";
import { selectDirectSplitAdjustedMetricSeries } from "../lib/splitAdjustedMarketMetrics";

/**
 * Read-only inventory of active instrument masters against their separate
 * split-adjusted EODHD snapshots. It neither refreshes nor overwrites quotes,
 * historical data, portfolio data, cash, ledgers or transactions.
 *
 * The implementation is shared by the auditable CLI script and the monthly
 * Heartbeat handler. The caller decides whether a working-file artefact is
 * written; the returned result always contains the complete in-memory evidence.
 */
const DEFAULT_AS_OF_DATE = "2026-10-09";
const EODHD_BASE_URL = "https://eodhd.com/api";
const DEFAULT_REQUEST_DELAY_MS = 180;

type SplitEvent = { date: string; split: string };
type PriceRow = { ticker: string; date: string; close?: string | null; adjustedClose?: string | null };
type SplitRow = {
  ticker: string;
  date: string;
  adjustedClose: string | null;
  source: string | null;
  sourceSymbol: string | null;
  currency: string | null;
  retrievedAt: Date | string;
};

export type CorporateActionAuditOptions = {
  asOfDate?: string;
  requestDelayMs?: number;
  maxConcurrentRequests?: number;
};

export type CorporateActionAuditResult = {
  asOfDate: string;
  summary: {
    asOfDate: string;
    scope: { allStockRows: number; activeStockRows: number; activeCuratedRows: number; activeNonCuratedRows: number };
    fetched: { eodhdSplitRequests: number; failed: number };
    activeCandidateCount: number;
    activeWithVerifiedSplitEvent: number;
    activeWithForwardSplit: number;
    activeWithReverseSplit: number;
    activeMissingSplitSnapshot: number;
    activeYtdBasisMismatch: number;
    activeRangeBasisMismatch: number;
    activeYtdCalculationMismatch: number;
    candidates: Array<{ ticker: string; flags: string[]; corporateActions: unknown[]; ytdErrorPp: number | null }>;
  };
  assets: Array<Record<string, unknown>>;
};

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function percentOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function ratio(left: number | null, right: number | null): number | null {
  return left != null && right != null && right > 0 ? left / right : null;
}

function materiallyDifferent(left: number | null, right: number | null, threshold = 1.5): boolean {
  const relation = ratio(left, right);
  return relation != null && (relation >= threshold || relation <= 1 / threshold);
}

function splitFactor(event: SplitEvent): number | null {
  const parts = String(event.split ?? "").split("/");
  if (parts.length !== 2) return null;
  const numerator = Number(parts[0]);
  const denominator = Number(parts[1]);
  const factor = numerator / denominator;
  return Number.isFinite(factor) && factor > 0 ? factor : null;
}

function classifyCorporateActions(events: SplitEvent[]) {
  return events.map((event) => {
    const factor = splitFactor(event);
    return {
      date: event.date,
      split: event.split,
      factor,
      kind: factor == null ? "unparseable" : factor > 1 ? "forward_split" : factor < 1 ? "reverse_split" : "no_change",
    };
  });
}

function selectFirstOnOrAfter(rows: Array<{ date: string; value: number }>, date: string) {
  return rows.find((row) => row.date >= date) ?? null;
}

function selectLastOnOrBefore(rows: Array<{ date: string; value: number }>, date: string) {
  return rows.filter((row) => row.date <= date).at(-1) ?? null;
}

function max(rows: Array<{ date: string; value: number }>): number | null {
  return rows.length ? Math.max(...rows.map((row) => row.value)) : null;
}

function min(rows: Array<{ date: string; value: number }>): number | null {
  return rows.length ? Math.min(...rows.map((row) => row.value)) : null;
}

function rawMechanicalJump(rows: PriceRow[]): { from: string; to: string; factor: number } | null {
  const normalized = rows
    .map((row) => ({ date: String(row.date).slice(0, 10), value: numberOrNull(row.close) }))
    .filter((row): row is { date: string; value: number } => row.value != null)
    .sort((left, right) => left.date.localeCompare(right.date));
  for (let index = 1; index < normalized.length; index += 1) {
    const factor = normalized[index].value / normalized[index - 1].value;
    if (factor >= 2 || factor <= 0.5) return { from: normalized[index - 1].date, to: normalized[index].date, factor };
  }
  return null;
}

async function fetchSplits(symbol: string, token: string, from: string, asOfDate: string): Promise<{ events: SplitEvent[] | null; error: string | null }> {
  const url = `${EODHD_BASE_URL}/splits/${encodeURIComponent(symbol)}?api_token=${encodeURIComponent(token)}&fmt=json&from=${from}&to=${asOfDate}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return { events: null, error: `HTTP ${response.status}` };
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) return { events: null, error: "Unerwartetes EODHD-Splitformat" };
    const events = payload
      .filter((value): value is Record<string, unknown> => Boolean(value && typeof value === "object"))
      .map((value) => ({ date: String(value.date ?? "").slice(0, 10), split: String(value.split ?? "") }))
      .filter((event) => /^\d{4}-\d{2}-\d{2}$/.test(event.date) && event.split.includes("/"));
    return { events, error: null };
  } catch (error) {
    return { events: null, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Collects evidence only; no market, portfolio, cash, ledger or order data is mutated. */
export async function runActiveUniverseSplitMetricInventory(options: CorporateActionAuditOptions = {}): Promise<CorporateActionAuditResult> {
  const asOfDate = options.asOfDate ?? process.env.AUDIT_AS_OF_DATE ?? DEFAULT_AS_OF_DATE;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) throw new Error(`Ungültiger Audit-Stichtag: ${asOfDate}`);
  const currentYear = Number(asOfDate.slice(0, 4));
  const yearStart = `${currentYear}-01-01`;
  const oneYearStart = new Date(`${asOfDate}T00:00:00.000Z`);
  oneYearStart.setUTCFullYear(oneYearStart.getUTCFullYear() - 1);
  const oneYearStartText = oneYearStart.toISOString().slice(0, 10);
  const splitLookbackStart = `${currentYear - 2}-01-01`;
  const requestDelayMs = options.requestDelayMs ?? DEFAULT_REQUEST_DELAY_MS;
  // Four simultaneous requests keep the complete active universe well below a
  // two-minute Heartbeat while retaining a conservative request rate.
  const maxConcurrentRequests = Math.max(1, Math.min(4, options.maxConcurrentRequests ?? 4));

  const [db, token] = await Promise.all([getDb(), getEodhdApiKey()]);
  if (!db) throw new Error("Datenbank nicht verfügbar");
  if (!token) throw new Error("EODHD-Schlüssel nicht verfügbar");

  const universe = await db.select({
    id: stocks.id,
    ticker: stocks.ticker,
    companyName: stocks.companyName,
    isActive: stocks.isActive,
    listType: stocks.listType,
    currency: stocks.currency,
    eodhdTicker: stocks.eodhdTicker,
    primaryTicker: stocks.primaryTicker,
    isin: stocks.isin,
    currentPrice: stocks.currentPrice,
    ytdStartPrice: stocks.ytdStartPrice,
    ytdPerformance: stocks.ytdPerformance,
    week52High: stocks.week52High,
    week52Low: stocks.week52Low,
    dataQualityStatus: stocks.dataQualityStatus,
    dataQualityNotes: stocks.dataQualityNotes,
    lastMetricsUpdate: stocks.lastMetricsUpdate,
  }).from(stocks).orderBy(asc(stocks.ticker));

  const tickers = universe.map((stock) => stock.ticker);
  const [rawRows, splitRows] = await Promise.all([
    tickers.length ? db.select({ ticker: historicalPrices.ticker, date: historicalPrices.date, close: historicalPrices.close, adjustedClose: historicalPrices.adjustedClose })
      .from(historicalPrices)
      .where(and(inArray(historicalPrices.ticker, tickers), gte(historicalPrices.date, splitLookbackStart)))
      .orderBy(asc(historicalPrices.ticker), asc(historicalPrices.date)) : [],
    tickers.length ? db.select({ ticker: splitAdjustedHistoricalPrices.ticker, date: splitAdjustedHistoricalPrices.date, adjustedClose: splitAdjustedHistoricalPrices.adjustedClose, source: splitAdjustedHistoricalPrices.source, sourceSymbol: splitAdjustedHistoricalPrices.sourceSymbol, currency: splitAdjustedHistoricalPrices.currency, retrievedAt: splitAdjustedHistoricalPrices.retrievedAt })
      .from(splitAdjustedHistoricalPrices)
      .where(and(inArray(splitAdjustedHistoricalPrices.ticker, tickers), gte(splitAdjustedHistoricalPrices.date, splitLookbackStart)))
      .orderBy(asc(splitAdjustedHistoricalPrices.ticker), asc(splitAdjustedHistoricalPrices.date)) : [],
  ]);

  const rawByTicker = new Map<string, PriceRow[]>();
  for (const row of rawRows) rawByTicker.set(row.ticker, [...(rawByTicker.get(row.ticker) ?? []), row]);
  const splitByTicker = new Map<string, SplitRow[]>();
  for (const row of splitRows) splitByTicker.set(row.ticker, [...(splitByTicker.get(row.ticker) ?? []), row]);

  const splitResults = new Map<string, { events: SplitEvent[] | null; error: string | null }>();
  for (let start = 0; start < universe.length; start += maxConcurrentRequests) {
    const batch = universe.slice(start, start + maxConcurrentRequests);
    const results = await Promise.all(batch.map(async (stock) => ({
      ticker: stock.ticker,
      result: await fetchSplits(stock.eodhdTicker || toEodhdSymbol(stock.ticker), token, splitLookbackStart, asOfDate),
    })));
    for (const { ticker, result } of results) splitResults.set(ticker, result);
    const completed = Math.min(start + batch.length, universe.length);
    if (completed % 50 < maxConcurrentRequests || completed === universe.length) console.log(`[corporateActionAudit] EODHD-Splits ${completed}/${universe.length}`);
    if (completed < universe.length && requestDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, requestDelayMs));
  }

  const freshnessCutoff = new Date(`${asOfDate}T00:00:00.000Z`);
  freshnessCutoff.setUTCDate(freshnessCutoff.getUTCDate() - 3);
  const freshnessCutoffText = freshnessCutoff.toISOString().slice(0, 10);
  const assets = universe.map((stock) => {
    const raw = rawByTicker.get(stock.ticker) ?? [];
    const rawJump = rawMechanicalJump(raw);
    const selectedSnapshot = selectDirectSplitAdjustedMetricSeries({
      ticker: stock.ticker,
      currency: stock.currency,
      isin: stock.isin,
    }, splitByTicker.get(stock.ticker) ?? []);
    const latestRetrievedAt = (splitByTicker.get(stock.ticker) ?? [])
      .map((row) => row.retrievedAt)
      .sort((left, right) => String(right).localeCompare(String(left)))[0] ?? null;
    const snapshotRows = (selectedSnapshot?.rows ?? [])
      .map((row) => ({
        date: row.date,
        value: row.close,
        source: selectedSnapshot?.source ?? null,
        sourceSymbol: selectedSnapshot?.sourceSymbol ?? null,
        currency: selectedSnapshot?.currency ?? null,
        retrievedAt: latestRetrievedAt,
      }))
      .sort((left, right) => left.date.localeCompare(right.date));
    const ytdStart = selectFirstOnOrAfter(snapshotRows, yearStart);
    const latest = selectLastOnOrBefore(snapshotRows, asOfDate);
    const oneYearRows = snapshotRows.filter((row) => row.date >= oneYearStartText && row.date <= asOfDate);
    const splitResult = splitResults.get(stock.ticker) ?? { events: null, error: "nicht abgefragt" };
    const corporateActions = splitResult.events ? classifyCorporateActions(splitResult.events) : [];
    const masterCurrent = numberOrNull(stock.currentPrice);
    const masterYtdStart = numberOrNull(stock.ytdStartPrice);
    const masterYtd = percentOrNull(stock.ytdPerformance);
    const masterHigh = numberOrNull(stock.week52High);
    const masterLow = numberOrNull(stock.week52Low);
    const expectedYtd = masterCurrent != null && ytdStart ? ((masterCurrent / ytdStart.value) - 1) * 100 : null;
    const snapshotYtd = latest && ytdStart ? ((latest.value / ytdStart.value) - 1) * 100 : null;
    const derivedHigh = max(oneYearRows);
    const derivedLow = min(oneYearRows);
    const flags: string[] = [];

    if (splitResult.error) flags.push(`EODHD-Splitabruf offen: ${splitResult.error}`);
    if (snapshotRows.length === 0) flags.push("keine splitbereinigte Preisreihe");
    if (snapshotRows.length > 0 && !ytdStart) flags.push("splitbereinigter YTD-Start fehlt");
    if (snapshotRows.length > 0 && !latest) flags.push("splitbereinigter Schlusskurs fehlt");
    if (latest && latest.date < freshnessCutoffText) flags.push(`splitbereinigte Reihe nicht frisch (letzter ${latest.date})`);
    if (masterCurrent != null && latest && materiallyDifferent(masterCurrent, latest.value, 2)) flags.push("aktueller Stammdatenkurs weicht stark von gleicher Splitreihe ab");
    if (masterYtdStart != null && ytdStart && materiallyDifferent(masterYtdStart, ytdStart.value, 1.5)) flags.push("YTD-Startpreis liegt nicht auf der splitbereinigten Basis");
    if (masterHigh != null && derivedHigh != null && materiallyDifferent(masterHigh, derivedHigh, 1.5)) flags.push("52W-Hoch liegt nicht auf der splitbereinigten Basis");
    if (masterLow != null && derivedLow != null && materiallyDifferent(masterLow, derivedLow, 1.5)) flags.push("52W-Tief liegt nicht auf der splitbereinigten Basis");
    if (masterYtd != null && expectedYtd != null && Math.abs(masterYtd - expectedYtd) >= 3) flags.push("gespeicherte YTD weicht um mindestens 3 Prozentpunkte von aktuellem Kurs und Splitbasis ab");
    if (corporateActions.length > 0 && rawJump && !snapshotRows.length) flags.push("Corporate Action ohne getrennte Splitreihe");
    if (corporateActions.length > 0 && rawJump && snapshotRows.length && !ytdStart) flags.push("Corporate Action mit unvollständiger Splitbasis");
    if (rawJump && corporateActions.length === 0) flags.push("mechanischer Rohkurssprung ohne EODHD-Splitbeleg (Corporate Action / Anbieterfehler prüfen)");
    if (!isHistoricalPriceSeriesCompatible(stock.ticker, stock.currency ?? "CHF")) flags.push("Handelslinie/Währungsbasis ist für direkte Preiskennzahlen nicht verifiziert");

    return {
      ticker: stock.ticker,
      companyName: stock.companyName,
      active: stock.isActive === 1,
      curated: stock.listType != null,
      currency: stock.currency,
      eodhdSymbol: stock.eodhdTicker || toEodhdSymbol(stock.ticker),
      primaryTicker: stock.primaryTicker,
      master: {
        currentPrice: masterCurrent,
        ytdStartPrice: masterYtdStart,
        ytdPerformance: masterYtd,
        week52High: masterHigh,
        week52Low: masterLow,
        dataQualityStatus: stock.dataQualityStatus,
        lastMetricsUpdate: stock.lastMetricsUpdate,
      },
      splitAdjustedBasis: {
        source: snapshotRows.at(-1)?.source ?? null,
        sourceSymbol: snapshotRows.at(-1)?.sourceSymbol ?? null,
        currency: snapshotRows.at(-1)?.currency ?? null,
        rows: snapshotRows.length,
        firstDate: snapshotRows[0]?.date ?? null,
        lastDate: latest?.date ?? null,
        ytdStart: ytdStart ? { date: ytdStart.date, price: ytdStart.value } : null,
        latest: latest ? { date: latest.date, price: latest.value } : null,
        week52High: derivedHigh,
        week52Low: derivedLow,
      },
      expected: {
        ytdFromMasterCurrentPct: expectedYtd,
        ytdFromSnapshotEndPct: snapshotYtd,
        ytdErrorPp: masterYtd != null && expectedYtd != null ? masterYtd - expectedYtd : null,
        currentVsSnapshotEndFactor: ratio(masterCurrent, latest?.value ?? null),
        ytdStartVsSplitBasisFactor: ratio(masterYtdStart, ytdStart?.value ?? null),
        highVsSplitBasisFactor: ratio(masterHigh, derivedHigh),
        lowVsSplitBasisFactor: ratio(masterLow, derivedLow),
      },
      rawSeries: { rows: raw.length, mechanicalJump: rawJump },
      corporateActions,
      flags,
    };
  });

  const activeAssets = assets.filter((asset) => asset.active);
  const candidates = activeAssets.filter((asset) => asset.flags.length > 0);
  const summary = {
    asOfDate,
    scope: { allStockRows: assets.length, activeStockRows: activeAssets.length, activeCuratedRows: activeAssets.filter((asset) => asset.curated).length, activeNonCuratedRows: activeAssets.filter((asset) => !asset.curated).length },
    fetched: { eodhdSplitRequests: universe.length, failed: assets.filter((asset) => asset.flags.some((flag) => flag.startsWith("EODHD-Splitabruf offen"))).length },
    activeCandidateCount: candidates.length,
    activeWithVerifiedSplitEvent: activeAssets.filter((asset) => asset.corporateActions.length > 0).length,
    activeWithForwardSplit: activeAssets.filter((asset) => asset.corporateActions.some((event) => event.kind === "forward_split")).length,
    activeWithReverseSplit: activeAssets.filter((asset) => asset.corporateActions.some((event) => event.kind === "reverse_split")).length,
    activeMissingSplitSnapshot: activeAssets.filter((asset) => asset.flags.includes("keine splitbereinigte Preisreihe")).length,
    activeYtdBasisMismatch: activeAssets.filter((asset) => asset.flags.includes("YTD-Startpreis liegt nicht auf der splitbereinigten Basis")).length,
    activeRangeBasisMismatch: activeAssets.filter((asset) => asset.flags.some((flag) => flag.startsWith("52W-"))).length,
    activeYtdCalculationMismatch: activeAssets.filter((asset) => asset.flags.includes("gespeicherte YTD weicht um mindestens 3 Prozentpunkte von aktuellem Kurs und Splitbasis ab")).length,
    candidates: candidates.map((asset) => ({ ticker: asset.ticker, flags: asset.flags, corporateActions: asset.corporateActions, ytdErrorPp: asset.expected.ytdErrorPp })),
  };

  return { asOfDate, summary, assets };
}

async function main() {
  const result = await runActiveUniverseSplitMetricInventory();
  const outDir = "docs/audit/workings";
  const outPath = `${outDir}/ACTIVE_UNIVERSE_SPLIT_METRIC_INVENTORY_${result.asOfDate}.json`;
  await mkdir(outDir, { recursive: true });
  await writeFile(outPath, JSON.stringify({ summary: result.summary, assets: result.assets }, null, 2));
  console.log(JSON.stringify({ outPath, summary: result.summary }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exit(1);
  });
}
