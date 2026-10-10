import { and, eq, gte, inArray } from "drizzle-orm";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { splitAdjustedHistoricalPrices, stocks } from "../../drizzle/schema";
import { getDb } from "../db";
import { assessMomentumCrashRisk, calculateMomentumFeatures, classifyMomentumTrend, momentumPercentile, type PricePoint } from "../lib/momentumMonitor";
import { evaluateMomentumWalkForward, type HistoricalMomentumRow } from "../lib/momentumWalkForwardBacktest";

const SOURCE = "eodhd_split_adjusted";
const BENCHMARK_BY_REGION: Record<string, string> = { Schweiz: "CHSPI.SW", USA: "SPY.US", Global: "ACWI.US" };
const BENCHMARKS = Object.values(BENCHMARK_BY_REGION);
const START = process.env.MOMENTUM_BACKTEST_START ?? "2022-08-01";
const END = process.env.MOMENTUM_BACKTEST_END ?? "2026-10-09";
const OUTPUT = resolve(process.cwd(), "docs/audit/workings/MOMENTUM_WALK_FORWARD_EVIDENCE_2026-10-10.json");

function region(country: string | null): "Schweiz" | "USA" | "Global" {
  const normalized = (country ?? "").trim().toLowerCase();
  if (["switzerland", "schweiz", "ch"].includes(normalized)) return "Schweiz";
  if (["united states", "usa", "us", "vereinigte staaten"].includes(normalized)) return "USA";
  return "Global";
}
function days(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}
function monthEnds(from: string, to: string): string[] {
  const result: string[] = [];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  while (cursor <= end) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 2, 0));
  }
  return result;
}
function unique(rows: Array<{ date: string; adjustedClose: string }>): PricePoint[] {
  const dates = new Map<string, PricePoint>();
  for (const row of rows) {
    const close = Number(row.adjustedClose);
    if (Number.isFinite(close) && close > 0) dates.set(row.date, { date: row.date, close });
  }
  return [...dates.values()].sort((left, right) => left.date.localeCompare(right.date));
}
function latestOnOrBefore(series: PricePoint[], date: string): PricePoint | null {
  for (let index = series.length - 1; index >= 0; index -= 1) if (series[index].date <= date) return series[index];
  return null;
}
function firstAfter(series: PricePoint[], date: string): PricePoint | null {
  return series.find((point) => point.date > date) ?? null;
}
function firstOnOrAfter(series: PricePoint[], date: string): PricePoint | null {
  return series.find((point) => point.date >= date) ?? null;
}
function addDays(date: string, count: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + count);
  return next.toISOString().slice(0, 10);
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Datenbank nicht verfügbar");
  const universe = await db.select({ ticker: stocks.ticker, country: stocks.country, category: stocks.category, dataQualityStatus: stocks.dataQualityStatus })
    .from(stocks).where(eq(stocks.isActive, 1));
  const eligible = universe.filter((stock) => stock.category !== "ETF" && stock.dataQualityStatus !== "datenluecke" && stock.dataQualityStatus !== "pruefen");
  const tickerSet = [...new Set([...eligible.map((stock) => stock.ticker), ...BENCHMARKS])];
  const priceRows = await db.select({ ticker: splitAdjustedHistoricalPrices.ticker, date: splitAdjustedHistoricalPrices.date, adjustedClose: splitAdjustedHistoricalPrices.adjustedClose })
    .from(splitAdjustedHistoricalPrices)
    .where(and(inArray(splitAdjustedHistoricalPrices.ticker, tickerSet), eq(splitAdjustedHistoricalPrices.source, SOURCE), gte(splitAdjustedHistoricalPrices.date, START)));
  const byTicker = new Map<string, Array<{ date: string; adjustedClose: string }>>();
  for (const row of priceRows) byTicker.set(row.ticker, [...(byTicker.get(row.ticker) ?? []), row]);
  const prices = new Map([...byTicker.entries()].map(([ticker, rows]) => [ticker, unique(rows)]));
  const months = monthEnds("2023-10-01", "2026-08-31");
  const observations: HistoricalMomentumRow[] = [];
  const perMonth: Array<Record<string, unknown>> = [];
  let noBenchmarkMatch = 0;
  for (const snapshotDate of months) {
    const candidates: Array<{ ticker: string; series: PricePoint[]; asOf: PricePoint; return6m: number; return12m: number; region: "Schweiz" | "USA" | "Global" }> = [];
    for (const stock of eligible) {
      const all = prices.get(stock.ticker) ?? [];
      const asOf = latestOnOrBefore(all, snapshotDate);
      if (!asOf || days(asOf.date, snapshotDate) > 7) continue;
      const series = all.filter((point) => point.date <= asOf.date);
      const features = calculateMomentumFeatures(series);
      if (!features || features.asOfDate !== asOf.date) continue;
      candidates.push({ ticker: stock.ticker, series, asOf, return6m: features.return6mPct, return12m: features.return12mPct, region: region(stock.country) });
    }
    const composites = candidates.map((candidate) => (candidate.return6m + candidate.return12m) / 2);
    let monthRows = 0;
    for (const candidate of candidates) {
      const benchmarkSeries = (prices.get(BENCHMARK_BY_REGION[candidate.region]) ?? []).filter((point) => point.date <= candidate.asOf.date);
      const benchmarkFeatures = calculateMomentumFeatures(benchmarkSeries);
      const exactBenchmark = benchmarkFeatures?.asOfDate === candidate.asOf.date;
      // The live monitor may display an absolute trend with the relative-strength
      // field empty. A backtest may not: otherwise it would silently interpret a
      // missing benchmark as zero relative strength and turn an absent crash gate
      // into a favourable historical outcome.
      if (!exactBenchmark || !benchmarkFeatures) {
        noBenchmarkMatch += 1;
        continue;
      }
      const relative6m = candidate.return6m - benchmarkFeatures.return6mPct;
      const relative12m = candidate.return12m - benchmarkFeatures.return12mPct;
      const trend = classifyMomentumTrend({ prices: candidate.series, relative6mPct: relative6m, relative12mPct: relative12m });
      const crash = assessMomentumCrashRisk({ benchmarkPrices: benchmarkSeries, assetReturn12mPct: candidate.return12m, relative6mPct: relative6m });
      const execution = firstAfter(prices.get(candidate.ticker) ?? [], candidate.asOf.date);
      const exit = execution ? firstOnOrAfter(prices.get(candidate.ticker) ?? [], addDays(execution.date, 28)) : null;
      if (!execution || !exit || days(execution.date, exit.date) > 45) continue;
      observations.push({
        ticker: candidate.ticker, signalDate: candidate.asOf.date, executionDate: execution.date, exitDate: exit.date,
        entryPrice: execution.close, exitPrice: exit.close,
        universePercentile: composites.length >= 3 ? momentumPercentile((candidate.return6m + candidate.return12m) / 2, composites) : null,
        trendState: trend.state, crashRiskActive: crash.active, dataQuality: "qualified",
      });
      monthRows += 1;
    }
    perMonth.push({ snapshotDate, eligibleCrossSection: candidates.length, evaluatedRows: monthRows });
  }
  const result = evaluateMomentumWalkForward(observations);
  const output = {
    generatedAt: new Date().toISOString(), method: "retrospective_price_only_proxy_v1", source: SOURCE,
    interval: { priceHistoryFrom: START, through: END, decisionMonths: months[0] + " to " + months.at(-1), holding: "first direct close after decision date to first direct close at least 28 days later", censor: "minimum one trading-day price gap after the observable decision close" },
    universe: { activeInstruments: universe.length, excludedEtfsOrKnownDataGaps: universe.length - eligible.length, eligibleCurrentUniverse: eligible.length, survivorshipBias: "Current active universe is used; delisted or removed securities are not reconstructed. This result cannot support signal weighting." },
    exactBenchmarkMatchGaps: noBenchmarkMatch,
    monthCoverage: perMonth,
    result,
    conclusion: "This is a fixed, price-only research proxy. It is explicitly not comparable to, and cannot modify, the point-in-time three-score signal. Any apparent outperformance is non-actionable until a survivor-free universe and frozen daily snapshots provide an independent comparison.",
  };
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ output: OUTPUT, inputRows: observations.length, result }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
