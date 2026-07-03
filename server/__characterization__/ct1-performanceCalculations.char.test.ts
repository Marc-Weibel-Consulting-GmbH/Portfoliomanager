/**
 * CT-1 — Charakterisierungstests für calculatePerformanceMetrics + buildValuePoints
 * (server/performanceCalculations.ts)
 *
 * STATUS (R-04/D-01): Das Modul ist LEGACY/DEPRECATED. Seit Phase 2.7 hat es
 * KEINE user-facing Konsumenten mehr — routers/portfolioPerformanceRouter.ts
 * bezieht TWR/MWR und die Wert-Historie aus der historisch korrekten Pipeline
 * (lib/performanceService.ts); nur calculateHoldingsPerformance (CT-6,
 * point-in-time) bleibt in Gebrauch. Diese Pins dokumentieren das eingefrorene
 * Fehlverhalten der stillgelegten Funktionen (flache Serie aus HEUTIGEN
 * Kursen) und schützen vor versehentlicher Wiederverwendung.
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
    // vorher (R-01): 30'000 — die negativ gespeicherte Entnahme ERHÖHTE das
    // investierte Kapital (20'000 − (−10'000)). Jetzt via getSignedFlowCHF
    // normalisiert: 20'000 − 10'000 = 10'000.
    expect(m.totalInvested).toBe(10000);
    // vorher (R-01): −20'000 (aus totalInvested 30'000). Jetzt 0:
    // currentValue 10'000 − totalInvested 10'000. (Dass die verbleibenden
    // CHF 500 Cash fehlen, ist die R-04-Klasse-Limitierung dieses Moduls —
    // es bewertet nur Aktienbestände, kein Cash.)
    expect(m.totalReturn).toBe(0);
    expect(m.totalReturnPercent).toBe(0);
    // vorher (R-01): −100 % — die Entnahme wurde als Zufluss +10'000 gezählt
    // (adjustedValue 0). Jetzt korrekt als Abfluss −10'000; weil die Serie
    // aber weiterhin flach mit HEUTIGEN Kursen bewertet wird (R-04) und kein
    // Cash enthält, ergibt sich +100 % statt der echten ~+3.97 % (vgl. CT-2).
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-04.
    expect(m.timeWeightedReturn).toBe(100);
    // vorher (R-01): ~0 %. Die (korrekt positive) Entnahme +10'000 und der
    // Endwert +10'000 sind die einzigen IRR-Flows (Initial-Deposit ist
    // performance-neutral) → Gleichung unlösbar, Newton-Clamp rate=10 (R-25,
    // dokumentiert offen).
    // vorher (R-16): 1696.7304893707496 — die geklemmte Rate wurde via
    // (1+r)^(1/Jahre) über die UNTERJÄHRIGE Periode (303 Tage, 365er-Basis)
    // zusätzlich aufgeblasen. Jetzt (lib/dateMath): unterjährig keine
    // Annualisierung → die Clamp-Rate 10 wird als 1'000 % ausgewiesen.
    expect(m.moneyWeightedReturn).toBe(1000);
    // Bestandsdaten selbst bleiben korrekt:
    expect(m.unrealizedGains).toBe(500);
    expect(m.currentValue).toBe(10000);
  });

  it("Szenario 3: Kauf mit Fees — manuell (Fees in totalAmountCHF) vs CSV (R-02)", () => {
    const manual = calculatePerformanceMetrics(S3_MANUAL.transactions, S3_MANUAL.currentPrices);
    const csv = calculatePerformanceMetrics(S3_CSV.transactions, S3_CSV.currentPrices);

    // vorher (R-02): 400 — der manuelle Pfad speicherte totalAmountCHF inkl.
    // Fees (9'550) und die Konsumenten addierten Fees erneut → Kostenbasis
    // 9'600, Fees doppelt gezählt. Jetzt kanonische Semantik (totalAmountCHF
    // = Brutto EXKL. Fees, Kostenbasis = Brutto + Fees) → 9'550 auf BEIDEN
    // Pfaden (Fixture migriert, vgl. scripts/migrate-fee-semantics.ts).
    expect(manual.unrealizedGains).toBe(450);
    expect(manual.unrealizedGainsPercent).toBeCloseTo(4.712041884816754, 10);
    // CSV-Pfad: totalAmountCHF (9'500, exkl. Fees) + Fees (50) → Kostenbasis 9'550.
    expect(csv.unrealizedGains).toBe(450);
    expect(csv.unrealizedGainsPercent).toBeCloseTo(4.712041884816754, 10);
    // vorher (R-02): not.toBe — identischer wirtschaftlicher Vorgang lieferte
    // zwei verschiedene Ergebnisse. Jetzt konvergieren beide Pfade:
    expect(manual.unrealizedGains).toBe(csv.unrealizedGains);

    // Käufe ohne Deposit: totalInvested zählt nur deposits − withdrawals → 0,
    // totalReturn = currentValue − Fees = 9'950 (kein Bezug zum Einsatz).
    expect(manual.totalInvested).toBe(0);
    expect(manual.totalReturn).toBe(9950);
    expect(manual.totalReturnPercent).toBe(0); // Division-durch-null-Guard
    expect(manual.feesPaid).toBe(50);
  });

  it("Szenario 5: Dividende CHF 100 wird nicht mehr doppelt bestraft (R-05)", () => {
    const base = calculatePerformanceMetrics(S1.transactions, S1.currentPrices);
    const m = calculatePerformanceMetrics(S5.transactions, S5.currentPrices);
    expect(m.dividendsReceived).toBe(100);
    expect(m.totalReturn).toBe(600); // 500 Kurs + 100 Dividende (hier korrekt)
    // vorher (R-05): −1 % — die Dividende wurde als externer Zufluss vom
    // Periodenertrag ABGEZOGEN. Jetzt ist sie interner Ertrag (kein externer
    // Flow) → TWR identisch zum dividendenlosen Basisfall.
    expect(m.timeWeightedReturn).toBe(0);
    expect(base.timeWeightedReturn).toBe(0);
    // vorher (R-05 + R-25 + R-16): ~1'697 % — die Dividende wurde als
    // Einzahlung des Anlegers (−100) gegen den Endwert gerechnet und der
    // Newton-Clamp rate=10 hochgerechnet. Jetzt kein externer Flow mehr →
    // MWR = 0 wie im Basisfall (die flache R-04-Serie liefert ohnehin 0).
    expect(m.moneyWeightedReturn).toBe(0);
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
    // MWR aus dem Verkaufserlös als einzigem Flow gegen Endwert 0
    // (Newton-Raphson-Clamp rate=10, stillschweigend zurückgegeben).
    // vorher (R-16): 1696.7304893707496 — unterjährige Hochrechnung der
    // Clamp-Rate; jetzt (lib/dateMath) unverändert 1'000 %.
    expect(m.moneyWeightedReturn).toBe(1000);
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

  it("Szenario 2: negative Entnahme wird als Abfluss −10'000 gezählt (R-01)", () => {
    const points = buildValuePoints(S2.transactions, S2.currentPrices);
    // vorher (R-01): cashFlows +10'000 — `cashFlows -= (−10'000)` machte aus
    // der negativ gespeicherten Entnahme eine Einzahlung. Jetzt normalisiert
    // getSignedFlowCHF die Entnahme auf −10'000 (Geld verlässt das Portfolio).
    expect(points).toEqual([
      { date: D.mar03, value: 10000, cashFlows: 0 },
      { date: D.mar05, value: 10000, cashFlows: -10000 },
      { date: TODAY_STR, value: 10000, cashFlows: 0 },
    ]);
  });

  it("Szenario 5: Dividende ist KEIN externer Cashflow mehr (R-05)", () => {
    const points = buildValuePoints(S5.transactions, S5.currentPrices);
    // vorher (R-05): cashFlows +100 am 05.03. — die Dividende wurde als
    // externer Flow geführt und drückte so den TWR. Jetzt interner Ertrag:
    expect(points).toEqual([
      { date: D.mar03, value: 10000, cashFlows: 0 },
      { date: D.mar05, value: 10000, cashFlows: 0 },
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
