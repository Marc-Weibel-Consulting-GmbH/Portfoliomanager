/**
 * CT-4 — Charakterisierungstests für die End-to-End-Pipeline
 * calculatePortfolioPerformance (server/lib/performanceService.ts) sowie die
 * puren Bausteine buildHoldingsTimeline / buildDailyValuations
 * (server/lib/performanceEngine.ts). buildCashTimeline ist nicht exportiert
 * und wird indirekt über die Pipeline gepinnt.
 *
 * Nur die DATENLADE-Imports sind gemockt (db, db-optimized, fxHelper) und
 * liefern die Fixture-Daten; der gesamte Berechnungscode läuft real.
 * Erwartungswerte wurden durch AUSFÜHREN des aktuellen Codes ermittelt.
 *
 * Nicht im Plan erfasster, hier dokumentierter Befund (relevant für D-01):
 * Eine Einlage am ERSTEN Handelstag steckt sowohl im MVB (erste
 * Tagesbewertung) als auch in den IRR-Cashflows → Doppelzählung; die IRR
 * kollabiert in Szenario 1/8 auf den Clamp −0.99 mit converged=false, und
 * totalInvestedCHF zählt die Einlage doppelt (mvb + Flow).
 */

import { describe, it, expect, vi } from "vitest";
import {
  buildHoldingsTimeline,
  buildDailyValuations,
} from "../lib/performanceEngine";
import { calculatePortfolioPerformance } from "../lib/performanceService";
import {
  S1, S2, S3_MANUAL, S3_CSV, S6, S7, S8, S9_EMPTY, S9_DEPOSIT_ONLY, S10, S16,
  D, TRADING_DATES, toPriceMap,
  type PriceRow,
} from "./fixtures";
import type { PortfolioTransaction } from "../../drizzle/schema";

// ─── Mocks: NUR Datenladung (Fixture-Daten), keine Berechnungslogik ─────────

const h = vi.hoisted(() => ({
  transactions: [] as unknown[],
  priceRows: [] as Array<{ ticker: string; date: string; close: string }>,
  stocksMeta: new Map<string, { ticker: string; currency: string }>(),
  fxLookup: new Map<string, number>(),
}));

vi.mock("../db", () => ({
  getDb: async () => ({
    // `await db.select().from(historicalPrices).where(...)` → Fixture-Zeilen
    // (alle Fixture-Preise liegen innerhalb des abgefragten Fensters).
    select: () => ({ from: () => ({ where: async () => h.priceRows }) }),
  }),
  getPortfolioTransactions: async () => h.transactions,
  getSavedPortfolioById: async () => ({ id: 1 }),
}));

vi.mock("../db-optimized", () => ({
  batchGetStocks: async () => h.stocksMeta,
}));

vi.mock("../fxHelper", () => ({
  // Emuliert convertToCHF inkl. des stillen 1.0-Fallbacks (R-10) auf Basis
  // der Fixture-Raten — gleiche Datenbasis wie CT-7.
  convertToCHF: async (amount: number, currency: string, date: string) => {
    if (currency === "CHF") return amount;
    const rate = h.fxLookup.get(`${date}:${currency}CHF`);
    return amount * (rate ?? 1.0);
  },
}));

function loadScenario(s: {
  transactions: PortfolioTransaction[];
  priceRows?: PriceRow[];
  stocksMeta?: Map<string, { ticker: string; currency: string }>;
  fxRates?: Array<{ date: string; currencyPair: string; rate: string }>;
}) {
  h.transactions = s.transactions;
  h.priceRows = s.priceRows ?? [];
  h.stocksMeta = s.stocksMeta ?? new Map();
  h.fxLookup = new Map((s.fxRates ?? []).map((r) => [`${r.date}:${r.currencyPair}`, parseFloat(r.rate)]));
}

const WEEK = { portfolioId: 1, startDate: D.mar03, endDate: D.mar07 };

async function run(s: Parameters<typeof loadScenario>[0]) {
  loadScenario(s);
  return calculatePortfolioPerformance(WEEK);
}

// ─── Pure Bausteine (performanceEngine) ─────────────────────────────────────

describe("CT-4 buildHoldingsTimeline", () => {
  it("Szenario 1: konstante 100 NESN über alle Handelstage", () => {
    const timeline = buildHoldingsTimeline(S1.transactions, TRADING_DATES);
    const nesn = timeline.get("NESN")!;
    for (const date of TRADING_DATES) {
      expect(nesn.get(date)).toBe(100);
    }
  });

  it("Szenario 16: DESC- und ASC-Input liefern identische Timelines (reihenfolge-unabhängig)", () => {
    // Im Gegensatz zu calculateHoldingsPerformance (CT-6, R-06-Klasse) ist
    // buildHoldingsTimeline datums-gebuckelt und damit sortierunabhängig.
    const asc = buildHoldingsTimeline(S16.asc, TRADING_DATES);
    const desc = buildHoldingsTimeline(S16.desc, TRADING_DATES);
    expect(desc.get("ORD")).toEqual(asc.get("ORD"));
    expect(Array.from(asc.get("ORD")!.entries())).toEqual([
      [D.mar03, 100],
      [D.mar04, 100],
      [D.mar05, 50],
      [D.mar06, 50],
      [D.mar07, 50],
    ]);
  });
});

describe("CT-4 buildDailyValuations", () => {
  it("Szenario 8-Klasse: nutzt HISTORISCHE Kurse (Kontrast zu buildValuePoints, R-04)", () => {
    const valuations = buildDailyValuations(
      buildHoldingsTimeline(S1.transactions, TRADING_DATES),
      toPriceMap(S1.priceRows),
      new Map(),
      TRADING_DATES
    );
    // Soll-Verhalten: 95→100 Tag für Tag — genau das, was buildValuePoints
    // (CT-1, R-04) NICHT tut.
    expect(valuations).toEqual([
      { date: D.mar03, marketValue: 9500 },
      { date: D.mar04, marketValue: 9600 },
      { date: D.mar05, marketValue: 9700 },
      { date: D.mar06, marketValue: 9900 },
      { date: D.mar07, marketValue: 10000 },
    ]);
  });

  it("Szenario 10: Oversell → Short-Bestand wird als Wert 0 behandelt (R-20)", () => {
    const valuations = buildDailyValuations(
      buildHoldingsTimeline(S10.transactions, TRADING_DATES),
      toPriceMap(S10.priceRows),
      new Map(),
      TRADING_DATES
    );
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-20:
    // Nach Verkauf 150/100 ist der Bestand −50; `shares <= 0 → continue`
    // bewertet die Short-Position mit 0 statt −600.
    expect(valuations).toEqual([
      { date: D.mar03, marketValue: 1000 },
      { date: D.mar04, marketValue: 1100 },
      { date: D.mar05, marketValue: 0 },
      { date: D.mar06, marketValue: 0 },
      { date: D.mar07, marketValue: 0 },
    ]);
  });
});

// ─── End-to-End-Pipeline (calculatePortfolioPerformance) ────────────────────

describe("CT-4 calculatePortfolioPerformance", () => {
  it("Szenario 1: TTWROR korrekt aus historischen Kursen; IRR kollabiert (Einlage doppelt)", async () => {
    const r = await run(S1);
    // TTWROR nutzt historische Kurse — Kontrast zu CT-1 (R-04):
    expect(r.ttwror.totalReturn).toBeCloseTo(0.05263157894736836, 10);
    expect(r.ttwror.periodDays).toBe(4);
    expect(r.currentValueCHF).toBe(10000);
    // ISTZUSTAND — fragwürdig, nicht explizit im OPTIMIZATION_PLAN erfasst
    // (dokumentiert für Konsolidierungsentscheid D-01): die Einlage vom ersten
    // Handelstag steckt im MVB (9'500) UND in den IRR-Flows (9'500) →
    // totalInvestedCHF = 19'000 doppelt gezählt, absoluteGainCHF = −9'000,
    // IRR-Gleichung unlösbar → Clamp −0.99 mit converged=false.
    expect(r.totalInvestedCHF).toBe(19000);
    expect(r.absoluteGainCHF).toBe(-9000);
    expect(r.irr.annualizedIRR).toBe(-0.99);
    expect(r.irr.converged).toBe(false);
    expect(r.irr.iterations).toBe(100);
    expect(r.dailySeries).toEqual([
      { date: D.mar03, cumulativeReturn: 0 },
      { date: D.mar04, cumulativeReturn: 0.010526315789473717 },
      { date: D.mar05, cumulativeReturn: 0.021052631578947434 },
      { date: D.mar06, cumulativeReturn: 0.042105263157894646 },
      { date: D.mar07, cumulativeReturn: 0.05263157894736836 },
    ]);
  });

  it("Szenario 2: negative Entnahme ERHÖHT Cash-Timeline und totalInvested (R-01)", async () => {
    const r = await run(S2);
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-01:
    // buildCashTimeline rechnet -(−10'000) = +10'000 → Cash steigt auf 20'500,
    // currentValueCHF = 10'000 Aktien + 20'500 Cash = 30'500 (korrekt: 10'500).
    expect(r.currentValueCHF).toBe(30500);
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-01:
    // totalInvested = 20'000 (Deposit) + 10'000 (sign-geflippte Entnahme als
    // Inflow) + 20'000 (MVB, inkl. Deposit-Doppelzählung) = 50'000.
    expect(r.totalInvestedCHF).toBe(50000);
    expect(r.absoluteGainCHF).toBe(-19500);
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-01:
    // Die beiden Vorzeichenfehler (Cash +10'000 und Flow +10'000) heben sich
    // im TTWROR-Tagesnenner fast auf → +1.84 % statt +3.97 % (vgl. CT-2):
    expect(r.ttwror.totalReturn).toBeCloseTo(0.01835548172757462, 10);
    expect(r.ttwror.dailySeries[2]).toEqual({ date: D.mar05, cumulativeReturn: 0.008338870431893408 });
    expect(r.irr.annualizedIRR).toBeCloseTo(2.6462437185243575, 10);
    expect(r.irr.converged).toBe(true);
    expect(r.irr.iterations).toBe(9);
  });

  it("Szenario 3: Fee-Doppelzählung (R-02) wird vom Cash-Clamp (R-20) verschluckt", async () => {
    const manual = await run({ ...S3_MANUAL, priceRows: S1.priceRows, stocksMeta: S1.stocksMeta });
    const csv = await run({ ...S3_CSV, priceRows: S1.priceRows, stocksMeta: S1.stocksMeta });
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-20 (+ R-02):
    // Kauf ohne Deposit → Cash würde −9'600 (manuell) bzw. −9'550 (CSV);
    // buildCashTimeline klemmt negatives Cash auf 0 → beide Pfade liefern
    // IDENTISCHE Bewertungen, die Fee-Differenz aus R-02 ist unsichtbar.
    expect(manual).toEqual(csv);
    expect(manual.ttwror.totalReturn).toBeCloseTo(0.05263157894736836, 10);
    expect(manual.currentValueCHF).toBe(10000);
    // Buy ist kein externer Flow → IRR = Simple Return, totalInvested = MVB:
    expect(manual.totalInvestedCHF).toBe(9500);
    expect(manual.irr.annualizedIRR).toBeCloseTo(0.05263157894736836, 10);
    expect(manual.irr.iterations).toBe(0);
  });

  it("Szenario 6: USD ohne FX-Rate → 1:1-Bewertung als CHF (R-10)", async () => {
    const r = await run(S6);
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-10:
    // Keine USDCHF-Rate vorhanden → USD-Kurse werden 1:1 als CHF bewertet;
    // Endwert «CHF» 2'100 statt 1'932 (mit Rate 0.92).
    expect(r.currentValueCHF).toBe(2100);
    expect(r.totalInvestedCHF).toBe(2000); // R-15: totalAmount (USD) als CHF-MVB-Basis
    expect(r.ttwror.totalReturn).toBeCloseTo(0.04999999999999982, 10);
    // Nur 3 Handelstage (Preiszeilen definieren das Datumsraster):
    expect(r.dailySeries.map((p) => p.date)).toEqual([D.mar03, D.mar05, D.mar07]);
  });

  it("Szenario 7: USD mit FX-Raten → Kurs- UND FX-Bewegung in CHF-Serie", async () => {
    const r = await run(S7);
    // Preise 200/205/210 USD × Raten 0.88/0.90/0.92 → 176/184.5/193.2 CHF/Stk.
    expect(r.currentValueCHF).toBeCloseTo(1932.0000000000002, 10);
    expect(r.totalInvestedCHF).toBe(1760);
    expect(r.absoluteGainCHF).toBeCloseTo(172.00000000000023, 10);
    expect(r.ttwror.totalReturn).toBeCloseTo(0.09772727272727288, 10);
    expect(r.irr.annualizedIRR).toBeCloseTo(0.09772727272727288, 10);
  });

  it("Szenario 8: historische Kurse 50→80 ergeben +52.3 % (Kontrast zu CT-1, R-04)", async () => {
    const r = await run(S8);
    // Soll-Seite des R-04-Diffs: dieselben Transaktionen ergeben in CT-1
    // (buildValuePoints) eine flache 8'000er-Serie mit TWR −12.5 %, hier +52.3 %:
    expect(r.ttwror.totalReturn).toBeCloseTo(0.523076923076923, 10);
    expect(r.currentValueCHF).toBe(9000); // 8'000 Aktien + 1'000 Cash
    // ISTZUSTAND — fragwürdig (Doppelzählung Einlage Tag 1, s. Szenario 1):
    // totalInvested = 5'000 + 1'000 (Deposits) + 5'000 (MVB) = 11'000,
    // IRR unlösbar → −0.99, converged=false.
    expect(r.totalInvestedCHF).toBe(11000);
    expect(r.absoluteGainCHF).toBe(-2000);
    expect(r.irr.annualizedIRR).toBe(-0.99);
    expect(r.irr.converged).toBe(false);
  });

  it("Szenario 9: leeres Portfolio und Nur-Cash-Portfolio → leeres Nullresultat", async () => {
    const empty = await run(S9_EMPTY);
    expect(empty.ttwror.totalReturn).toBe(0);
    expect(empty.currentValueCHF).toBe(0);
    expect(empty.dailySeries).toEqual([]);

    // Ein Portfolio, das NUR aus einer Einlage besteht (keine Ticker), fällt
    // in den emptyResult-Pfad — das Cash wird nicht als Wert ausgewiesen:
    const cashOnly = await run(S9_DEPOSIT_ONLY);
    expect(cashOnly.currentValueCHF).toBe(0);
    expect(cashOnly.totalInvestedCHF).toBe(0);
    expect(cashOnly.dailySeries).toEqual([]);
  });

  it("Szenario 10: Oversell — Short als 0, Erlös bleibt im Cash (R-20)", async () => {
    const r = await run(S10);
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-20:
    // Ab 05.03.: Aktienwert 0 (Short-Bestand −50 ignoriert), Cash = −1'000
    // (Kauf) + 1'800 (Verkaufserlös für 150 Stück) = 800 → Tagesverlust −27.3 %,
    // kumuliert −20 %, obwohl real 100 gekaufte Aktien mit +20 % verkauft wurden.
    expect(r.currentValueCHF).toBe(800);
    expect(r.ttwror.totalReturn).toBeCloseTo(-0.19999999999999996, 10);
    expect(r.ttwror.dailySeries[2]).toEqual({ date: D.mar05, cumulativeReturn: -0.19999999999999996 });
    expect(r.totalInvestedCHF).toBe(1000);
    expect(r.absoluteGainCHF).toBe(-200);
    expect(r.irr.annualizedIRR).toBeCloseTo(-0.19999999999999996, 10);
    expect(r.irr.converged).toBe(true);
  });
});
