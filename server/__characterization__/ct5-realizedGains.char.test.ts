/**
 * CT-5 — Charakterisierungstests für den Verkaufs-Zweig von
 * createPortfolioTransaction (server/db.ts:880–986, Realized-Gains-Berechnung)
 *
 * Pinnt die Kostenbasis über ALLE jemals getätigten Käufe (Phantomgewinne, R-03),
 * den FX-Split mit Erstkauf-Datum (R-19) und realizedGainPercent in Lokalwährung
 * neben realizedGain in CHF (R-24).
 * Erwartungswerte wurden durch AUSFÜHREN des aktuellen Codes ermittelt.
 *
 * DB-Mocking: getDb() baut die Drizzle-Instanz via drizzle(process.env.DATABASE_URL)
 * — der mysql2-Treiber wird durch ein In-Memory-Double ersetzt. Im Verkaufs-Zweig
 * gibt es genau eine SELECT-Abfrage (alle Buy-Transaktionen des Tickers); das
 * Double liefert dafür die Fixture-Käufe, die «zum Zeitpunkt des Verkaufs» in der
 * DB lägen. INSERTs (portfolioTransactions, realizedGains) werden aufgezeichnet.
 * fxHelper (getStockCurrency/getFxRate) ist gemockt und protokolliert die Aufrufe.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { S4, S15, D } from "./fixtures";

const h = vi.hoisted(() => ({
  /** Buy-Zeilen, die das SELECT im Verkaufs-Zweig liefert. */
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
        // Einzige SELECT-Abfrage im Sell-Pfad: Buys des Tickers (Cash-Validierung
        // läuft nur für withdrawal/buy). Direkt awaitbar → Promise.
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

  it("4b: zweiter Verkauf 100@30 nach Zukauf 100@30 → Phantomgewinn +1'000 (R-03)", async () => {
    // Zum Zeitpunkt des zweiten Verkaufs liegen BEIDE Käufe in der DB;
    // der erste Verkauf (100@20) hat den Bestand des ersten Kaufs bereits geräumt.
    h.buyRows = [S4.transactions[0], S4.transactions[2]]; // 100@10 + 100@30
    const res = await createPortfolioTransaction(toInsert(S4.transactions[3])); // Verkauf 100@30

    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-03:
    // Kostenbasis = Durchschnitt über ALLE jemals getätigten Käufe
    // ((100·10 + 100·30) / 200 = 20), der erste Verkauf wird ignoriert.
    // Verkauft wird aber die zweite Tranche (Kosten 30) → korrekt wäre Gewinn 0;
    // stattdessen werden +1'000 CHF Phantomgewinn persistiert.
    expect(res.realizedGain.avgCostBasis).toBe(20);
    expect(res.realizedGain.amount).toBe(1000);
    expect(res.realizedGain.percent).toBe(50);

    const rg = h.inserts[1];
    expect(rg.avgCostBasis).toBe("20.00");
    expect(rg.realizedGain).toBe("1000.00"); // nach R-03-Fix: "0.00"
  });
});

describe("CT-5 createPortfolioTransaction — FX-Split (Szenario 15)", () => {
  it("Verkauf 200@20 USD nach Käufen zu Raten 0.88/0.90 → FX-Split mit Erstkauf-Datum (R-19)", async () => {
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

    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-19:
    // buyFxRate stammt vom Datum des ERSTEN Kaufs (03.03. → 0.88) statt
    // shares-/kostengewichtet (korrekt: (880 + 1800)/3000 ≈ 0.8933).
    expect(g.buyFxRate).toBe(0.88);
    expect(g.sellFxRate).toBe(0.92);
    // Die Rate des zweiten Kaufdatums (05.03.) wird nie abgefragt:
    expect(h.fxCalls).toContain(`${D.mar03}:USDCHF`);
    expect(h.fxCalls).toContain(`${D.mar07}:USDCHF`);
    expect(h.fxCalls).not.toContain(`${D.mar05}:USDCHF`);

    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-19:
    // Gesamtgewinn CHF = (20·0.92 − 15·0.88) · 200 = 1'040 statt gewichtet 1'000
    // (Kostenbasis CHF 13.20 statt 13.40) → +40 CHF Phantom-FX-Gewinn.
    expect(g.amount).toBeCloseTo(1040, 10);
    expect(g.stockGainCHF).toBeCloseTo(920, 10); // 1'000 USD · 0.92
    expect(g.fxGain).toBeCloseTo(120, 10); // korrekt gewichtet wären 80

    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-24:
    // Prozentwert in LOKALWÄHRUNG ((20−15)/15) neben CHF-Betrag 1'040 —
    // die zwei angezeigten Zahlen widersprechen sich bei FX-Titeln.
    expect(g.percent).toBeCloseTo(33.33333333333333, 10);

    const rg = h.inserts[1];
    expect(rg.realizedGain).toBe("1040.00");
    expect(rg.realizedGainPercent).toBe("33.33");
    expect(rg.buyFxRate).toBe("0.8800");
    expect(rg.sellFxRate).toBe("0.9200");
    expect(rg.currency).toBe("USD");
  });
});
