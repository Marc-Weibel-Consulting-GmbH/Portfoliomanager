/**
 * Rest-Modul nach K2 (EIN Signal für Badges & Alerts).
 *
 * Hier lebte die Alert-Heuristik `computeWatchlistSignalScore` (F3, SIG-3) —
 * eine additive Zweitformel für `stocks.signalScore`/`signalType` mit eigener
 * Admin-Konfiguration (alertConfig). Seit K2 werden diese Spalten
 * ausschliesslich aus dem Drei-Score-Signal übernommen
 * (server/lib/kernsignalUebernahme.ts); die Zweitformel und ihre Konfiguration
 * sind entfernt. Die alertConfig-Tabelle und ihre Admin-Seite sind damit ohne
 * Wirkung und werden mit Paket K12 zurückgebaut.
 *
 * Geblieben ist die signal-unabhängige Anzeige-Hilfe calcWilderRSI: Sie
 * ersetzt die H5-fehlerhafte RSI-Variante, die das ÄLTESTE 14-Tage-Fenster
 * eines 30-Tage-Zeitraums mittelte.
 */

/**
 * Wilder-RSI über die LETZTEN `period` Perioden (Standard 14).
 * Liefert null bei zu wenig Daten (braucht period + 1 Schlusskurse).
 */
export function calcWilderRSI(closes: number[], period = 14): number | null {
  if (!Array.isArray(closes) || closes.length < period + 1) return null;
  let avgGain = 0;
  let avgLoss = 0;
  // Initiales Mittel über die ersten `period` Differenzen …
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change; else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;
  // … dann Wilder-Glättung bis zum jüngsten Kurs.
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}
