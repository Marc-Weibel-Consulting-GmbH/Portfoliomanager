export type HistoricalVolatilityPricePoint = {
  date: string;
  close: number | string | null;
  adjustedClose?: number | string | null;
};

export type PriceVolatilityBasis =
  | "adjusted_close_total_return"
  | "raw_close_price_return";

export type PriceVolatilitySeriesResult = {
  status:
    | "available_adjusted_total_return"
    | "available_raw_price"
    | "possible_unadjusted_split"
    | "insufficient_observations";
  basis: PriceVolatilityBasis | null;
  prices: number[];
  observations: number;
  adjustedCoveragePct: number;
  possibleSplitDate: string | null;
};

const DEFAULT_SPLIT_LIKE_MOVE = 0.4;

function numeric(value: number | string | null | undefined): number | null {
  const result = Number(value);
  return Number.isFinite(result) && result > 0 ? result : null;
}

/**
 * Chooses exactly one homogeneous source basis for daily-return volatility.
 *
 * `adjusted_close` from EODHD is total-return-adjusted for both dividends and
 * splits. It may only be used when every selected trading date has a valid
 * value. Otherwise this helper either uses the full raw close series for a
 * price-return volatility, or returns an explicit data gap when the raw series
 * contains a split-like discontinuity. It never mixes adjusted and raw values
 * row by row, because doing so creates a non-economic return at the boundary.
 */
export function selectFiveYearPriceVolatilitySeries(
  input: HistoricalVolatilityPricePoint[],
  _asOf: Date = new Date(),
  options: {
    minimumObservations?: number;
    splitLikeMove?: number;
  } = {},
): PriceVolatilitySeriesResult {
  const minimumObservations = options.minimumObservations ?? 1_000;
  const splitLikeMove = options.splitLikeMove ?? DEFAULT_SPLIT_LIKE_MOVE;

  const byDate = new Map<string, { date: string; close: number | null; adjustedClose: number | null }>();
  for (const point of input) {
    const date = String(point.date).slice(0, 10);
    if (!date) continue;
    byDate.set(date, {
      date,
      close: numeric(point.close),
      adjustedClose: numeric(point.adjustedClose),
    });
  }

  const points = Array.from(byDate.values())
    .filter((point) => point.close !== null)
    .sort((left, right) => left.date.localeCompare(right.date));
  const observations = Math.max(0, points.length - 1);
  const adjustedCount = points.filter((point) => point.adjustedClose !== null).length;
  const adjustedCoveragePct = points.length === 0
    ? 0
    : Number(((adjustedCount / points.length) * 100).toFixed(1));

  if (observations < minimumObservations) {
    return {
      status: "insufficient_observations",
      basis: null,
      prices: [],
      observations,
      adjustedCoveragePct,
      possibleSplitDate: null,
    };
  }

  if (adjustedCount === points.length) {
    return {
      status: "available_adjusted_total_return",
      basis: "adjusted_close_total_return",
      prices: points.map((point) => point.adjustedClose as number),
      observations,
      adjustedCoveragePct,
      possibleSplitDate: null,
    };
  }

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1].close as number;
    const current = points[index].close as number;
    const dailyMove = Math.abs(current / previous - 1);
    if (dailyMove >= splitLikeMove) {
      return {
        status: "possible_unadjusted_split",
        basis: null,
        prices: [],
        observations,
        adjustedCoveragePct,
        possibleSplitDate: points[index].date,
      };
    }
  }

  return {
    status: "available_raw_price",
    basis: "raw_close_price_return",
    prices: points.map((point) => point.close as number),
    observations,
    adjustedCoveragePct,
    possibleSplitDate: null,
  };
}
