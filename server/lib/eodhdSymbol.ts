/**
 * Zentrale DB-Ticker → EODHD-Symbol-Auflösung.
 *
 * Einige DB-Ticker verwenden ein anderes Format, als EODHD erwartet, oder verweisen nach
 * Corporate Actions auf ein anderes handelbares Symbol. Diese Zuordnung lag bisher NUR im
 * historischen Preis-Import (`jobs/importHistoricalPrices.ts`) und fehlte im Realtime- und
 * Dividenden-Pfad — dort scheiterten Abrufe für MONC.MI/HELN.SW mit HTTP 404 (Log-Spam).
 * Jetzt an einer Stelle, damit alle EODHD-Pfade dasselbe Symbol verwenden.
 *
 * Wichtige Korrekturen:
 * - HELN.SW: Helvetia/Baloise-Merger → handelt als HELNF (US OTC)
 * - MONC.MI: italienische Börse nicht auf EODHD → MONRY (US ADR)
 * - MESA(.US): Mesa Air delisted, Reverse-Split → RJET
 * - APPLE: Nutzer-Tippfehler → AAPL
 */
export const EODHD_TICKER_MAPPING: Record<string, string> = {
  'EXSA.DE': 'EXSA.XETRA',
  'ABB.N': 'ABBN.SW',
  'VWRL.L': 'VWRL.LSE',
  'HELN.SW': 'HELNF',
  'MONC.MI': 'MONRY',
  'MESA': 'RJET',
  'MESA.US': 'RJET',
  'APPLE': 'AAPL',
};

/**
 * Alias-Auflösung: liefert das EODHD-Symbol für einen DB-Ticker. Ist keine Sonderregel
 * hinterlegt, wird der Ticker unverändert zurückgegeben (der Aufrufer behält seine
 * bestehende Suffix-Logik). Endpunkt-agnostisch (gilt für /eod, /div, /real-time).
 */
export function toEodhdSymbol(ticker: string): string {
  if (!ticker) return ticker;
  return EODHD_TICKER_MAPPING[ticker] ?? ticker;
}
