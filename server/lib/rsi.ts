/**
 * Wilder-RSI(14) aus Schlusskursen.
 *
 * Stand zeichengleich in `cron/signalCacheCron.ts` und `routers/signalsRouter.ts`.
 * Die Punkt-in-Zeit-Rekonstruktion braucht denselben Wert — eine dritte Kopie
 * hätte bedeutet, dass ein Backtest und der Live-Betrieb auseinanderlaufen
 * können, ohne dass es jemandem auffällt.
 *
 * (In `routers/backtestRouter.ts` und `analytics/engine.ts` liegen zwei weitere
 * Varianten, die eine ganze REIHE statt eines Wertes zurückgeben. Die sind hier
 * bewusst nicht angefasst — anderer Rückgabetyp, andere Aufrufer.)
 */

/**
 * RSI des letzten Kurses, 0–100. `null`, wenn die Reihe zu kurz ist.
 *
 * Die Glättung setzt bewusst auf den letzten `period * 3` Änderungen auf, nicht
 * auf der ganzen Reihe: So hängt der Wert nicht davon ab, wie viel Historie
 * gerade geladen wurde.
 */
export function rsiWilder(prices: number[], period: number = 14): number | null {
  if (prices.length < period + 1) return null;

  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) changes.push(prices[i] - prices[i - 1]);

  const relevant = changes.slice(-period * 3);
  if (relevant.length < period) return null;

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (relevant[i] > 0) avgGain += relevant[i];
    else avgLoss += Math.abs(relevant[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = period; i < relevant.length; i++) {
    const c = relevant[i];
    if (c > 0) {
      avgGain = (avgGain * (period - 1) + c) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(c)) / period;
    }
  }

  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}
