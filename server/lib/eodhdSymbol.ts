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
  // ─── Swiss Exchange ───
  'ABB.N': 'ABBN.SW',
  'ABB.SW': 'ABBN.SW',      // ABB handelt an der SIX unter ABBN, nicht ABB
  'ROG.SW': 'RO.SW',        // Roche: EODHD führt die Aktie unter RO.SW
  'HELN.SW': 'HBAN.SW',     // Helvetia+Baloise fusioniert → Helvetia Baloise Holding
  'HBHN.SW': 'HBAN.SW',     // Alias für Helvetia Baloise

  // ─── German Exchanges (.DE → .XETRA) ───
  'EXSA.DE': 'EXSA.XETRA',
  'MTX.DE': 'MTX.XETRA',    // MTU Aero Engines
  'XEON.DE': 'XEON.XETRA',  // Xtrackers EUR Overnight Rate Swap

  // ─── London Stock Exchange (.L → .LSE) ───
  'VWRL.L': 'VWRL.LSE',     // Vanguard FTSE All-World
  'BATS.L': 'BATS.LSE',     // British American Tobacco
  'DGE.L': 'DGE.LSE',       // Diageo
  'MNG.L': 'MNG.LSE',       // M&G
  'YCA.L': 'YCA.LSE',       // Yellow Cake

  // ─── Warsaw Stock Exchange (.WA → .WAR) ───
  'GPW.WA': 'GPW.WAR',      // Warsaw Stock Exchange

  // ─── Australian Exchange (.AX → .AU) ───
  'WHC.AX': 'WHC.AU',       // Whitehaven Coal

  // ─── Italian Exchange (.MI → .F Frankfurt proxy, EODHD hat kein .MI) ───
  'ADB.MI': '169.F',        // Aeroporto Guglielmo Marconi di Bologna
  'EQUI.MI': 'SR2.F',       // Equita Group
  'IG.MI': 'I10.F',         // Italgas
  'PST.MI': '7PI.F',        // Poste Italiane
  'MONC.MI': 'MONRY',       // Moncler → US ADR

  // ─── US / OTC ───
  'MESA': 'RJET',
  'MESA.US': 'RJET',
  'APPLE': 'AAPL',
  // LVMH-ADR direkt als OTC-ADR abrufen (NICHT auf MC.PA 1:1 mappen — der ADR steht in einem
  // anderen Verhältnis zur Pariser Stammaktie, das würde den Positionswert verfälschen).
  'LVMUY': 'LVMUY.US',
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
