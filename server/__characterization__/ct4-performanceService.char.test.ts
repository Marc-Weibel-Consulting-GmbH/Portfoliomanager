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
 * Hinweis: Der hier ursprünglich dokumentierte Befund «Einlage am ersten
 * Handelstag doppelt gezählt (MVB + IRR-Flow)» wurde als R-37 in den Plan
 * aufgenommen und ist BEHOBEN — Flows am ersten Bewertungstag zählen nur
 * noch im MVB (siehe performanceService.ts / performanceEngine.ts).
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
  // Emuliert convertToCHF nach dem R-10-Fix: letzte bekannte Rate ≤ 30 Tage
  // rückwärts, sonst 0 (kein stiller 1.0-Fallback mehr) — gleiche Datenbasis
  // wie CT-7.
  convertToCHF: async (amount: number, currency: string, date: string) => {
    if (currency === "CHF") return amount;
    const d = new Date(date);
    for (let i = 0; i <= 30; i++) {
      const rate = h.fxLookup.get(`${d.toISOString().split("T")[0]}:${currency}CHF`);
      if (rate !== undefined) return amount * rate;
      d.setDate(d.getDate() - 1);
    }
    return 0;
  },
  // R-15: performanceService löst fehlende totalAmountCHF via tryGetFxRate
  // (Rate zum Transaktionsdatum) auf. Gleiche Datenbasis, `null` statt 0 bei
  // fehlender Rate — S6 (keine Raten) fällt damit weiter auf den Lokalbetrag
  // zurück, die gepinnten Werte ändern sich nicht.
  tryGetFxRate: async (date: string, currencyPair: string) => {
    if (currencyPair === "CHFCHF") return 1.0;
    const currency = currencyPair.replace(/CHF$/, "");
    const d = new Date(date);
    for (let i = 0; i <= 30; i++) {
      const rate = h.fxLookup.get(`${d.toISOString().split("T")[0]}:${currency}CHF`);
      if (rate !== undefined) return rate;
      d.setDate(d.getDate() - 1);
    }
    return null;
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
  it("Szenario 1: TTWROR korrekt aus historischen Kursen; IRR sauber (R-37 behoben)", async () => {
    const r = await run(S1);
    // TTWROR nutzt historische Kurse — Kontrast zu CT-1 (R-04):
    expect(r.ttwror.totalReturn).toBeCloseTo(0.05263157894736836, 10);
    expect(r.ttwror.periodDays).toBe(4);
    expect(r.currentValueCHF).toBe(10000);
    // vorher (R-37): totalInvestedCHF 19'000, absoluteGainCHF −9'000,
    // IRR-Clamp −0.99 mit converged=false — die Einlage vom ersten Handelstag
    // steckte im MVB (9'500) UND in den IRR-Flows (9'500). Jetzt zählen Flows
    // am ersten Bewertungstag nur im MVB → investiert 9'500, Gewinn +500,
    // IRR = Simple Return +5.26 % (keine Flows, iterations 0).
    expect(r.totalInvestedCHF).toBe(9500);
    expect(r.absoluteGainCHF).toBe(500);
    expect(r.irr.annualizedIRR).toBeCloseTo(0.05263157894736836, 10);
    expect(r.irr.converged).toBe(true);
    expect(r.irr.iterations).toBe(0);
    expect(r.dailySeries).toEqual([
      { date: D.mar03, cumulativeReturn: 0 },
      { date: D.mar04, cumulativeReturn: 0.010526315789473717 },
      { date: D.mar05, cumulativeReturn: 0.021052631578947434 },
      { date: D.mar06, cumulativeReturn: 0.042105263157894646 },
      { date: D.mar07, cumulativeReturn: 0.05263157894736836 },
    ]);
  });

  it("Szenario 2: negative Entnahme senkt Cash-Timeline und totalInvested (R-01 behoben)", async () => {
    const r = await run(S2);
    // vorher (R-01): 30'500 — buildCashTimeline rechnete -(−10'000) = +10'000
    // und Cash stieg auf 20'500. Jetzt senkt die Entnahme das Cash auf 500 →
    // currentValueCHF = 10'000 Aktien + 500 Cash = 10'500 (fachlich korrekt).
    expect(r.currentValueCHF).toBe(10500);
    // vorher (R-01 + R-37): 50'000 — Deposit + sign-geflippte Entnahme als
    // Inflow + MVB (inkl. Deposit-Doppelzählung). Jetzt: MVB 20'000 (Einlage
    // Tag 1 nur im MVB, R-37), Entnahme ist Outflow → totalInvested 20'000.
    expect(r.totalInvestedCHF).toBe(20000);
    // vorher (R-01): −19'500. Jetzt: 10'500 + 10'000 entnommen − 20'000 = +500.
    expect(r.absoluteGainCHF).toBe(500);
    // vorher (R-01): +1.84 % — die beiden Vorzeichenfehler (Cash +10'000 und
    // Flow +10'000) hoben sich im Tagesnenner fast auf. Jetzt +3.97 %
    // (identisch zum Sollwert aus CT-2 mit denselben Bewertungen):
    expect(r.ttwror.totalReturn).toBeCloseTo(0.039705882352941035, 10);
    expect(r.ttwror.dailySeries[2]).toEqual({ date: D.mar05, cumulativeReturn: 0.010000000000000009 });
    // vorher (R-01): 2.6462437185243575, converged=true, iterations 9 — die
    // «konvergierte» IRR beruhte auf dem falschen +10'000-Inflow. Jetzt ist die
    // echte 4-Tage-IRR (~+2.66 % periodisch) annualisiert jenseits des
    // 1'000-%-Clamps → Newton klemmt bei 10, Bisektion kann nicht einklammern.
    // ISTZUSTAND — bekannt falsch, R-16/R-25-Klasse (Annualisierung/Clamp offen):
    expect(r.irr.annualizedIRR).toBe(10);
    expect(r.irr.converged).toBe(false);
    expect(r.irr.iterations).toBe(100);
  });

  it("Szenario 3: Fee-Doppelzählung (R-02) wird vom Cash-Clamp (R-20) verschluckt", async () => {
    const manual = await run({ ...S3_MANUAL, priceRows: S1.priceRows, stocksMeta: S1.stocksMeta });
    const csv = await run({ ...S3_CSV, priceRows: S1.priceRows, stocksMeta: S1.stocksMeta });
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-20:
    // Kauf ohne Deposit → Cash würde −9'550 (Brutto + Fees, beide Pfade —
    // seit dem R-02-Fix speichern manuell und CSV identisch brutto exkl. Fees);
    // buildCashTimeline klemmt negatives Cash auf 0 → identische Bewertungen.
    expect(manual).toEqual(csv);
    expect(manual.ttwror.totalReturn).toBeCloseTo(0.05263157894736836, 10);
    expect(manual.currentValueCHF).toBe(10000);
    // Buy ist kein externer Flow → IRR = Simple Return, totalInvested = MVB:
    expect(manual.totalInvestedCHF).toBe(9500);
    expect(manual.irr.annualizedIRR).toBeCloseTo(0.05263157894736836, 10);
    expect(manual.irr.iterations).toBe(0);
  });

  it("Szenario 6: USD ohne FX-Rate → Position mit 0 bewertet, nicht 1:1 (R-10 behoben)", async () => {
    const r = await run(S6);
    // vorher (R-10): keine USDCHF-Rate vorhanden → USD-Kurse wurden 1:1 als
    // CHF bewertet; Endwert «CHF» 2'100 statt 1'932 (mit Rate 0.92), TTWROR
    // +5 % aus reinen USD-Zahlen. Jetzt liefert convertToCHF 0 → die Position
    // fällt aus der Bewertung (Wert 0, keine erfundene Rendite). Der
    // UI-Ausweis der fehlenden Daten läuft über die U-13-Flags.
    expect(r.currentValueCHF).toBe(0);
    expect(r.totalInvestedCHF).toBe(0);
    expect(r.absoluteGainCHF).toBe(0);
    expect(r.ttwror.totalReturn).toBe(0);
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
    // vorher (R-37): 11'000 (Einlage Tag 1 doppelt: 5'000 Deposit + 5'000 MVB
    // + 1'000 Folge-Deposit), absoluteGain −2'000, IRR-Clamp −0.99. Jetzt:
    // MVB 5'000 + Folge-Deposit 1'000 = 6'000 investiert, Gewinn +3'000.
    expect(r.totalInvestedCHF).toBe(6000);
    expect(r.absoluteGainCHF).toBe(3000);
    // Die echte 4-Tage-IRR (+52 % in 4 Tagen) liegt annualisiert jenseits des
    // 1'000-%-Clamps → Newton klemmt bei 10, converged=false.
    // ISTZUSTAND — bekannt falsch, R-16/R-25-Klasse (Annualisierung/Clamp offen):
    expect(r.irr.annualizedIRR).toBe(10);
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
