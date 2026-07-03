/**
 * CT-12 — Charakterisierungstests für buildDashboardValueSeries
 * (server/lib/dashboardValueSeries.ts, extrahiert aus
 * dashboardPerformanceRouter.getHistoricalPerformance)
 *
 * Pinnt die Tageswertserie des Dashboards: Umgang mit der Sortierung der
 * Transaktionen (R-06, DESC/`break`-Bug) und die Performance-Formel
 * (R-07, externe Cashflows). Erwartungswerte wurden durch AUSFÜHREN des
 * jeweils aktuellen Codes ermittelt; nach dem Fix wurden die Pins mit
 * «vorher (R-xx)»-Kommentaren umgeklappt.
 */

import { describe, it, expect } from "vitest";
import { buildDashboardValueSeries } from "../lib/dashboardValueSeries";

/** FX-Stub: alles ist bereits CHF. */
const identityFx = async (amount: number) => amount;

const DATES = ["2025-03-03", "2025-03-04", "2025-03-05", "2025-03-06", "2025-03-07"];

/** Konstanter Kurs 100 CHF für AAA an allen fünf Handelstagen. */
function constantPriceMap(price = 100): Map<string, Map<string, number>> {
  return new Map([["AAA", new Map(DATES.map((d) => [d, price]))]]);
}

const STOCKS = new Map([["AAA", { currency: "CHF" }]]);

function buyTx(date: string, shares: number, price: number) {
  return {
    ticker: "AAA",
    transactionType: "buy",
    transactionDate: date,
    shares: String(shares),
    totalAmount: String(shares * price),
    totalAmountCHF: String(shares * price),
  };
}

function depositTx(date: string, amountCHF: number) {
  return {
    ticker: null,
    transactionType: "deposit",
    transactionDate: date,
    shares: null,
    totalAmount: String(amountCHF),
    totalAmountCHF: String(amountCHF),
  };
}

describe("CT-12 buildDashboardValueSeries — Sortierung (R-06)", () => {
  it("ASC-Input: Kauf am ersten Tag ergibt konstante Wertserie", async () => {
    const txs = [buyTx("2025-03-03", 10, 100)];

    const result = await buildDashboardValueSeries(
      [txs], STOCKS, constantPriceMap(), DATES, identityFx
    );

    expect(result.values).toEqual([1000, 1000, 1000, 1000, 1000]);
    expect(result.startingValue).toBe(1000);
    expect(result.performance).toEqual([0, 0, 0, 0, 0]);
  });

  it("DESC-Input (wie batchGetPortfolioTransactions liefert) ergibt dieselbe Serie wie ASC", async () => {
    // Zwei Käufe; DESC = neuester zuerst — exakt die Sortierung aus
    // db-optimized.ts:42 (orderBy desc(transactionDate)).
    const asc = [buyTx("2025-03-03", 10, 100), buyTx("2025-03-06", 5, 100)];
    const desc = [...asc].reverse();

    const resultDesc = await buildDashboardValueSeries(
      [desc], STOCKS, constantPriceMap(), DATES, identityFx
    );
    const resultAsc = await buildDashboardValueSeries(
      [asc], STOCKS, constantPriceMap(), DATES, identityFx
    );

    // vorher (R-06): `break` bei txDate > date setzte bei DESC-Input voraus,
    // dass ältere Transaktionen NACH neueren kommen — die Schleife brach beim
    // neuesten Kauf ab und die Serie kollabierte auf 0 für alle Tage vor dem
    // letzten Kauf: values [0, 0, 0, 1500, 1500], startingValue 0,
    // performance [0, 0, 0, 0, 0]. Jetzt wird lokal ASC sortiert:
    expect(resultDesc.values).toEqual([1000, 1000, 1000, 1500, 1500]);
    expect(resultDesc.startingValue).toBe(1000);
    expect(resultDesc.values).toEqual(resultAsc.values);
    expect(resultDesc.performance).toEqual(resultAsc.performance);
    expect(resultDesc.startingValue).toBe(resultAsc.startingValue);
  });

  it("eine Transaktion INNERHALB des Fensters nullt die Serie nicht mehr (DESC)", async () => {
    // Ein einzelner Kauf mitten im Fenster, DESC-geliefert (nur eine Zeile —
    // Reihenfolge irrelevant, pinnt das Fenster-Verhalten selbst).
    const txs = [buyTx("2025-03-05", 10, 100)];

    const result = await buildDashboardValueSeries(
      [txs], STOCKS, constantPriceMap(), DATES, identityFx
    );

    // Tage vor dem Kauf: keine Holdings → 0; ab Kaufdatum: 1000.
    expect(result.values).toEqual([0, 0, 1000, 1000, 1000]);
  });
});

describe("CT-12 buildDashboardValueSeries — Performance (R-07)", () => {
  it("Einzahlung + Zukauf mitten in der Periode erscheint NICHT mehr als Gewinn", async () => {
    // Tag 1: 10 Stück à 100 (Wert 1000). Tag 3: Einzahlung 1000 CHF und
    // sofortiger Zukauf von 10 Stück à 100. Kurs konstant 100 → echte
    // Anlageperformance ist 0 %.
    const txs = [
      buyTx("2025-03-03", 10, 100),
      depositTx("2025-03-05", 1000),
      buyTx("2025-03-05", 10, 100),
    ];

    const result = await buildDashboardValueSeries(
      [txs], STOCKS, constantPriceMap(), DATES, identityFx
    );

    expect(result.values).toEqual([1000, 1000, 2000, 2000, 2000]);

    // vorher (R-07): performance = (value − startingValue)/startingValue
    // ignorierte externe Flows — die Einzahlung erschien als +100 % Gewinn:
    // performance [0, 0, 100, 100, 100]. Jetzt TTWROR mit externen Flows
    // (transactionSemantics.getSignedFlowCHF): Einzahlung neutralisiert.
    expect(result.performance).toEqual([0, 0, 0, 0, 0]);
  });

  it("Kursgewinn nach zwischenzeitlicher Einzahlung wird zeitgewichtet ausgewiesen", async () => {
    // Kurs: 100 an Tag 1–3, 110 ab Tag 4 (+10 %). Einzahlung + Zukauf an Tag 3.
    const prices = new Map([
      ["AAA", new Map([
        ["2025-03-03", 100], ["2025-03-04", 100], ["2025-03-05", 100],
        ["2025-03-06", 110], ["2025-03-07", 110],
      ])],
    ]);
    const txs = [
      buyTx("2025-03-03", 10, 100),
      depositTx("2025-03-05", 1000),
      buyTx("2025-03-05", 10, 100),
    ];

    const result = await buildDashboardValueSeries(
      [txs], STOCKS, prices, DATES, identityFx
    );

    expect(result.values).toEqual([1000, 1000, 2000, 2200, 2200]);

    // vorher (R-07): naive Formel: [0, 0, 100, 120, 120] — Einzahlung als
    // Gewinn gezählt. TTWROR: nur die Kursbewegung (+10 %) zählt.
    expect(result.performance[0]).toBe(0);
    expect(result.performance[1]).toBe(0);
    expect(result.performance[2]).toBeCloseTo(0, 10);
    expect(result.performance[3]).toBeCloseTo(10, 10);
    expect(result.performance[4]).toBeCloseTo(10, 10);
  });

  it("Entry-Transaktionen (Go-Live) zählen als Bestand UND als externer Zufluss", async () => {
    // Go-Live legt 'entry'-Transaktionen mit Stückzahl an
    // (portfoliosRouter.toggleLive). vorher: 'entry' wurde im Holdings-Aufbau
    // ignoriert (nur buy/sell) → Serie 0. Jetzt buy-ähnlich behandelt
    // (Parität zu performanceEngine buildHoldingsTimeline) und via
    // isExternalFlow als Einzahlung neutralisiert.
    const txs = [{
      ticker: "AAA",
      transactionType: "entry",
      transactionDate: "2025-03-03",
      shares: "10",
      totalAmount: "1000",
      totalAmountCHF: "1000",
    }];

    const result = await buildDashboardValueSeries(
      [txs], STOCKS, constantPriceMap(), DATES, identityFx
    );

    expect(result.values).toEqual([1000, 1000, 1000, 1000, 1000]);
    expect(result.performance).toEqual([0, 0, 0, 0, 0]);
  });
});
