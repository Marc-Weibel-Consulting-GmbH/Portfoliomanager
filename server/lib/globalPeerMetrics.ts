import { apiCache, CACHE_TTL } from "../_core/apiCache";
import { calcSharpe } from "../analytics/riskStats";
import { fetchEodSeries } from "../jobs/importHistoricalPrices";
import { getDreiScores } from "./dreiScoresService";
import { rechneSignal } from "./dreiScoreSignal";
import { timingUndRegimeAm } from "./punktInZeitTiming";

const MIN_SHARPE_RETURNS = 60;
const FIVE_YEARS_MS = 5 * 365.25 * 24 * 60 * 60 * 1000;

export type GlobalPeerDisplayMetrics = {
  sharpeRatio: number | null;
  quality: number | null;
  valuation: number | null;
  timing: number | null;
  signalScore: number | null;
  signalLabel: string | null;
};

const emptyMetrics = (): GlobalPeerDisplayMetrics => ({
  sharpeRatio: null,
  quality: null,
  valuation: null,
  timing: null,
  signalScore: null,
  signalLabel: null,
});

/**
 * Derives the same observable risk/timing fields used by portfolio comparisons,
 * but operates only on an in-memory EODHD series. A global preview therefore
 * never writes a price row, a stock-score row, or a watchlist row merely to
 * render its metrics.
 */
export function deriveGlobalPeerMarketMetrics(
  series: { dates: string[]; prices: number[] },
): Pick<GlobalPeerDisplayMetrics, "sharpeRatio" | "timing"> & { regime: string } {
  const points = series.dates
    .map((date, index) => ({ date, close: series.prices[index] }))
    .filter((point): point is { date: string; close: number } => Boolean(point.date) && Number.isFinite(point.close) && point.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (points.length < 2) return { sharpeRatio: null, timing: null, regime: "default" };

  const returns: number[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1].close;
    const current = points[index].close;
    if (previous > 0 && current > 0) returns.push((current - previous) / previous);
  }
  const sharpeRatio = returns.length >= MIN_SHARPE_RETURNS ? calcSharpe(returns) : null;
  const timing = timingUndRegimeAm(points, points[points.length - 1].date);
  return { sharpeRatio, timing: timing.timing, regime: timing.regime };
}

/**
 * Enriches a source-backed global candidate in read-only mode. Fundamental
 * scores are calculated by the established Drei-Score service; Sharpe and
 * timing are derived from its EODHD adjusted-close series. Missing provider
 * inputs remain a visible gap rather than a generated value.
 */
export async function getGlobalPeerDisplayMetrics(input: {
  ticker: string;
  sector: string | null;
  dividendYield: number | null;
}): Promise<GlobalPeerDisplayMetrics> {
  const cacheKey = `position-alternatives:metrics:${input.ticker}`;
  const cached = apiCache.get<GlobalPeerDisplayMetrics>(cacheKey);
  if (cached) return cached;

  const now = new Date();
  const from = new Date(now.getTime() - FIVE_YEARS_MS).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);
  try {
    const [drei, series] = await Promise.all([
      getDreiScores(input.ticker, { sektor: input.sector, dividendenrendite: input.dividendYield }),
      fetchEodSeries(input.ticker, from, to),
    ]);
    const market = deriveGlobalPeerMarketMetrics(series);
    const signal = rechneSignal({
      qualitaet: drei.qualitaet.gesamt,
      bewertung: drei.bewertung.score,
      timing: market.timing,
      regime: market.regime,
    });
    const metrics: GlobalPeerDisplayMetrics = {
      sharpeRatio: market.sharpeRatio,
      quality: drei.qualitaet.gesamt,
      valuation: drei.bewertung.score,
      timing: market.timing,
      signalScore: signal.score,
      signalLabel: signal.label,
    };
    apiCache.set(cacheKey, metrics, CACHE_TTL.FUNDAMENTALS);
    return metrics;
  } catch (error) {
    console.warn(`[PositionAlternatives] Global peer metrics unavailable for ${input.ticker}:`, error);
    const metrics = emptyMetrics();
    apiCache.set(cacheKey, metrics, CACHE_TTL.QUOTE);
    return metrics;
  }
}
