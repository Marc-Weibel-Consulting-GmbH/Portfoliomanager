import { and, eq, gte, inArray, sql } from "drizzle-orm";
import {
  momentumMonitorRuns,
  momentumMonitorSnapshots,
  splitAdjustedHistoricalPrices,
  stocks,
} from "../../drizzle/schema";
import { getDb } from "../db";
import {
  assessMomentumCrashRisk,
  calculateMomentumFeatures,
  classifyMomentumTrend,
  median,
  momentumPercentile,
  MOMENTUM_MONITOR_METHOD,
  type MomentumFeatures,
  type PricePoint,
} from "../lib/momentumMonitor";
import { refreshTotalReturnHistoryForTicker } from "../lib/totalReturnHistoryProvider";

export const MOMENTUM_MONITOR_HANDLER_KEY = "momentumMonitor";
export const MOMENTUM_MONITOR_MIN_INTERVAL_MINUTES = 60 * 18;
const LOOKBACK_CALENDAR_DAYS = 430;
const MAX_PRICE_STALENESS_DAYS = 7;
const SPLIT_PRICE_SOURCE = "eodhd_split_adjusted";

type MonitorStock = {
  ticker: string;
  companyName: string;
  sector: string | null;
  country: string | null;
  category: string | null;
  currency: string | null;
  dataQualityStatus: string | null;
  dataQualityNotes: string | null;
};

type QualifiedCandidate = {
  stock: MonitorStock;
  features: MomentumFeatures;
  prices: PricePoint[];
  sourceSymbol: string | null;
  region: string;
};

type BenchmarkConfig = { key: "SPI_CH" | "SP500_US" | "ACWI_GLOBAL"; ticker: string; currency: string };

const BENCHMARKS: Record<string, BenchmarkConfig> = {
  Schweiz: { key: "SPI_CH", ticker: "CHSPI.SW", currency: "CHF" },
  USA: { key: "SP500_US", ticker: "SPY.US", currency: "USD" },
  Global: { key: "ACWI_GLOBAL", ticker: "ACWI.US", currency: "USD" },
};

export type MomentumMonitorRunResult = {
  runId?: number;
  snapshotDate: string;
  status: "completed" | "skipped" | "failed";
  reason?: string;
  activeInstrumentCount: number;
  qualifiedCount: number;
  dataGapCount: number;
  excludedCount: number;
  crashRiskCount: number;
};

export function utcDateKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function isEquityEligible(category: string | null): boolean {
  return category !== "ETF";
}

/** Existing unresolved price/data-quality gates are binding for every new analytical consumer. */
export function hasBlockingDataQualityStatus(status: string | null): boolean {
  return status === "pruefen" || status === "datenluecke";
}

/** The comparison bucket is intentionally conservative: only CH and US claim local benchmarks. */
export function regionBucket(country: string | null): "Schweiz" | "USA" | "Global" {
  const normalized = (country ?? "").trim().toLowerCase();
  if (["switzerland", "schweiz", "ch"].includes(normalized)) return "Schweiz";
  if (["united states", "usa", "us", "vereinigte staaten"].includes(normalized)) return "USA";
  return "Global";
}

function toBps(value: number | null | undefined): number | null {
  return value === null || value === undefined || !Number.isFinite(value) ? null : Math.round(value * 100);
}

function dayDistance(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Number.isFinite(start) && Number.isFinite(end) ? Math.round((end - start) / 86_400_000) : Number.POSITIVE_INFINITY;
}

function uniquePrices(rows: Array<{ date: string; adjustedClose: string; sourceSymbol: string }>): PricePoint[] {
  const selected = new Map<string, PricePoint>();
  for (const row of rows) {
    const close = Number(row.adjustedClose);
    if (Number.isFinite(close) && close > 0) selected.set(row.date, { date: row.date, close });
  }
  return [...selected.values()].sort((left, right) => left.date.localeCompare(right.date));
}

async function refreshBenchmarkSnapshots(snapshotDate: string): Promise<Record<string, string>> {
  const from = new Date(`${snapshotDate}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - LOOKBACK_CALENDAR_DAYS);
  const fromDate = from.toISOString().slice(0, 10);
  const outcomes = await Promise.all(Object.values(BENCHMARKS).map(async (benchmark) => {
    const result = await refreshTotalReturnHistoryForTicker({
      ticker: benchmark.ticker,
      nativeCurrency: benchmark.currency,
      from: fromDate,
      to: snapshotDate,
    });
    return [benchmark.key, result.status] as const;
  }));
  return Object.fromEntries(outcomes);
}

/**
 * Daily, analytic-only snapshot for trend/momentum context. It refreshes only
 * three derived benchmark snapshots and persists derived monitor rows; it never
 * writes raw prices, stock masters, signals, portfolios, cash, ledgers,
 * transactions or orders.
 */
export async function runDailyMomentumMonitor(
  now = new Date(),
  options: { force?: boolean } = {},
): Promise<MomentumMonitorRunResult> {
  const db = await getDb();
  const snapshotDate = utcDateKey(now);
  const empty = {
    snapshotDate,
    activeInstrumentCount: 0,
    qualifiedCount: 0,
    dataGapCount: 0,
    excludedCount: 0,
    crashRiskCount: 0,
  };
  if (!db) return { ...empty, status: "failed", reason: "Datenbank nicht verfügbar" };

  const existing = (await db.select({ id: momentumMonitorRuns.id, status: momentumMonitorRuns.status })
    .from(momentumMonitorRuns)
    .where(eq(momentumMonitorRuns.snapshotDate, snapshotDate))
    .limit(1))[0];
  if (existing?.status === "completed" && !options.force) {
    return { ...empty, runId: existing.id, status: "skipped", reason: `Stichtag ${snapshotDate} bereits protokolliert` };
  }
  if (existing?.status === "running") {
    return { ...empty, runId: existing.id, status: "skipped", reason: `Stichtag ${snapshotDate} wird bereits verarbeitet` };
  }

  let runId = existing?.id;
  if (runId) {
    await db.update(momentumMonitorRuns).set({ status: "running", error: null, startedAt: now, completedAt: null })
      .where(eq(momentumMonitorRuns.id, runId));
  } else {
    try {
      const created = await db.insert(momentumMonitorRuns).values({ snapshotDate });
      runId = Number(created[0].insertId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("duplicate")) {
        return { ...empty, status: "skipped", reason: `Paralleler Tageslauf ${snapshotDate} erkannt` };
      }
      throw error;
    }
  }

  try {
    const benchmarkRefresh = await refreshBenchmarkSnapshots(snapshotDate);
    const active = await db.select({
      ticker: stocks.ticker,
      companyName: stocks.companyName,
      sector: stocks.sector,
      country: stocks.country,
      category: stocks.category,
      currency: stocks.currency,
      dataQualityStatus: stocks.dataQualityStatus,
      dataQualityNotes: stocks.dataQualityNotes,
    }).from(stocks).where(eq(stocks.isActive, 1));
    const activeStocks = active as MonitorStock[];
    const tickers = activeStocks.map((stock) => stock.ticker);
    const from = new Date(`${snapshotDate}T00:00:00Z`);
    from.setUTCDate(from.getUTCDate() - LOOKBACK_CALENDAR_DAYS);
    const fromDate = from.toISOString().slice(0, 10);
    const priceRows = tickers.length === 0 ? [] : await db.select({
      ticker: splitAdjustedHistoricalPrices.ticker,
      date: splitAdjustedHistoricalPrices.date,
      adjustedClose: splitAdjustedHistoricalPrices.adjustedClose,
      sourceSymbol: splitAdjustedHistoricalPrices.sourceSymbol,
    }).from(splitAdjustedHistoricalPrices).where(and(
      inArray(splitAdjustedHistoricalPrices.ticker, tickers),
      eq(splitAdjustedHistoricalPrices.source, SPLIT_PRICE_SOURCE),
      gte(splitAdjustedHistoricalPrices.date, fromDate),
    ));

    const rowsByTicker = new Map<string, Array<{ date: string; adjustedClose: string; sourceSymbol: string }>>();
    for (const row of priceRows) {
      const list = rowsByTicker.get(row.ticker) ?? [];
      list.push(row);
      rowsByTicker.set(row.ticker, list);
    }
    const benchmarkPriceRows = new Map<string, PricePoint[]>();
    for (const benchmark of Object.values(BENCHMARKS)) {
      benchmarkPriceRows.set(benchmark.key, uniquePrices(rowsByTicker.get(benchmark.ticker) ?? []));
    }

    const candidates: QualifiedCandidate[] = [];
    const baseRows: Array<Record<string, unknown>> = [];
    for (const stock of activeStocks) {
      const basis = "split_adjusted_price_return_without_cash_dividends";
      if (!isEquityEligible(stock.category)) {
        baseRows.push({
          ticker: stock.ticker, snapshotDate, companyName: stock.companyName, sector: stock.sector, region: regionBucket(stock.country),
          sourceSymbol: null, priceBasis: basis, coverageDays: 0, priceAsOfDate: null,
          dataQuality: "excluded", dataQualityReason: "ETF bleibt im ersten Aktien-Momentumuniversum ohne Peer-Rang.",
          methodVersion: MOMENTUM_MONITOR_METHOD.version,
        });
        continue;
      }
      if (hasBlockingDataQualityStatus(stock.dataQualityStatus)) {
        baseRows.push({
          ticker: stock.ticker, snapshotDate, companyName: stock.companyName, sector: stock.sector, region: regionBucket(stock.country),
          sourceSymbol: null, priceBasis: basis, coverageDays: 0, priceAsOfDate: null,
          dataQuality: "data_gap",
          dataQualityReason: stock.dataQualityNotes || "Bestehende Datenqualitäts-Sperre verhindert ein Momentum-Ranking.",
          methodVersion: MOMENTUM_MONITOR_METHOD.version,
        });
        continue;
      }
      const selectedRows = rowsByTicker.get(stock.ticker) ?? [];
      const prices = uniquePrices(selectedRows);
      const sourceSymbol = selectedRows[0]?.sourceSymbol ?? null;
      const features = calculateMomentumFeatures(prices);
      const actualAsOfDate = prices.at(-1)?.date ?? null;
      const stale = actualAsOfDate ? dayDistance(actualAsOfDate, snapshotDate) > MAX_PRICE_STALENESS_DAYS : true;
      if (!features || stale) {
        const reason = !actualAsOfDate
          ? "Keine direkt kompatible EODHD-splitbereinigte Preisrenditereihe."
          : stale
            ? `Preisreihe endet am ${actualAsOfDate}; zulässig sind maximal ${MAX_PRICE_STALENESS_DAYS} Kalendertage Rückstand.`
            : "Weniger als 253 eindeutige Handelstage in der direkten splitbereinigten Preisreihe.";
        baseRows.push({
          ticker: stock.ticker, snapshotDate, priceAsOfDate: actualAsOfDate, companyName: stock.companyName, sector: stock.sector,
          region: regionBucket(stock.country), sourceSymbol, priceBasis: basis, coverageDays: prices.length,
          dataQuality: "data_gap", dataQualityReason: reason, methodVersion: MOMENTUM_MONITOR_METHOD.version,
        });
        continue;
      }
      candidates.push({ stock, features, prices, sourceSymbol, region: regionBucket(stock.country) });
    }

    const composites = candidates.map((candidate) => candidate.features.compositeMomentumPct);
    const sectorComposites = new Map<string, number[]>();
    for (const candidate of candidates) {
      const sector = candidate.stock.sector?.trim() || "Ohne Sektor";
      sectorComposites.set(sector, [...(sectorComposites.get(sector) ?? []), candidate.features.compositeMomentumPct]);
    }

    let crashRiskCount = 0;
    for (const candidate of candidates) {
      const sector = candidate.stock.sector?.trim() || "Ohne Sektor";
      const benchmark = BENCHMARKS[candidate.region];
      const benchmarkPrices = benchmarkPriceRows.get(benchmark.key) ?? [];
      // A relative comparison is admissible only if title and reference share the same latest trading date.
      const benchmarkFeatures = calculateMomentumFeatures(benchmarkPrices.filter((row) => row.date <= candidate.features.asOfDate));
      const sameAsOfDate = benchmarkFeatures?.asOfDate === candidate.features.asOfDate;
      const relative6mPct = sameAsOfDate && benchmarkFeatures ? candidate.features.return6mPct - benchmarkFeatures.return6mPct : null;
      const relative12mPct = sameAsOfDate && benchmarkFeatures ? candidate.features.return12mPct - benchmarkFeatures.return12mPct : null;
      const trend = classifyMomentumTrend({ prices: candidate.prices, relative6mPct, relative12mPct });
      const crash = sameAsOfDate && benchmarkFeatures
        ? assessMomentumCrashRisk({ benchmarkPrices: benchmarkPrices.filter((row) => row.date <= candidate.features.asOfDate), assetReturn12mPct: candidate.features.return12mPct, relative6mPct })
        : { active: false, reason: null };
      if (crash.active) crashRiskCount += 1;
      const sectorUniverse = sectorComposites.get(sector) ?? [];
      const relativeGap = sameAsOfDate ? null : `Relative Stärke nicht angezeigt: ${benchmark.ticker} hat keine gleichzeitige, direkt splitbereinigte Preisbasis zum ${candidate.features.asOfDate}.`;
      baseRows.push({
        ticker: candidate.stock.ticker,
        snapshotDate,
        priceAsOfDate: candidate.features.asOfDate,
        companyName: candidate.stock.companyName,
        sector: candidate.stock.sector,
        region: candidate.region,
        sourceSymbol: candidate.sourceSymbol,
        priceBasis: "split_adjusted_price_return_without_cash_dividends",
        coverageDays: candidate.features.coverageDays,
        return6mBps: toBps(candidate.features.return6mPct),
        return12mBps: toBps(candidate.features.return12mPct),
        compositeBps: toBps(candidate.features.compositeMomentumPct),
        universePercentile: composites.length >= 3 ? momentumPercentile(candidate.features.compositeMomentumPct, composites) : null,
        sectorPercentile: sectorUniverse.length >= 3 ? momentumPercentile(candidate.features.compositeMomentumPct, sectorUniverse) : null,
        benchmarkKey: benchmark.key,
        benchmarkReturn6mBps: sameAsOfDate && benchmarkFeatures ? toBps(benchmarkFeatures.return6mPct) : null,
        benchmarkReturn12mBps: sameAsOfDate && benchmarkFeatures ? toBps(benchmarkFeatures.return12mPct) : null,
        relative6mBps: toBps(relative6mPct),
        relative12mBps: toBps(relative12mPct),
        trendState: trend.state,
        trendDistanceBps: toBps(trend.distanceToSma200Pct),
        crashRiskActive: crash.active ? 1 : 0,
        crashRiskReason: crash.reason,
        dataQuality: "qualified",
        dataQualityReason: relativeGap,
        methodVersion: MOMENTUM_MONITOR_METHOD.version,
      });
    }

    if (baseRows.length) {
      await db.insert(momentumMonitorSnapshots).values(baseRows as any).onDuplicateKeyUpdate({
        set: {
          priceAsOfDate: sql`VALUES(priceAsOfDate)`,
          companyName: sql`VALUES(companyName)`,
          sector: sql`VALUES(sector)`,
          region: sql`VALUES(region)`,
          sourceSymbol: sql`VALUES(sourceSymbol)`,
          priceBasis: sql`VALUES(priceBasis)`,
          coverageDays: sql`VALUES(coverageDays)`,
          return6mBps: sql`VALUES(return6mBps)`,
          return12mBps: sql`VALUES(return12mBps)`,
          compositeBps: sql`VALUES(compositeBps)`,
          universePercentile: sql`VALUES(universePercentile)`,
          sectorPercentile: sql`VALUES(sectorPercentile)`,
          benchmarkKey: sql`VALUES(benchmarkKey)`,
          benchmarkReturn6mBps: sql`VALUES(benchmarkReturn6mBps)`,
          benchmarkReturn12mBps: sql`VALUES(benchmarkReturn12mBps)`,
          relative6mBps: sql`VALUES(relative6mBps)`,
          relative12mBps: sql`VALUES(relative12mBps)`,
          trendState: sql`VALUES(trendState)`,
          trendDistanceBps: sql`VALUES(trendDistanceBps)`,
          crashRiskActive: sql`VALUES(crashRiskActive)`,
          crashRiskReason: sql`VALUES(crashRiskReason)`,
          dataQuality: sql`VALUES(dataQuality)`,
          dataQualityReason: sql`VALUES(dataQualityReason)`,
          methodVersion: sql`VALUES(methodVersion)`,
        },
      });
    }

    const qualifiedCount = candidates.length;
    const excludedCount = baseRows.filter((row) => row.dataQuality === "excluded").length;
    const dataGapCount = baseRows.filter((row) => row.dataQuality === "data_gap").length;
    const summary = {
      method: MOMENTUM_MONITOR_METHOD,
      benchmarkRefresh,
      activeInstrumentCount: activeStocks.length,
      qualifiedCount,
      dataGapCount,
      excludedCount,
      crashRiskCount,
      sectorMedianCompositeBps: Object.fromEntries([...sectorComposites.entries()].map(([sector, values]) => [sector, toBps(median(values))])),
    };
    await db.update(momentumMonitorRuns).set({
      status: "completed", activeInstrumentCount: activeStocks.length, qualifiedCount, dataGapCount, excludedCount, crashRiskCount,
      summary, completedAt: new Date(), error: null,
    }).where(eq(momentumMonitorRuns.id, runId));
    return { runId, snapshotDate, status: "completed", activeInstrumentCount: activeStocks.length, qualifiedCount, dataGapCount, excludedCount, crashRiskCount };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await db.update(momentumMonitorRuns).set({ status: "failed", error: reason, completedAt: new Date() })
      .where(eq(momentumMonitorRuns.id, runId));
    return { ...empty, runId, status: "failed", reason };
  }
}
