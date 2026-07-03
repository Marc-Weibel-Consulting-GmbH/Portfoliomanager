/**
 * CT-5 — Charakterisierungstests für den Verkaufs-Zweig von
 * createPortfolioTransaction (server/db.ts:880–986, Realized-Gains-Berechnung)
 *
 * Pinnt seit dem R-03/R-19-Fix die laufende Moving-Average-Kostenbasis
 * (frühere Verkäufe konsumieren Basis, keine Phantomgewinne mehr) und den
 * kostengewichteten Buy-FX-Split über die verbleibende Position. Offen bleibt
 * realizedGainPercent in Lokalwährung neben realizedGain in CHF (R-24).
 * Ursprüngliche Erwartungswerte wurden durch AUSFÜHREN des Codes ermittelt;
 * geflippte Pins tragen `// vorher (R-xx)`-Kommentare.
 *
 * DB-Mocking: getDb() baut die Drizzle-Instanz via drizzle(process.env.DATABASE_URL)
 * — der mysql2-Treiber wird durch ein In-Memory-Double ersetzt. Im Verkaufs-Zweig
 * gibt es genau eine SELECT-Abfrage (seit R-03: ALLE Transaktionen des Tickers,
 * Buys UND Sells); das Double liefert dafür die Fixture-Zeilen, die «zum
 * Zeitpunkt des Verkaufs» in der DB lägen. INSERTs (portfolioTransactions,
 * realizedGains) werden aufgezeichnet.
 * fxHelper (getStockCurrency/getFxRate) ist gemockt und protokolliert die Aufrufe.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { S4, S15, D } from "./fixtures";

const h = vi.hoisted(() => ({
  /** Ledger-Zeilen (Buys UND Sells des Tickers), die das SELECT im Verkaufs-Zweig liefert. */
  buyRows: [] as any[],
  /** Aufgezeichnete INSERT-values (1. portfolioTransactions, 2. realizedGains). */
  inserts: [] as any[],
  nextInsertId: 9001,
  currencyByTicker: {} as Record<string, string>,
  fxByKey: {} as Record<string, number>,
  fxCalls: [] as string[],
}));

vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: () => ({
    select: () => ({
      from: () => ({
        // Einzige SELECT-Abfrage im Sell-Pfad: alle Transaktionen des Tickers
        // (Cash-Validierung läuft nur für withdrawal/buy). Direkt awaitbar → Promise.
        where: () => Promise.resolve([...h.buyRows]),
      }),
    }),
    insert: () => ({
      values: (values: any) => {
        h.inserts.push(values);
        return Promise.resolve({ insertId: h.nextInsertId++ });
      },
    }),
  }),
}));

vi.mock("../fxHelper", () => ({
  getStockCurrency: async (ticker: string) => h.currencyByTicker[ticker] ?? "CHF",
  getFxRate: async (date: string, pair: string) => {
    h.fxCalls.push(`${date}:${pair}`);
    return h.fxByKey[`${date}:${pair}`] ?? 1.0;
  },
}));

import { createPortfolioTransaction } from "../db";

/** Volle Fixture-Zeile → Insert-Shape (ohne id/createdAt, wie der Router sie schickt). */
function toInsert(tx: any) {
  const { id, createdAt, ...insertShape } = tx;
  return insertShape;
}

beforeAll(() => {
  vi.stubEnv("DATABASE_URL", "mysql://characterization-test");
});

afterAll(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  h.buyRows = [];
  h.inserts = [];
  h.currencyByTicker = {};
  h.fxByKey = {};
  h.fxCalls = [];
});

describe("CT-5 createPortfolioTransaction — Verkaufs-Zweig (Szenario 4)", () => {
  it("4a: erster Verkauf 100@20 nach Kauf 100@10 → Gewinn +1'000 (korrekt)", async () => {
    h.buyRows = [S4.transactions[0]]; // Kauf 100@10 liegt in der DB
    const res = await createPortfolioTransaction(toInsert(S4.transactions[1])); // Verkauf 100@20

    expect(res.realizedGain.avgCostBasis).toBe(10);
    expect(res.realizedGain.amount).toBe(1000);
    expect(res.realizedGain.percent).toBe(100);
    expect(res.realizedGain.stockGainLocal).toBe(1000);
    expect(res.realizedGain.fxGain).toBe(0);

    // Persistierte realizedGains-Zeile (2. INSERT):
    const rg = h.inserts[1];
    expect(rg.avgCostBasis).toBe("10.00");
    expect(rg.sellPrice).toBe("20.00");
    expect(rg.realizedGain).toBe("1000.00");
    expect(rg.realizedGainPercent).toBe("100.00");
  });

  it("4b: zweiter Verkauf 100@30 nach Zukauf 100@30 → Gewinn 0 (R-03 gefixt)", async () => {
    // Zum Zeitpunkt des zweiten Verkaufs liegen beide Käufe UND der erste
    // Verkauf in der DB; der erste Verkauf (100@20) hat den Bestand des
    // ersten Kaufs bereits geräumt.
    h.buyRows = [S4.transactions[0], S4.transactions[1], S4.transactions[2]]; // Kauf 100@10, Verkauf 100@20, Kauf 100@30
    const res = await createPortfolioTransaction(toInsert(S4.transactions[3])); // Verkauf 100@30

    // Seit dem R-03-Fix: laufende Moving-Average-Basis über Buys UND Sells —
    // der erste Verkauf konsumiert die erste Tranche, die Basis der zweiten
    // Tranche ist 30 → Gewinn 0 statt +1'000 CHF Phantomgewinn.
    expect(res.realizedGain.avgCostBasis).toBe(30); // vorher (R-03): 20
    expect(res.realizedGain.amount).toBe(0); // vorher (R-03): 1000
    expect(res.realizedGain.percent).toBe(0); // vorher (R-03): 50

    const rg = h.inserts[1];
    expect(rg.avgCostBasis).toBe("30.00"); // vorher (R-03): "20.00"
    expect(rg.realizedGain).toBe("0.00"); // vorher (R-03): "1000.00"
  });
});

describe("CT-5 createPortfolioTransaction — FX-Split (Szenario 15)", () => {
  it("Verkauf 200@20 USD nach Käufen zu Raten 0.88/0.90 → kostengewichteter FX-Split (R-19 gefixt)", async () => {
    h.currencyByTicker["USTIT"] = "USD";
    h.fxByKey = {
      [`${D.mar03}:USDCHF`]: 0.88,
      [`${D.mar05}:USDCHF`]: 0.9,
      [`${D.mar07}:USDCHF`]: 0.92,
    };
    h.buyRows = [...S15.buys];

    const res = await createPortfolioTransaction(toInsert(S15.sell));
    const g = res.realizedGain;

    // Kostenbasis lokal: (100·10 + 100·20) / 200 = 15 USD.
    expect(g.avgCostBasis).toBe(15);
    expect(g.stockGainLocal).toBe(1000); // (20 − 15) · 200 USD

    // Seit dem R-19-Fix: buyFxRate ist der KOSTENGEWICHTETE Durchschnitt der
    // verbleibenden Position aus den gespeicherten fxRate-Spalten:
    // (880 + 1800)/3000 ≈ 0.8933.
    expect(g.buyFxRate).toBeCloseTo(2680 / 3000, 12); // vorher (R-19): 0.88 (Rate am Erstkauf-Datum)
    expect(g.sellFxRate).toBe(0.92);
    // Buy-Raten kommen aus den gespeicherten fxRate-Spalten — datumsbasierter
    // Lookup nur noch für das Verkaufsdatum:
    expect(h.fxCalls).not.toContain(`${D.mar03}:USDCHF`); // vorher (R-19): abgefragt (Erstkauf-Datum)
    expect(h.fxCalls).toContain(`${D.mar07}:USDCHF`);
    expect(h.fxCalls).not.toContain(`${D.mar05}:USDCHF`);

    // Seit dem R-19-Fix: Gesamtgewinn CHF = (20·0.92 − 15·0.8933…) · 200 = 1'000
    // (Kostenbasis CHF 13.40 statt 13.20) — kein Phantom-FX-Gewinn mehr.
    expect(g.amount).toBeCloseTo(1000, 9); // vorher (R-19): 1040
    expect(g.stockGainCHF).toBeCloseTo(920, 10); // 1'000 USD · 0.92
    expect(g.fxGain).toBeCloseTo(80, 9); // vorher (R-19): 120

    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-24 (bleibt offen):
    // Prozentwert in LOKALWÄHRUNG ((20−15)/15) neben CHF-Betrag 1'000 —
    // die zwei angezeigten Zahlen widersprechen sich bei FX-Titeln.
    expect(g.percent).toBeCloseTo(33.33333333333333, 10);

    const rg = h.inserts[1];
    expect(rg.realizedGain).toBe("1000.00"); // vorher (R-19): "1040.00"
    expect(rg.realizedGainPercent).toBe("33.33");
    expect(rg.buyFxRate).toBe("0.8933"); // vorher (R-19): "0.8800"
    expect(rg.sellFxRate).toBe("0.9200");
    expect(rg.currency).toBe("USD");
  });
});
