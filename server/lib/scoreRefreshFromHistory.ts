import { calculateMomentumScore } from "../analytics/qualityMomentumEngine";
import { detectBubble } from "../analytics/lpplsEngine";
import { rsiWilder } from "./rsi";
import { berechneTiming, type TimingErgebnis } from "./dreiScoreSignal";
import { regimeMitTotband } from "./signals/regimeMitTotband";

export type PricePointForTiming = { date: string; close: number };

export interface TimingRefreshResult {
  ready: boolean;
  regime: string;
  timing: TimingErgebnis;
  hinweis: string;
  currentPrice: number | null;
  ytdPerformance: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
}

const MINIMUM_PRICES_FOR_TIMING = 60;

const emptyTiming = (): TimingErgebnis => ({
  score: null,
  abdeckung: 0,
  faktoren: [],
});

/**
 * Der identische technische Teil des stündlichen Signallaufs, aber rein und
 * ohne Seiteneffekte. So kann eine vom Nutzer explizit geladene EODHD-Reihe
 * ihren Timing-/Signalzustand sofort erhalten — sie muss nicht bis zum Cron
 * warten. Bei einer unzureichenden Reihe wird kein Wert geschätzt.
 */
export function berechneTimingAusPreisreihe(
  input: PricePointForTiming[],
  currentPriceInput?: number | null,
  asOf = new Date(),
): TimingRefreshResult {
  const byDate = new Map<string, number>();
  for (const point of input) {
    const date = String(point.date).slice(0, 10);
    const close = Number(point.close);
    if (date && Number.isFinite(close) && close > 0) byDate.set(date, close);
  }
  const series = [...byDate.entries()]
    .map(([date, close]) => ({ date, close }))
    .sort((left, right) => left.date.localeCompare(right.date));
  const prices = series.map((point) => point.close);

  if (prices.length < MINIMUM_PRICES_FOR_TIMING) {
    return {
      ready: false,
      regime: "default",
      timing: emptyTiming(),
      hinweis: `Timing nicht berechnet — mindestens ${MINIMUM_PRICES_FOR_TIMING} belastbare Preiszeilen erforderlich (vorhanden: ${prices.length}).`,
      currentPrice: null,
      ytdPerformance: null,
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow: null,
    };
  }

  const currentPrice = currentPriceInput != null && Number.isFinite(currentPriceInput) && currentPriceInput > 0
    ? currentPriceInput
    : prices.at(-1) ?? null;
  const yearStart = `${asOf.getUTCFullYear()}-01-01`;
  const firstYtd = series.find((point) => point.date >= yearStart) ?? series[0];
  const ytdPerformance = currentPrice !== null && firstYtd && firstYtd.close > 0
    ? ((currentPrice - firstYtd.close) / firstYtd.close) * 100
    : null;
  const fiftyTwoWeekHigh = Math.max(...prices);
  const fiftyTwoWeekLow = Math.min(...prices);

  let momentum: number | null = null;
  let rsi14: number | null = null;
  let bubbleScore: number | null = null;
  let regime = "default";
  try { momentum = calculateMomentumScore({ prices }).score; } catch { /* data gap handled below */ }
  try { rsi14 = rsiWilder(prices, 14); } catch { /* data gap handled below */ }
  try { bubbleScore = detectBubble({ prices }).bubbleScore; } catch { /* optional factor */ }
  try { regime = regimeMitTotband(prices); } catch { /* default remains explicit */ }

  const timing = berechneTiming({
    momentum,
    rsi14,
    positionIn52W: currentPrice !== null && fiftyTwoWeekHigh > fiftyTwoWeekLow
      ? (currentPrice - fiftyTwoWeekLow) / (fiftyTwoWeekHigh - fiftyTwoWeekLow)
      : null,
    ytdPerformance,
    blasenScore: bubbleScore,
  });

  return {
    ready: timing.score !== null,
    regime,
    timing,
    hinweis: timing.score === null
      ? "Timing nicht berechenbar — die geladene Preisreihe deckt zu wenige technische Faktoren ab."
      : "Timing aus der soeben geladenen EODHD-Preisreihe berechnet.",
    currentPrice,
    ytdPerformance,
    fiftyTwoWeekHigh,
    fiftyTwoWeekLow,
  };
}
