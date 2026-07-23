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
  'IOS.DE': 'IOS.XETRA',    // IONOS Group SE
  'ALV.DE': 'ALV.XETRA',    // Allianz SE
  'BAYN.DE': 'BAYN.XETRA',  // Bayer AG
  'DWS.DE': 'DWS.XETRA',    // DWS Group
  'MUV2.DE': 'MUV2.XETRA',  // Munich Re
  'PCZ.DE': 'PCZ.XETRA',    // ProCredit Holding

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
  // PRY.MI (Prysmian) and SRG.MI (Snam) are not available on EODHD — use US ADR or skip
  'PRY.MI': 'PRYMY.US',     // Prysmian → US ADR (PRYMY)
  'SRG.MI': 'SNMRF.US',     // Snam → US OTC (SNMRF)

  // ─── Singapore Exchange (.SI → .SG) ───
  // D05.SI (DBS Group) — EODHD hat kein .SG-Listing; US ADR DBSDY ist verfügbar
  'D05.SI': 'DBSDY.US',     // DBS Group → US ADR (DBSDY)

  // ─── Tokyo Stock Exchange (.T) ───
  // EODHD hat kein .TSE-Exchange — japanische Aktien müssen über Frankfurt (.F) oder US ADR abgerufen werden.
  // Getestete Mappings (Stand Juli 2026):
  '6856.T': '01H.F',      // Horiba Seisakusho → Frankfurt (01H.F) ✅
  '7735.T': 'SCRNY.US',   // Screen Holdings → US ADR (SCRNY) ✅
  '9962.T': 'MSSMY.US',   // Misumi Group → US ADR (MSSMY) ✅
  '7203.T': 'TM',         // Toyota → US ADR (TM)
  '6758.T': 'SONY',       // Sony → US ADR (SONY)
  '9984.T': 'SFTBY.US',   // SoftBank → US ADR (SFTBY)
  '6861.T': 'KYCCF.US',   // Keyence → US OTC (KYCCF)
  '4519.T': 'CHGCY.US',   // Chugai Pharmaceutical → US ADR (CHGCY)
  '8306.T': 'MUFG',       // Mitsubishi UFJ → US ADR (MUFG)
  '6954.T': 'FANUY.US',   // Fanuc → US ADR (FANUY)
  '7267.T': 'HMC',        // Honda → US ADR (HMC)
  '6501.T': 'HTHIY.US',   // Hitachi → US ADR (HTHIY)

  // ─── US / OTC ───
  'MESA': 'RJET',
  'MESA.US': 'RJET',
  'APPLE': 'AAPL',
  // LVMH-ADR direkt als OTC-ADR abrufen (NICHT auf MC.PA 1:1 mappen — der ADR steht in einem
  // anderen Verhältnis zur Pariser Stammaktie, das würde den Positionswert verfälschen).
  'LVMUY': 'LVMUY.US',
  // ─── Commodity ETFs (Gold/Silver/Rohwaren) ───
  // Swisscanto Gold ETF (SIX: CSGLDE.SW)
  'CH0139101601': 'CSGLDE.SW',
  // iShares Physical Gold ETC (SIX: SGLN.SW)
  'IE00B4ND3602': 'SGLN.SW',
  // WisdomTree Physical Gold (SIX: PHAU.SW)
  'JE00B1VS3770': 'PHAU.SW',
  // ZKB Gold ETF (SIX: ZGLD.SW)
  'CH0139101619': 'ZGLD.SW',
  // Invesco Physical Gold ETC (XETRA: SGLD.DE)
  'IE00B579F325': 'SGLD.XETRA',
  // ─── Crypto ETPs/Zertifikate ───
  // Vontobel BTC Certificate (SIX: VBTC.SW)
  'CH0595154060': 'VBTC.SW',
  // 21Shares Bitcoin ETP (SIX: ABTC.SW)
  'CH0454664001': 'ABTC.SW',
  // 21Shares Ethereum ETP (SIX: AETH.SW)
  'CH0454664027': 'AETH.SW',
};

/**
 * Alias-Auflösung: liefert das EODHD-Symbol für einen DB-Ticker. Ist keine Sonderregel
 * hinterlegt, wird der Ticker unverändert zurückgegeben (der Aufrufer behält seine
 * bestehende Suffix-Logik). Endpunkt-agnostisch (gilt für /eod, /div, /real-time).
 */
export function toEodhdSymbol(ticker: string): string {
  if (!ticker) return ticker;
  // Explizite Mappings haben Vorrang
  if (EODHD_TICKER_MAPPING[ticker]) return EODHD_TICKER_MAPPING[ticker];
  // Generische Regel: Japanische Aktien (.T) — EODHD hat kein .TSE-Exchange.
  // Unbekannte .T-Ticker werden als nicht verfügbar behandelt (UNAVAILABLE_TICKERS).
  // Bekannte Ticker sind explizit in EODHD_TICKER_MAPPING oben eingetragen.
  return ticker;
}
