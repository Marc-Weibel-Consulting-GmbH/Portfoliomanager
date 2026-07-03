/**
 * CT-1 — Charakterisierungstests für calculatePerformanceMetrics + buildValuePoints
 * (server/performanceCalculations.ts)
 *
 * Pinnt das IST-Verhalten inkl. bekannter Fehler (siehe OPTIMIZATION_PLAN.md).
 * Erwartungswerte wurden durch AUSFÜHREN des aktuellen Codes ermittelt.
 *
 * buildValuePoints hängt einen "heute"-Punkt via new Date() an → Systemzeit
 * wird auf FIXED_NOW (2025-12-31) fixiert.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  calculatePerformanceMetrics,
  buildValuePoints,
} from "../performanceCalculations";
import { S1, S2, S3_MANUAL, S3_CSV, S5, S6, S8, S9_EMPTY, S9_NO_PRICE, S10, S16, D, FIXED_NOW, TODAY_STR } from "./fixtures";

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FIXED_NOW);
});

afterAll(() => {
  vi.useRealTimers();
});

describe("CT-1 calculatePerformanceMetrics", () => {
  it("Szenario 1: Nur-Kauf, eine Position, keine FX", () => {
    const m = calculatePerformanceMetrics(S1.transactions, S1.currentPrices);
    expect(m.totalReturn).toBe(500);
    expect(m.totalReturnPercent).toBeCloseTo(5.263157894736842, 10);
    expect(m.unrealizedGains).toBe(500);
    expect(m.unrealizedGainsPercent).toBeCloseTo(5.263157894736842, 10);
    expect(m.totalInvested).toBe(9500);
    expect(m.currentValue).toBe(10000);
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-04:
    // TWR/MWR sind 0, obwohl der Kurs von 95 auf 100 stieg — buildValuePoints
    // bewertet auch den Kauf-Stichtag mit dem HEUTIGEN Kurs, die Serie ist flach.
    expect(m.timeWeightedReturn).toBe(0);
    expect(m.moneyWeightedReturn).toBe(0);
  });

  it("Szenario 2: Auszahlung CHF 10'000 negativ gespeichert (R-01)", () => {
    const m = calculatePerformanceMetrics(S2.transactions, S2.currentPrices);
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-01:
    // totalInvested = 20'000 − (−10'000) = 30'000 — die Entnahme ERHÖHT das
    // investierte Kapital statt es zu senken (korrekt wären 10'000).
    expect(m.totalInvested).toBe(30000);
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-01:
    // totalReturn = 10'000 − 30'000 = −20'000 statt +500.
    expect(m.totalReturn).toBe(-20000);
    expect(m.totalReturnPercent).toBeCloseTo(-66.66666666666666, 10);
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-01:
    // TWR = −100 %: die negativ gespeicherte Entnahme wird in buildValuePoints
    // als ZUFLUSS von +10'000 gezählt; adjustedValue = 10'000 − 10'000 = 0.
    expect(m.timeWeightedReturn).toBe(-100);
    expect(m.moneyWeightedReturn).toBeCloseTo(-6.47974607304036e-7, 10);
    // Bestandsdaten selbst bleiben korrekt:
    expect(m.unrealizedGains).toBe(500);
    expect(m.currentValue).toBe(10000);
  });

  it("Szenario 3: Kauf mit Fees — manuell (Fees in totalAmountCHF) vs CSV (R-02)", () => {
    const manual = calculatePerformanceMetrics(S3_MANUAL.transactions, S3_MANUAL.currentPrices);
    const csv = calculatePerformanceMetrics(S3_CSV.transactions, S3_CSV.currentPrices);

    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-02:
    // Manueller Pfad: totalAmountCHF (9'550, inkl. Fees) + Fees (50) erneut
    // → Kostenbasis 9'600, Fees doppelt gezählt.
    expect(manual.unrealizedGains).toBe(400);
    expect(manual.unrealizedGainsPercent).toBeCloseTo(4.166666666666666, 10);
    // CSV-Pfad: totalAmountCHF (9'500, exkl. Fees) + Fees (50) → Kostenbasis 9'550.
    expect(csv.unrealizedGains).toBe(450);
    expect(csv.unrealizedGainsPercent).toBeCloseTo(4.712041884816754, 10);
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-02:
    // Identischer wirtschaftlicher Vorgang, zwei verschiedene Ergebnisse:
    expect(manual.unrealizedGains).not.toBe(csv.unrealizedGains);

    // Käufe ohne Deposit: totalInvested zählt nur deposits − withdrawals → 0,
    // totalReturn = currentValue − Fees = 9'950 (kein Bezug zum Einsatz).
    expect(manual.totalInvested).toBe(0);
    expect(manual.totalReturn).toBe(9950);
    expect(manual.totalReturnPercent).toBe(0); // Division-durch-null-Guard
    expect(manual.feesPaid).toBe(50);
  });

  it("Szenario 5: Dividende CHF 100 wird doppelt bestraft (R-05)", () => {
    const base = calculatePerformanceMetrics(S1.transactions, S1.currentPrices);
    const m = calculatePerformanceMetrics(S5.transactions, S5.currentPrices);
    expect(m.dividendsReceived).toBe(100);
    expect(m.totalReturn).toBe(600); // 500 Kurs + 100 Dividende (hier korrekt)
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-05:
    // TWR sinkt durch die Dividende von 0 % auf −1 % — die Dividende wird als
    // externer Zufluss vom Periodenertrag ABGEZOGEN statt als Ertrag gezählt.
    expect(m.timeWeightedReturn).toBeCloseTo(-1.0000000000000009, 10);
    expect(base.timeWeightedReturn).toBe(0);
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-05 + R-25 + R-16:
    // MWR explodiert auf ~1'697 %: die Dividende wird als Einzahlung des
    // Anlegers (−100) gegen den Endwert (+10'000) gerechnet; Newton-Raphson
    // läuft in den Clamp rate=10 und wird stillschweigend zurückgegeben (R-25),
    // danach Hochrechnung auf < 1 Jahr (R-16).
    expect(m.moneyWeightedReturn).toBeCloseTo(1696.7304893707496, 8);
  });

  it("Szenario 6: USD-Position ohne FX-Rate — Lokalbetrag als CHF (R-15/R-10)", () => {
    const m = calculatePerformanceMetrics(S6.transactions, S6.currentPrices);
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-15:
    // totalAmountCHF fehlt → Fallback auf totalAmount (2'000 USD) als CHF;
    // currentValue = 10 × 210 USD wird 1:1 als CHF 2'100 ausgewiesen.
    expect(m.currentValue).toBe(2100);
    expect(m.unrealizedGains).toBe(100);
    expect(m.unrealizedGainsPercent).toBe(5);
  });

  it("Szenario 9: Leeres Portfolio / Titel ohne Kurs — keine NaN/Infinity", () => {
    const empty = calculatePerformanceMetrics(S9_EMPTY.transactions, S9_EMPTY.currentPrices);
    for (const [k, v] of Object.entries(empty)) {
      expect(Number.isFinite(v), `metrics.${k} muss endlich sein`).toBe(true);
    }
    expect(empty.totalReturn).toBe(0);
    expect(empty.totalReturnPercent).toBe(0);
    expect(empty.currentValue).toBe(0);

    const noPrice = calculatePerformanceMetrics(S9_NO_PRICE.transactions, S9_NO_PRICE.currentPrices);
    // Fehlender Kurs → Position wird still mit 0 bewertet (vgl. U-13):
    expect(noPrice.currentValue).toBe(0);
    expect(noPrice.unrealizedGains).toBe(-1000);
    expect(noPrice.unrealizedGainsPercent).toBe(-100);
    for (const v of Object.values(noPrice)) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it("Szenario 10: Oversell 150 von 100 — MWR aus Phantom-Flows (R-20/R-25)", () => {
    const m = calculatePerformanceMetrics(S10.transactions, S10.currentPrices);
    // Position verschwindet aus den Holdings (shares = −50 → übersprungen):
    expect(m.currentValue).toBe(0);
    expect(m.unrealizedGains).toBe(0);
    expect(m.timeWeightedReturn).toBe(0);
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-20 + R-25:
    // MWR = ~1'697 % aus dem Verkaufserlös als einzigem Flow gegen Endwert 0
    // (Newton-Raphson-Clamp rate=10, stillschweigend zurückgegeben).
    expect(m.moneyWeightedReturn).toBeCloseTo(1696.7304893707496, 8);
  });
});

describe("CT-1 buildValuePoints", () => {
  it("Szenario 1: bewertet den vergangenen Stichtag mit dem HEUTIGEN Kurs (R-04)", () => {
    const points = buildValuePoints(S1.transactions, S1.currentPrices);
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-04:
    // Am 03.03. war der Kurs 95 (Wert 9'500) — buildValuePoints liefert aber
    // 10'000 (100 Aktien × aktueller Kurs 100) auch für den vergangenen Stichtag.
    expect(points).toEqual([
      { date: D.mar03, value: 10000, cashFlows: 0 },
      { date: TODAY_STR, value: 10000, cashFlows: 0 },
    ]);
  });

  it("Szenario 2: negative Entnahme wird als Zufluss +10'000 gezählt (R-01)", () => {
    const points = buildValuePoints(S2.transactions, S2.currentPrices);
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-01:
    // cashFlows -= (−10'000) → +10'000: die Entnahme erscheint als Einzahlung.
    expect(points).toEqual([
      { date: D.mar03, value: 10000, cashFlows: 0 },
      { date: D.mar05, value: 10000, cashFlows: 10000 },
      { date: TODAY_STR, value: 10000, cashFlows: 0 },
    ]);
  });

  it("Szenario 5: Dividende erscheint als externer Cashflow +100 (R-05)", () => {
    const points = buildValuePoints(S5.transactions, S5.currentPrices);
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-05:
    // Die Dividende wird als externer Flow geführt und drückt so den TWR.
    expect(points).toEqual([
      { date: D.mar03, value: 10000, cashFlows: 0 },
      { date: D.mar05, value: 10000, cashFlows: 100 },
      { date: TODAY_STR, value: 10000, cashFlows: 0 },
    ]);
  });

  it("Szenario 8: Kurs bewegte sich 50→80 — alle Stichtage zeigen 8'000 (R-04)", () => {
    const points = buildValuePoints(S8.transactions, S8.currentPrices);
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-04:
    // Historisch korrekt wären 5'000 (03.03.) und 6'000 (05.03.) — geliefert
    // wird überall 100 × aktueller Kurs 80 = 8'000.
    expect(points).toEqual([
      { date: D.mar03, value: 8000, cashFlows: 0 },
      { date: D.mar05, value: 8000, cashFlows: 1000 },
      { date: TODAY_STR, value: 8000, cashFlows: 0 },
    ]);
  });

  it("Szenario 9: leeres Portfolio → leere Serie", () => {
    expect(buildValuePoints(S9_EMPTY.transactions, S9_EMPTY.currentPrices)).toEqual([]);
  });

  it("Szenario 10: Oversell erzeugt NEGATIVEN Portfoliowert −600 (R-20)", () => {
    const points = buildValuePoints(S10.transactions, S10.currentPrices);
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-20:
    // Verkauf 150 bei Bestand 100 → shares = −50, Kostenbasis −500;
    // der Stichtagswert wird −50 × 12 = −600.
    expect(points).toEqual([
      { date: D.mar03, value: 1200, cashFlows: 0 },
      { date: D.mar05, value: -600, cashFlows: -1800 },
      { date: TODAY_STR, value: -600, cashFlows: 0 },
    ]);
  });

  it("Szenario 16: DESC- und ASC-Input liefern identische Serien (interne Sortierung)", () => {
    // buildValuePoints sortiert selbst — im Gegensatz zu
    // calculateHoldingsPerformance (siehe CT-6) ist es reihenfolge-unabhängig.
    const asc = buildValuePoints(S16.asc, S16.currentPrices);
    const desc = buildValuePoints(S16.desc, S16.currentPrices);
    expect(desc).toEqual(asc);
    expect(asc).toEqual([
      { date: D.mar03, value: 1200, cashFlows: 0 },
      { date: D.mar05, value: 600, cashFlows: -600 },
      { date: TODAY_STR, value: 600, cashFlows: 0 },
    ]);
  });
});
