/**
 * Charakterisierungstest-Fixtures (Artefakt B, siehe CHARACTERIZATION_TESTS.md)
 *
 * Deterministische Szenarien 1–10, 13 und 16. Alle Engines (CT-1 … CT-7) werden
 * aus DIESEN Daten gespeist, damit Diskrepanzen zwischen den Engines sichtbar werden.
 *
 * Keine DB, keine Live-APIs, kein Date.now()/Zufall — feste Daten in 2025.
 * Tests, die Code mit `new Date()` treffen (buildValuePoints), fixieren die
 * Systemzeit auf FIXED_NOW via vi.setSystemTime.
 */

import type { PortfolioTransaction } from "../../drizzle/schema";

// ─────────────────────────────────────────────────────────────────────────────
// Feste Daten (Mo 2025-03-03 … Fr 2025-03-07, Handelswoche)
// ─────────────────────────────────────────────────────────────────────────────

export const D = {
  mar03: "2025-03-03",
  mar04: "2025-03-04",
  mar05: "2025-03-05",
  mar06: "2025-03-06",
  mar07: "2025-03-07",
} as const;

export const TRADING_DATES = [D.mar03, D.mar04, D.mar05, D.mar06, D.mar07];

/** Fixe "Jetzt"-Zeit für vi.setSystemTime (buildValuePoints hängt "heute" an). */
export const FIXED_NOW = new Date("2025-12-31T12:00:00Z");
export const TODAY_STR = "2025-12-31"; // FIXED_NOW.toISOString().split('T')[0]

// ─────────────────────────────────────────────────────────────────────────────
// Transaktions-Factory (volle PortfolioTransaction-Zeilen wie aus Drizzle)
// ─────────────────────────────────────────────────────────────────────────────

const CREATED_AT = new Date("2025-01-01T00:00:00Z");

export function makeTx(o: {
  id: number;
  transactionType: "buy" | "sell" | "dividend" | "deposit" | "withdrawal" | "entry";
  date: string; // YYYY-MM-DD (wird als 10:00Z gespeichert — TZ-sicher)
  ticker?: string | null;
  shares?: string | null;
  pricePerShare?: string | null;
  currency?: string;
  totalAmount: string;
  fxRate?: string | null;
  totalAmountCHF?: string | null;
  fees?: string;
}): PortfolioTransaction {
  return {
    id: o.id,
    portfolioId: 1,
    transactionType: o.transactionType,
    ticker: o.ticker ?? null,
    shares: o.shares ?? null,
    pricePerShare: o.pricePerShare ?? null,
    currency: o.currency ?? "CHF",
    totalAmount: o.totalAmount,
    fxRate: o.fxRate ?? null,
    totalAmountCHF: o.totalAmountCHF ?? null,
    fees: o.fees ?? "0",
    notes: null,
    transactionDate: new Date(`${o.date}T10:00:00Z`),
    createdAt: CREATED_AT,
  };
}

/** Preishistorie-Zeile wie aus `historicalPrices` (nur die von den Engines gelesenen Felder). */
export interface PriceRow {
  ticker: string;
  date: string;
  close: string;
  /** Split-bereinigter Kurs (R-11); fehlt → Engines fallen auf close zurück. */
  adjustedClose?: string;
}

export function toPriceMap(rows: PriceRow[]): Map<string, Map<string, number>> {
  const map = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!map.has(r.ticker)) map.set(r.ticker, new Map());
    map.get(r.ticker)!.set(r.date, parseFloat(r.close));
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// Szenario 1 — Nur-Kauf-Portfolio, eine Position, keine FX
// Deposit 9'500 + Kauf 100 NESN @95 am 03.03.; Kurs steigt bis 100 am 07.03.
// ─────────────────────────────────────────────────────────────────────────────

export const S1 = {
  transactions: [
    makeTx({ id: 101, transactionType: "deposit", date: D.mar03, totalAmount: "9500", totalAmountCHF: "9500" }),
    makeTx({
      id: 102, transactionType: "buy", date: D.mar03, ticker: "NESN",
      shares: "100", pricePerShare: "95", totalAmount: "9500", totalAmountCHF: "9500",
    }),
  ],
  currentPrices: new Map([["NESN", 100]]),
  priceRows: [
    { ticker: "NESN", date: D.mar03, close: "95" },
    { ticker: "NESN", date: D.mar04, close: "96" },
    { ticker: "NESN", date: D.mar05, close: "97" },
    { ticker: "NESN", date: D.mar06, close: "99" },
    { ticker: "NESN", date: D.mar07, close: "100" },
  ] as PriceRow[],
  stocksMeta: new Map([["NESN", { ticker: "NESN", currency: "CHF" }]]),
  /** Handgeführte Tagesbewertungen (Aktienwert, Cash = 0) für CT-2/CT-3. */
  valuations: [
    { date: D.mar03, marketValue: 9500 },
    { date: D.mar04, marketValue: 9600 },
    { date: D.mar05, marketValue: 9700 },
    { date: D.mar06, marketValue: 9900 },
    { date: D.mar07, marketValue: 10000 },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Szenario 2 — Auszahlung CHF 10'000, NEGATIV gespeichert (wie TransactionModal)
// Deposit 20'000 + Kauf 9'500 am 03.03.; Withdrawal totalAmountCHF = "-10000" am 05.03.
// Pinnt den Vorzeichenfehler R-01 in allen Konsumenten.
// ─────────────────────────────────────────────────────────────────────────────

export const S2 = {
  transactions: [
    makeTx({ id: 201, transactionType: "deposit", date: D.mar03, totalAmount: "20000", totalAmountCHF: "20000" }),
    makeTx({
      id: 202, transactionType: "buy", date: D.mar03, ticker: "NESN",
      shares: "100", pricePerShare: "95", totalAmount: "9500", totalAmountCHF: "9500",
    }),
    // TransactionModal.tsx:179–181 speichert Withdrawals negativ:
    makeTx({ id: 203, transactionType: "withdrawal", date: D.mar05, totalAmount: "-10000", totalAmountCHF: "-10000" }),
  ],
  currentPrices: new Map([["NESN", 100]]),
  priceRows: S1.priceRows,
  stocksMeta: S1.stocksMeta,
  /**
   * Handgeführte, fachlich KORREKTE Bewertungen (Aktien + Cash) für CT-2:
   * Cash: 20'000 − 9'500 = 10'500; nach Entnahme am 05.03.: 500.
   */
  valuations: [
    { date: D.mar03, marketValue: 9500 + 10500 },  // 20000
    { date: D.mar04, marketValue: 9600 + 10500 },  // 20100
    { date: D.mar05, marketValue: 9700 + 500 },    // 10200 (nach Entnahme)
    { date: D.mar06, marketValue: 9900 + 500 },    // 10400
    { date: D.mar07, marketValue: 10000 + 500 },   // 10500
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Szenario 3 — Kauf mit Fees: «manuell» (TransactionModal) vs «CSV»
// Kauf 100 @95, Fees 50.
// vorher (R-02): der manuelle Pfad speicherte totalAmount(CHF) = "9550"
// (Fees eingerechnet) → pfadabhängige Kostenbasis. Seit dem R-02-Fix speichert
// TransactionModal brutto EXKL. Fees ("9500", identisch zum CSV-Pfad);
// Bestandsdaten werden via scripts/migrate-fee-semantics.ts migriert.
// Beide Pfade müssen jetzt zur identischen Kostenbasis konvergieren.
// ─────────────────────────────────────────────────────────────────────────────

export const S3_MANUAL = {
  transactions: [
    makeTx({
      id: 301, transactionType: "buy", date: D.mar03, ticker: "NESN",
      shares: "100", pricePerShare: "95", totalAmount: "9500", totalAmountCHF: "9500", fees: "50",
    }),
  ],
  currentPrices: new Map([["NESN", 100]]),
};

export const S3_CSV = {
  transactions: [
    makeTx({
      id: 311, transactionType: "buy", date: D.mar03, ticker: "NESN",
      shares: "100", pricePerShare: "95", totalAmount: "9500", totalAmountCHF: "9500", fees: "50",
    }),
  ],
  currentPrices: new Map([["NESN", 100]]),
};

// ─────────────────────────────────────────────────────────────────────────────
// Szenario 4 — Mehrfach-Verkauf (Kauf 100@10 → Verkauf 100@20 → Kauf 100@30 → Verkauf 100@30)
// Primär für CT-5 (db.ts, hier nicht testbar); CT-6 pinnt den Holdings-Endzustand.
// ─────────────────────────────────────────────────────────────────────────────

export const S4 = {
  transactions: [
    makeTx({ id: 401, transactionType: "buy", date: "2025-01-10", ticker: "MULTI", shares: "100", pricePerShare: "10", totalAmount: "1000", totalAmountCHF: "1000" }),
    makeTx({ id: 402, transactionType: "sell", date: "2025-02-10", ticker: "MULTI", shares: "100", pricePerShare: "20", totalAmount: "2000", totalAmountCHF: "2000" }),
    makeTx({ id: 403, transactionType: "buy", date: "2025-03-10", ticker: "MULTI", shares: "100", pricePerShare: "30", totalAmount: "3000", totalAmountCHF: "3000" }),
    makeTx({ id: 404, transactionType: "sell", date: "2025-04-10", ticker: "MULTI", shares: "100", pricePerShare: "30", totalAmount: "3000", totalAmountCHF: "3000" }),
  ],
  currentPrices: new Map([["MULTI", 30]]),
};

// ─────────────────────────────────────────────────────────────────────────────
// Szenario 5 — Dividende CHF 100 auf gehaltene Position
// Pinnt R-05: performanceCalculations bestraft Dividenden (externer Flow),
// performanceEngine behandelt sie intern (kein externer Flow).
// ─────────────────────────────────────────────────────────────────────────────

export const S5 = {
  transactions: [
    makeTx({ id: 501, transactionType: "deposit", date: D.mar03, totalAmount: "9500", totalAmountCHF: "9500" }),
    makeTx({
      id: 502, transactionType: "buy", date: D.mar03, ticker: "NESN",
      shares: "100", pricePerShare: "95", totalAmount: "9500", totalAmountCHF: "9500",
    }),
    makeTx({ id: 503, transactionType: "dividend", date: D.mar05, ticker: "NESN", totalAmount: "100", totalAmountCHF: "100" }),
  ],
  currentPrices: new Map([["NESN", 100]]),
  priceRows: S1.priceRows,
  stocksMeta: S1.stocksMeta,
};

// ─────────────────────────────────────────────────────────────────────────────
// Szenario 6 — USD-Position OHNE FX-Rate am Stichtag (pinnt 1.0-Fallback, R-10)
// Kauf 10 AAPL @200 USD; totalAmountCHF fehlt (null) → Konsumenten fallen auf
// den Lokalbetrag zurück (R-15) bzw. FX-Konversion fällt auf 1.0 (R-10).
// ─────────────────────────────────────────────────────────────────────────────

export const S6 = {
  transactions: [
    makeTx({
      id: 601, transactionType: "buy", date: D.mar03, ticker: "AAPL", currency: "USD",
      shares: "10", pricePerShare: "200", totalAmount: "2000", totalAmountCHF: null, fxRate: null,
    }),
  ],
  currentPrices: new Map([["AAPL", 210]]), // USD-Kurs — Engines behandeln ihn als CHF
  priceRows: [
    { ticker: "AAPL", date: D.mar03, close: "200" },
    { ticker: "AAPL", date: D.mar05, close: "205" },
    { ticker: "AAPL", date: D.mar07, close: "210" },
  ] as PriceRow[],
  stocksMeta: new Map([["AAPL", { ticker: "AAPL", currency: "USD" }]]),
  fxRates: [] as Array<{ date: string; currencyPair: string; rate: string }>, // keine Raten vorhanden
};

// ─────────────────────────────────────────────────────────────────────────────
// Szenario 7 — USD-Position MIT FX-Rate (Konversion Transaktions- vs. Bewertungsdatum)
// USDCHF: 03.03. = 0.88, 05.03. = 0.90, 07.03. = 0.92 (04./06.03. fehlen bewusst
// → Rückwärtssuche). totalAmountCHF korrekt konvertiert (2000 × 0.88 = 1760).
// ─────────────────────────────────────────────────────────────────────────────

export const FX_RATES = [
  { date: D.mar03, currencyPair: "USDCHF", rate: "0.88" },
  { date: D.mar05, currencyPair: "USDCHF", rate: "0.90" },
  { date: D.mar07, currencyPair: "USDCHF", rate: "0.92" },
  { date: D.mar03, currencyPair: "EURCHF", rate: "0.95" },
];

/** Lookup wie ihn der fxHelper-Cache hält: `${date}:${pair}` → rate */
export const FX_LOOKUP = new Map(FX_RATES.map((r) => [`${r.date}:${r.currencyPair}`, parseFloat(r.rate)]));

export const S7 = {
  transactions: [
    makeTx({
      id: 701, transactionType: "buy", date: D.mar03, ticker: "AAPL", currency: "USD",
      shares: "10", pricePerShare: "200", totalAmount: "2000", fxRate: "0.88", totalAmountCHF: "1760",
    }),
  ],
  currentPrices: new Map([["AAPL", 210]]),
  priceRows: S6.priceRows,
  stocksMeta: S6.stocksMeta,
  fxRates: FX_RATES,
};

// ─────────────────────────────────────────────────────────────────────────────
// Szenario 8 — Kurs bewegt sich zwischen zwei Stichtagen (pinnt R-04)
// Kauf 100 @50 am 03.03.; Kurs steigt bis 80 am 07.03. buildValuePoints bewertet
// den VERGANGENEN Stichtag 03.03. mit dem heutigen Kurs 80 (Ist, falsch);
// performanceService nutzt den historischen Kurs 50 (Soll).
// ─────────────────────────────────────────────────────────────────────────────

export const S8 = {
  transactions: [
    makeTx({ id: 801, transactionType: "deposit", date: D.mar03, totalAmount: "5000", totalAmountCHF: "5000" }),
    makeTx({
      id: 802, transactionType: "buy", date: D.mar03, ticker: "MOVE",
      shares: "100", pricePerShare: "50", totalAmount: "5000", totalAmountCHF: "5000",
    }),
    makeTx({ id: 803, transactionType: "deposit", date: D.mar05, totalAmount: "1000", totalAmountCHF: "1000" }),
  ],
  currentPrices: new Map([["MOVE", 80]]),
  priceRows: [
    { ticker: "MOVE", date: D.mar03, close: "50" },
    { ticker: "MOVE", date: D.mar04, close: "55" },
    { ticker: "MOVE", date: D.mar05, close: "60" },
    { ticker: "MOVE", date: D.mar06, close: "70" },
    { ticker: "MOVE", date: D.mar07, close: "80" },
  ] as PriceRow[],
  stocksMeta: new Map([["MOVE", { ticker: "MOVE", currency: "CHF" }]]),
};

// ─────────────────────────────────────────────────────────────────────────────
// Szenario 9 — Leeres Portfolio / Einzelposition ohne Preis / Division-durch-null
// ─────────────────────────────────────────────────────────────────────────────

export const S9_EMPTY = {
  transactions: [] as PortfolioTransaction[],
  currentPrices: new Map<string, number>(),
};

/** Nur ein Deposit, keine Titel (allTickers leer → emptyResult-Pfad). */
export const S9_DEPOSIT_ONLY = {
  transactions: [
    makeTx({ id: 901, transactionType: "deposit", date: D.mar03, totalAmount: "10000", totalAmountCHF: "10000" }),
  ],
  currentPrices: new Map<string, number>(),
};

/** Kauf eines Titels, für den KEIN aktueller Kurs existiert (Preis-Lookup → 0). */
export const S9_NO_PRICE = {
  transactions: [
    makeTx({
      id: 911, transactionType: "buy", date: D.mar03, ticker: "NOPRICE",
      shares: "10", pricePerShare: "100", totalAmount: "1000", totalAmountCHF: "1000",
    }),
  ],
  currentPrices: new Map<string, number>(), // kein Kurs vorhanden
};

// ─────────────────────────────────────────────────────────────────────────────
// Szenario 10 — Oversell: Verkauf 150 bei Bestand 100 (pinnt R-20)
// ─────────────────────────────────────────────────────────────────────────────

export const S10 = {
  transactions: [
    makeTx({ id: 1001, transactionType: "buy", date: D.mar03, ticker: "OVER", shares: "100", pricePerShare: "10", totalAmount: "1000", totalAmountCHF: "1000" }),
    makeTx({ id: 1002, transactionType: "sell", date: D.mar05, ticker: "OVER", shares: "150", pricePerShare: "12", totalAmount: "1800", totalAmountCHF: "1800" }),
  ],
  currentPrices: new Map([["OVER", 12]]),
  priceRows: [
    { ticker: "OVER", date: D.mar03, close: "10" },
    { ticker: "OVER", date: D.mar04, close: "11" },
    { ticker: "OVER", date: D.mar05, close: "12" },
    { ticker: "OVER", date: D.mar06, close: "12" },
    { ticker: "OVER", date: D.mar07, close: "12" },
  ] as PriceRow[],
  stocksMeta: new Map([["OVER", { ticker: "OVER", currency: "CHF" }]]),
};

// ─────────────────────────────────────────────────────────────────────────────
// Szenario 13 — Crash-Tag: −20 % passiert die Engine, −60 % wird bei ±50 % gekappt
// (R-08: ±50-%-Cap in performanceEngine.calculateTTWROR:171)
// ─────────────────────────────────────────────────────────────────────────────

export const S13_CRASH20 = {
  valuations: [
    { date: D.mar03, marketValue: 100000 },
    { date: D.mar04, marketValue: 80000 }, // −20 %
    { date: D.mar05, marketValue: 82000 },
  ],
};

export const S13_CRASH60 = {
  valuations: [
    { date: D.mar03, marketValue: 100000 },
    { date: D.mar04, marketValue: 40000 }, // −60 % → Cap greift
    { date: D.mar05, marketValue: 41000 },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Szenario 16 — Transaktionsreihenfolge DESC vs. ASC als Input
// Kauf 100 @10 am 03.03., Verkauf 50 @12 am 05.03. — identische Daten,
// einmal ASC (chronologisch), einmal DESC (wie batchGetPortfolioTransactions).
// Pinnt die Sortier-Abhängigkeit von calculateHoldingsPerformance (R-06-Klasse).
// ─────────────────────────────────────────────────────────────────────────────

const S16_BUY = makeTx({ id: 1601, transactionType: "buy", date: D.mar03, ticker: "ORD", shares: "100", pricePerShare: "10", totalAmount: "1000", totalAmountCHF: "1000" });
const S16_SELL = makeTx({ id: 1602, transactionType: "sell", date: D.mar05, ticker: "ORD", shares: "50", pricePerShare: "12", totalAmount: "600", totalAmountCHF: "600" });

export const S16 = {
  asc: [S16_BUY, S16_SELL],
  desc: [S16_SELL, S16_BUY],
  currentPrices: new Map([["ORD", 12]]),
};

// ─────────────────────────────────────────────────────────────────────────────
// Szenario 11 — Split-artiger Kurssprung: −51 % über Nacht (2:1-Split-Fixture)
// Für CT-8 (getRealTwrSeriesFromTransactions).
// vorher (R-08): Preissprünge > 50 % wurden verworfen und forward-gefüllt —
// der Split wurde für immer falsch bewertet. Jetzt wird der Sprung vertraut;
// ohne adjustedClose (R-11) zeigt die Serie den rohen −51-%-Einbruch.
// ─────────────────────────────────────────────────────────────────────────────

export const S11 = {
  initialHoldings: { SPLT: 100 } as Record<string, number>,
  initialCash: 0,
  priceRows: [
    { ticker: "SPLT", date: D.mar03, close: "100" },
    { ticker: "SPLT", date: D.mar04, close: "49" },   // −51 % (Split-Tag)
    { ticker: "SPLT", date: D.mar05, close: "49.5" },
  ] as PriceRow[],
  stockRow: { ticker: "SPLT", currency: "CHF" },
};

/**
 * Szenario 11 (adjustiert) — dieselbe 2:1-Split-Woche, aber mit befülltem
 * adjustedClose (divergent zum rohen close am Vor-Split-Tag). Pinnt den
 * R-11-Switch: Renditeserien lesen adjustedClose ?? close, der Split-Sprung
 * verschwindet aus der Serie.
 */
export const S11_ADJ = {
  initialHoldings: { SPLT: 100 } as Record<string, number>,
  initialCash: 0,
  priceRows: [
    { ticker: "SPLT", date: D.mar03, close: "100", adjustedClose: "50" }, // roh 100, split-bereinigt 50
    { ticker: "SPLT", date: D.mar04, close: "49", adjustedClose: "49" },  // Split-Tag: −2 % real
    { ticker: "SPLT", date: D.mar05, close: "49.5", adjustedClose: "49.5" },
  ] as PriceRow[],
  stockRow: { ticker: "SPLT", currency: "CHF" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Szenario 13 (TWR-Variante) — Crash-Tag −20 % als Preisreihe für CT-8
// vorher (R-08): −20 % passierte den 50-%-Preisfilter, wurde aber vom
// ±15-%-Smoothing gekappt. Jetzt passiert der Crash-Tag ungekappt.
// ─────────────────────────────────────────────────────────────────────────────

export const S13_TWR = {
  initialHoldings: { CRSH: 100 } as Record<string, number>,
  initialCash: 0,
  priceRows: [
    { ticker: "CRSH", date: D.mar03, close: "1000" },
    { ticker: "CRSH", date: D.mar04, close: "800" }, // −20 %
    { ticker: "CRSH", date: D.mar05, close: "820" }, // +2.5 %
  ] as PriceRow[],
  stockRow: { ticker: "CRSH", currency: "CHF" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Szenario 15 — Verkauf mit zwei früheren Käufen zu unterschiedlichen FX-Kursen
// Für CT-5 (db.ts Verkaufs-Zweig): seit dem R-19-Fix kostengewichteter FX-Split
// aus den gespeicherten fxRate-Spalten (vorher: Datum des ERSTEN Kaufs);
// realizedGainPercent bleibt in Lokalwährung (R-24 offen).
// Kauf 100@10 USD am 03.03. (Rate 0.88), Kauf 100@20 USD am 05.03. (Rate 0.90),
// Verkauf 200@20 USD am 07.03. (Rate 0.92).
// ─────────────────────────────────────────────────────────────────────────────

export const S15 = {
  buys: [
    makeTx({
      id: 1511, transactionType: "buy", date: D.mar03, ticker: "USTIT", currency: "USD",
      shares: "100", pricePerShare: "10", totalAmount: "1000", fxRate: "0.88", totalAmountCHF: "880",
    }),
    makeTx({
      id: 1512, transactionType: "buy", date: D.mar05, ticker: "USTIT", currency: "USD",
      shares: "100", pricePerShare: "20", totalAmount: "2000", fxRate: "0.90", totalAmountCHF: "1800",
    }),
  ],
  sell: makeTx({
    id: 1513, transactionType: "sell", date: D.mar07, ticker: "USTIT", currency: "USD",
    shares: "200", pricePerShare: "20", totalAmount: "4000", fxRate: "0.92", totalAmountCHF: "3680",
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Szenario 19 — DCF-Referenzfall: stabiler CHF-Titel für CT-15 (R-32)
// FCF-Yield 5 % (FCF 5 Mio auf MarketCap 100 Mio), Wachstum 4 %, Beta 0.8.
// Als Yahoo-quoteSummary-Fixture (EODHD-Pfad ist ohne API-Key deaktiviert).
// ─────────────────────────────────────────────────────────────────────────────

export const S19 = {
  quoteSummary: {
    financialData: {
      currentPrice: 100,
      freeCashflow: 5_000_000,
      revenueGrowth: 0.04,
      currency: "CHF",
    },
    defaultKeyStatistics: { sharesOutstanding: 1_000_000, beta: 0.8 },
    summaryDetail: {},
    quoteType: { longName: "Stabil AG" },
  },
};
