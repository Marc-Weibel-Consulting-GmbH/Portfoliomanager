import { getHistoricalPriceCurrency, isHistoricalPriceSeriesCompatible, toEodhdSymbol } from "./eodhdSymbol";
import { resolveVerifiedNativeRiskSource } from "./nativeRiskHistory";

export type SplitAdjustedSnapshotRow = {
  ticker?: string;
  date: string | Date;
  adjustedClose: string | number | null;
  currency: string | null;
  source: string;
  sourceSymbol: string | null;
};

export type DirectMetricInstrument = {
  ticker: string;
  currency: string | null;
  isin?: string | null;
};

export type DirectSplitAdjustedSeries = {
  source: string;
  sourceSymbol: string;
  currency: string;
  rows: Array<{ date: string; close: number }>;
};

export type SplitAdjustedMarketMetrics = {
  startDate: string;
  startPrice: number;
  endDate: string;
  endPrice: number;
  ytdPerformancePct: number;
  week52High: number;
  week52Low: number;
};

function normalise(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function toDate(value: string | Date): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  const parsed = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(parsed) ? parsed : null;
}

function positive(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Returns true only when a dedicated split-adjusted snapshot represents the
 * exact market line used by the stock master. A foreign ADR, a currency proxy
 * or an ISIN-equivalent primary listing may remain valid for portfolio-risk
 * research, but must never overwrite direct quote/YTD/52-week fields.
 */
export function isDirectSplitAdjustedMetricSeries(input: {
  instrument: DirectMetricInstrument;
  source: string;
  sourceSymbol: string | null;
  sourceCurrency: string | null;
}): boolean {
  const ticker = normalise(input.instrument.ticker);
  const nativeCurrency = normalise(input.instrument.currency);
  const source = normalise(input.source);
  const sourceSymbol = normalise(input.sourceSymbol);
  const sourceCurrency = normalise(input.sourceCurrency);
  if (!ticker || !nativeCurrency || !sourceSymbol || !sourceCurrency) return false;

  if (source === "EODHD_SPLIT_ADJUSTED") {
    return isHistoricalPriceSeriesCompatible(ticker, nativeCurrency)
      && sourceSymbol === normalise(toEodhdSymbol(ticker))
      && sourceCurrency === normalise(getHistoricalPriceCurrency(ticker, nativeCurrency));
  }

  if (source === "YAHOO_CLOSE_SPLIT_ADJUSTED") {
    const native = resolveVerifiedNativeRiskSource({
      ticker,
      nativeCurrency,
      isin: input.instrument.isin ?? null,
    });
    // A same-ISIN foreign primary line is suitable for the separately labelled
    // risk proxy, but direct market fields belong to the held listing only.
    return native?.identity === "same_listing"
      && sourceSymbol === normalise(native.sourceSymbol)
      && sourceCurrency === normalise(native.sourceCurrency);
  }

  return false;
}

/**
 * Selects one complete, directly compatible split-adjusted source. It never
 * merges source rows day-by-day and deliberately refuses unmatched listings.
 */
export function selectDirectSplitAdjustedMetricSeries(
  instrument: DirectMetricInstrument,
  rows: SplitAdjustedSnapshotRow[],
): DirectSplitAdjustedSeries | null {
  const candidates = new Map<string, DirectSplitAdjustedSeries>();

  for (const row of rows) {
    const date = toDate(row.date);
    const close = positive(row.adjustedClose);
    const source = normalise(row.source);
    const sourceSymbol = normalise(row.sourceSymbol);
    const currency = normalise(row.currency);
    if (!date || close === null || !source || !sourceSymbol || !currency) continue;
    if (!isDirectSplitAdjustedMetricSeries({
      instrument,
      source,
      sourceSymbol,
      sourceCurrency: currency,
    })) continue;

    const key = `${source}|${sourceSymbol}|${currency}`;
    const candidate = candidates.get(key) ?? {
      source: source.toLowerCase(),
      sourceSymbol,
      currency,
      rows: [],
    };
    candidate.rows.push({ date, close });
    candidates.set(key, candidate);
  }

  const selected = [...candidates.values()]
    .map((candidate) => {
      const byDate = new Map<string, { date: string; close: number }>();
      for (const row of candidate.rows) byDate.set(row.date, row);
      return {
        ...candidate,
        rows: [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date)),
      };
    })
    .sort((left, right) => {
      const leftLast = left.rows.at(-1)?.date ?? "";
      const rightLast = right.rows.at(-1)?.date ?? "";
      return rightLast.localeCompare(leftLast)
        || right.rows.length - left.rows.length
        || left.source.localeCompare(right.source);
    })[0];

  return selected && selected.rows.length > 0 ? selected : null;
}

/**
 * Derives display and signal anchors exclusively from one price-return series:
 * split adjustments are included, cash dividends are excluded. This is the
 * correct basis for YTD and 52-week price-range metrics, unlike total-return
 * snapshots and unlike an unadjusted legacy master-field mixture.
 */
export function calculateSplitAdjustedMarketMetrics(
  rows: Array<{ date: string; close: number }>,
  asOf: Date = new Date(),
  currentPriceOverride?: number | null,
): SplitAdjustedMarketMetrics | null {
  const byDate = new Map<string, { date: string; close: number }>();
  for (const row of rows) {
    const date = toDate(row.date);
    const close = positive(row.close);
    if (date && close !== null) byDate.set(date, { date, close });
  }
  const series = [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
  if (series.length === 0) return null;

  const currentYear = asOf.getUTCFullYear();
  const startBoundary = `${currentYear}-01-01`;
  const startWindowEnd = `${currentYear}-01-15`;
  const start = series.find((row) => row.date >= startBoundary && row.date <= startWindowEnd);
  const end = series.at(-1);
  if (!start || !end) return null;

  const week52BoundaryDate = new Date(Date.UTC(asOf.getUTCFullYear() - 1, asOf.getUTCMonth(), asOf.getUTCDate()));
  const week52Boundary = week52BoundaryDate.toISOString().slice(0, 10);
  const week52Rows = series.filter((row) => row.date >= week52Boundary && row.date <= end.date);
  if (week52Rows.length === 0) return null;

  // During the trading day, the point quote can legitimately be newer than
  // the last EOD snapshot. It remains usable only as the *end* of the same
  // direct listing series; the historical anchors and split basis are never
  // replaced. A 2x guard rejects accidental post/pre-split mixing while still
  // leaving exceptional verified capital events to the snapshot-refresh path.
  const candidateCurrent = positive(currentPriceOverride);
  const endPrice = candidateCurrent !== null
    && candidateCurrent / end.close >= 0.5
    && candidateCurrent / end.close <= 2
    ? candidateCurrent
    : end.close;

  return {
    startDate: start.date,
    startPrice: start.close,
    endDate: end.date,
    endPrice,
    ytdPerformancePct: ((endPrice - start.close) / start.close) * 100,
    week52High: Math.max(...week52Rows.map((row) => row.close)),
    week52Low: Math.min(...week52Rows.map((row) => row.close)),
  };
}
