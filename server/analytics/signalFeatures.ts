/**
 * TS feature extractor for the GB signal model — MUST stay byte-for-byte
 * equivalent to analytics_service/ml_training.py `features_at`, otherwise the
 * features used at serving time drift from those used at training time and the
 * ONNX predictions become meaningless.
 *
 * Parity is locked by server/analytics/signalFeatures.test.ts, which compares
 * against a fixture of Python-computed features for the same price series.
 *
 * Order MUST match ml_training.FEATURE_NAMES.
 */
export const SIGNAL_FEATURE_NAMES = [
  "ret_1d", "ret_5d", "ret_20d", "mom_60d", "vol_20d", "rsi_14", "px_vs_sma50",
] as const;

function rsi(prices: number[], period = 14): number {
  if (prices.length <= period) return 50.0;
  const window = prices.slice(prices.length - (period + 1));
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < window.length; i++) {
    const d = window[i] - window[i - 1];
    if (d > 0) gains += d;
    else if (d < 0) losses += -d;
  }
  gains /= period;
  losses /= period;
  if (losses === 0) return 100.0;
  const rs = gains / losses;
  return 100.0 - 100.0 / (1.0 + rs);
}

function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

/**
 * Point-in-time feature vector using only prices up to and including index i.
 * Returns null when there isn't enough history (i < 50), matching Python.
 */
export function featuresAt(prices: number[], i: number): Record<string, number> | null {
  if (i < 50) return null;
  const w = prices.slice(0, i + 1);
  const px = w[w.length - 1];
  if (px <= 0) return null;

  const ret_1d = w[w.length - 1] / w[w.length - 2] - 1;
  const ret_5d = w[w.length - 1] / w[w.length - 6] - 1;
  const ret_20d = w[w.length - 1] / w[w.length - 21] - 1;
  const mom_60d = w.length > 61 ? w[w.length - 1] / w[w.length - 61] - 1 : 0.0;

  // vol_20d: std of the last 20 daily returns (np.std = population std).
  const last21 = w.slice(w.length - 21);
  const rets: number[] = [];
  for (let k = 1; k < last21.length; k++) rets.push((last21[k] - last21[k - 1]) / last21[k - 1]);
  let vol_20d = 0;
  if (rets.length > 1) {
    const m = mean(rets);
    vol_20d = Math.sqrt(rets.reduce((s, v) => s + (v - m) ** 2, 0) / rets.length);
  }

  const rsi_14 = rsi(w, 14) / 100.0;
  const sma50 = mean(w.slice(w.length - 50));
  const px_vs_sma50 = sma50 > 0 ? px / sma50 - 1 : 0.0;

  return { ret_1d, ret_5d, ret_20d, mom_60d, vol_20d, rsi_14, px_vs_sma50 };
}
