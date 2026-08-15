import { and, eq, gte, isNotNull } from "drizzle-orm";
import { getDb } from "../db";
import {
  screenerValidationResults,
  screenerValidationRuns,
  stockSignalCache,
} from "../../drizzle/schema";
import { callDataApi } from "../_core/dataApi";
import { fetchEODHDFundamentals } from "../_core/eodhdApi";
import { notifyOwner } from "../_core/notification";

export const SCREENER_VALIDATION_JOB_NAME = "screener-validation-weekly";
export const SCREENER_VALIDATION_MIN_INTERVAL_MINUTES = 60 * 24 * 6;
export const SAMPLE_SIZE = 20;
/** Deckt den Zeitraum vom letzten Freitags-Refresh bis Montag 08:30 UTC ab. */
export const FRESHNESS_WINDOW_HOURS = 72;
export const SOURCE_VERSION = "v1-yahoo-price-eodhd-fundamentals";

export const THRESHOLDS = {
  priceRelativePct: 2,
  peRelativePct: 10,
  pegRelativePct: 20,
  dividendRelativePct: 20,
  dividendAbsolutePp: 0.5,
} as const;

type InternalSnapshot = {
  currentPrice: number | null;
  peRatio: number | null;
  pegRatio: number | null;
  dividendYield: number | null;
  computedAt: string;
};

type ExternalSnapshot = {
  yahoo: { price: number | null; currency: string | null; retrievedAt: string; error?: string };
  eodhd: { peRatio: number | null; pegRatio: number | null; dividendYield: number | null; retrievedAt: string };
};

type MetricComparison = {
  internal: number | null;
  external: number | null;
  relativeDiffPct: number | null;
  absoluteDiffPp?: number | null;
  threshold: string;
  status: "within_tolerance" | "material" | "unavailable" | "semantic_unavailable";
};

export type ValidationComparison = {
  price: MetricComparison;
  peRatio: MetricComparison;
  pegRatio: MetricComparison;
  dividendYield: MetricComparison;
};

export type ValidationSample = {
  ticker: string;
  companyName: string;
  internal: InternalSnapshot;
};

export type ValidationRunResult = {
  runId?: number;
  weekKey: string;
  status: "completed" | "skipped" | "failed";
  reason?: string;
  sampledCount: number;
  comparedCount: number;
  materialCount: number;
  unavailableCount: number;
};

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hash32(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function isoWeekKey(date: Date): string {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function selectDeterministicSample<T extends { ticker: string }>(rows: T[], seed: string, size = SAMPLE_SIZE): T[] {
  return [...rows]
    .sort((left, right) => {
      const delta = hash32(`${seed}:${left.ticker}`) - hash32(`${seed}:${right.ticker}`);
      return delta || left.ticker.localeCompare(right.ticker);
    })
    .slice(0, size);
}

export function isFreshForWeeklyValidation(computedAt: Date, now: Date): boolean {
  return computedAt.getTime() >= now.getTime() - FRESHNESS_WINDOW_HOURS * 60 * 60 * 1000;
}

function relativeDiffPct(internal: number, external: number): number | null {
  if (external === 0) return internal === 0 ? 0 : null;
  return Math.abs((internal - external) / Math.abs(external)) * 100;
}

function compareRelative(
  internal: number | null,
  external: number | null,
  thresholdPct: number,
  semanticNull = false
): MetricComparison {
  if (internal === null || external === null) {
    return {
      internal,
      external,
      relativeDiffPct: null,
      threshold: `${thresholdPct}% relativ`,
      status: semanticNull ? "semantic_unavailable" : "unavailable",
    };
  }

  const diff = relativeDiffPct(internal, external);
  return {
    internal,
    external,
    relativeDiffPct: diff,
    threshold: `${thresholdPct}% relativ`,
    status: diff !== null && diff > thresholdPct ? "material" : "within_tolerance",
  };
}

function compareDividend(internal: number | null, external: number | null): MetricComparison {
  if (internal === null || external === null) {
    return {
      internal,
      external,
      relativeDiffPct: null,
      absoluteDiffPp: null,
      threshold: `${THRESHOLDS.dividendAbsolutePp}pp und ${THRESHOLDS.dividendRelativePct}% relativ`,
      status: internal === null && external === 0 ? "semantic_unavailable" : "unavailable",
    };
  }

  const absoluteDiffPp = Math.abs(internal - external);
  const relative = relativeDiffPct(internal, external);
  const material = absoluteDiffPp > THRESHOLDS.dividendAbsolutePp
    && relative !== null
    && relative > THRESHOLDS.dividendRelativePct;
  return {
    internal,
    external,
    relativeDiffPct: relative,
    absoluteDiffPp,
    threshold: `${THRESHOLDS.dividendAbsolutePp}pp und ${THRESHOLDS.dividendRelativePct}% relativ`,
    status: material ? "material" : "within_tolerance",
  };
}

export function buildComparison(internal: InternalSnapshot, external: ExternalSnapshot): ValidationComparison {
  return {
    price: compareRelative(internal.currentPrice, external.yahoo.price, THRESHOLDS.priceRelativePct),
    // Der Preis wird unabhängig über Yahoo geprüft. Die drei Fundamentalkennzahlen
    // werden gegen einen frischen EODHD-Rohdatenabruf geprüft und kontrollieren damit
    // Mapping, Skalierung und Cache-Schreiblogik ohne eine Produktdefinition zu raten.
    peRatio: compareRelative(internal.peRatio, external.eodhd.peRatio, THRESHOLDS.peRelativePct),
    pegRatio: compareRelative(internal.pegRatio, external.eodhd.pegRatio, THRESHOLDS.pegRelativePct),
    dividendYield: compareDividend(internal.dividendYield, external.eodhd.dividendYield),
  };
}

export function buildYahooChartQuery(ticker: string) {
  return {
    symbol: ticker,
    region: "US",
    interval: "1d",
    range: "5d",
    includeAdjustedClose: "true",
    events: "div,split",
  };
}

function hasMaterialDifference(comparison: ValidationComparison): boolean {
  return Object.values(comparison).some(metric => metric.status === "material");
}

function hasUnavailableValue(comparison: ValidationComparison): boolean {
  return Object.values(comparison).some(metric =>
    metric.status === "unavailable" || metric.status === "semantic_unavailable"
  );
}

async function fetchYahooPrice(ticker: string): Promise<ExternalSnapshot["yahoo"]> {
  const retrievedAt = new Date().toISOString();
  try {
    const result = await callDataApi("YahooFinance/get_stock_chart", {
      query: buildYahooChartQuery(ticker),
    }) as any;
    const meta = result?.chart?.result?.[0]?.meta;
    return {
      price: asNumber(meta?.regularMarketPrice),
      currency: typeof meta?.currency === "string" ? meta.currency : null,
      retrievedAt,
      ...(meta?.regularMarketPrice === undefined ? { error: "Yahoo-Marktpreis nicht verfügbar" } : {}),
    };
  } catch (error) {
    return {
      price: null,
      currency: null,
      retrievedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function runWeeklyScreenerValidation(now = new Date()): Promise<ValidationRunResult> {
  const db = await getDb();
  const weekKey = isoWeekKey(now);
  const sampleSeed = `screener-validation:${weekKey}`;
  if (!db) {
    return { weekKey, status: "failed", reason: "Datenbank nicht verfügbar", sampledCount: 0, comparedCount: 0, materialCount: 0, unavailableCount: 0 };
  }

  const existing = await db
    .select({ id: screenerValidationRuns.id, status: screenerValidationRuns.status })
    .from(screenerValidationRuns)
    .where(eq(screenerValidationRuns.weekKey, weekKey))
    .limit(1);
  if (existing[0]) {
    return {
      runId: existing[0].id,
      weekKey,
      status: "skipped",
      reason: `ISO-Woche ${weekKey} bereits mit Status ${existing[0].status} protokolliert`,
      sampledCount: 0,
      comparedCount: 0,
      materialCount: 0,
      unavailableCount: 0,
    };
  }

  let runId: number | undefined;
  try {
    const created = await db.insert(screenerValidationRuns).values({ weekKey, sampleSeed, sourceVersion: SOURCE_VERSION });
    runId = Number(created[0].insertId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("duplicate")) {
      return { weekKey, status: "skipped", reason: `Parallel-Trigger für ${weekKey} erkannt`, sampledCount: 0, comparedCount: 0, materialCount: 0, unavailableCount: 0 };
    }
    throw error;
  }

  try {
    const freshnessCutoff = new Date(now.getTime() - FRESHNESS_WINDOW_HOURS * 60 * 60 * 1000);
    const rows = await db
      .select()
      .from(stockSignalCache)
      .where(and(gte(stockSignalCache.computedAt, freshnessCutoff), isNotNull(stockSignalCache.currentPrice)));
    const sample = selectDeterministicSample(rows, sampleSeed).map(row => ({
      ticker: row.ticker,
      companyName: row.companyName,
      internal: {
        currentPrice: asNumber(row.currentPrice),
        peRatio: asNumber(row.peRatio),
        pegRatio: asNumber(row.pegRatio),
        dividendYield: asNumber(row.dividendYield),
        computedAt: row.computedAt.toISOString(),
      },
    } satisfies ValidationSample));

    const results = await mapWithConcurrency(sample, 4, async item => {
      const [yahoo, eodhd] = await Promise.all([fetchYahooPrice(item.ticker), fetchEODHDFundamentals(item.ticker)]);
      const external: ExternalSnapshot = {
        yahoo,
        eodhd: {
          peRatio: eodhd.peRatio,
          pegRatio: eodhd.pegRatio,
          dividendYield: eodhd.dividendYield,
          retrievedAt: new Date().toISOString(),
        },
      };
      const comparison = buildComparison(item.internal, external);
      const material = hasMaterialDifference(comparison);
      const unavailable = hasUnavailableValue(comparison);
      return {
        item,
        external,
        comparison,
        material,
        unavailable,
        classification: material ? "material_difference" : unavailable ? "partial_source_coverage" : "within_tolerance",
      };
    });

    if (results.length > 0) {
      await db.insert(screenerValidationResults).values(results.map(result => ({
        runId: runId!,
        ticker: result.item.ticker,
        companyName: result.item.companyName,
        currency: result.external.yahoo.currency,
        internalSnapshot: result.item.internal,
        externalSnapshot: result.external,
        comparison: result.comparison,
        classification: result.classification,
        isMaterial: result.material ? 1 : 0,
      })));
    }

    const materialCount = results.filter(result => result.material).length;
    const unavailableCount = results.filter(result => result.unavailable).length;
    const completedAt = new Date();
    let notifiedAt: Date | undefined;
    if (materialCount > 0) {
      const tickers = results.filter(result => result.material).map(result => result.item.ticker).join(", ");
      const notified = await notifyOwner({
        title: `Screener-Validierung: ${materialCount} materielle Abweichung${materialCount === 1 ? "" : "en"}`,
        content: `Wöchentliche Stichprobe ${weekKey}: ${materialCount} von ${results.length} Titeln überschreiten mindestens eine definierte Schwelle. Betroffene Titel: ${tickers}. Details sind im Validierungslauf #${runId} gespeichert. Es wurden keine Scores automatisch geändert.`,
      });
      if (notified) notifiedAt = completedAt;
    }

    await db.update(screenerValidationRuns).set({
      status: "completed",
      sampledCount: sample.length,
      comparedCount: results.length,
      materialCount,
      unavailableCount,
      notifiedAt,
      completedAt,
    }).where(eq(screenerValidationRuns.id, runId));

    return { runId, weekKey, status: "completed", sampledCount: sample.length, comparedCount: results.length, materialCount, unavailableCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.update(screenerValidationRuns).set({ status: "failed", error: message, completedAt: new Date() })
      .where(eq(screenerValidationRuns.id, runId));
    return { runId, weekKey, status: "failed", reason: message, sampledCount: 0, comparedCount: 0, materialCount: 0, unavailableCount: 0 };
  }
}
