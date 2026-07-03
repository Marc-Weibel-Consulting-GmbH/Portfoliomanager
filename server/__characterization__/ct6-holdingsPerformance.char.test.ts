/**
 * CT-6 — Charakterisierungstests für calculateHoldingsPerformance
 * (server/performanceCalculations.ts)
 *
 * Pinnt Kostenbasis / unrealisierte Gewinne inkl. Oversell-Randfall (R-20),
 * Fee-Doppelzählung (R-02) und Sortier-Abhängigkeit (R-06-Klasse).
 * Erwartungswerte wurden durch AUSFÜHREN des aktuellen Codes ermittelt.
 */

import { describe, it, expect } from "vitest";
import { calculateHoldingsPerformance } from "../performanceCalculations";
import { S1, S3_MANUAL, S3_CSV, S4, S6, S9_EMPTY, S9_NO_PRICE, S10, S16 } from "./fixtures";

describe("CT-6 calculateHoldingsPerformance", () => {
  it("Szenario 1: Nur-Kauf, eine Position, keine FX", () => {
    const holdings = calculateHoldingsPerformance(S1.transactions, S1.currentPrices);
    expect(holdings).toEqual([
      {
        ticker: "NESN",
        shares: 100,
        avgCostBasis: 95,
        currentPrice: 100,
        currentValue: 10000,
        unrealizedGain: 500,
        unrealizedGainPercent: 5.263157894736842,
        totalInvested: 9500,
      },
    ]);
  });

  it("Szenario 3: Fees — manueller Pfad doppelt gezählt, CSV-Pfad einfach (R-02)", () => {
    const [manual] = calculateHoldingsPerformance(S3_MANUAL.transactions, S3_MANUAL.currentPrices);
    const [csv] = calculateHoldingsPerformance(S3_CSV.transactions, S3_CSV.currentPrices);

    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-02:
    // Manuell: totalAmountCHF enthält die Fees bereits (9'550), trotzdem wird
    // fees (50) erneut addiert → Kostenbasis 96.00 statt 95.50.
    expect(manual.totalInvested).toBe(9600);
    expect(manual.avgCostBasis).toBe(96);
    expect(manual.unrealizedGain).toBe(400);
    // CSV: totalAmountCHF exkl. Fees (9'500) + 50 → 9'550 (fachlich korrekt):
    expect(csv.totalInvested).toBe(9550);
    expect(csv.avgCostBasis).toBe(95.5);
    expect(csv.unrealizedGain).toBe(450);
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-02:
    // Gleicher Trade, pfadabhängig unterschiedliche Kostenbasis:
    expect(manual.avgCostBasis).not.toBe(csv.avgCostBasis);
  });

  it("Szenario 4: Mehrfach-Verkauf — Endbestand 0, Position verschwindet", () => {
    // Kauf 100@10 → Verkauf 100@20 → Kauf 100@30 → Verkauf 100@30.
    // Der Phantomgewinn +1'000 (R-03) entsteht im Verkaufs-Zweig von db.ts
    // (CT-5, hier nicht testbar); dieses Modul selbst schliesst die Position sauber:
    const holdings = calculateHoldingsPerformance(S4.transactions, S4.currentPrices);
    expect(holdings).toEqual([]);
  });

  it("Szenario 6: USD-Position ohne totalAmountCHF — Lokalbetrag als CHF (R-15)", () => {
    const holdings = calculateHoldingsPerformance(S6.transactions, S6.currentPrices);
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-15 (+ R-10):
    // Fallback totalAmount (2'000 USD) wird unkonvertiert als CHF-Kostenbasis
    // geführt; currentPrice 210 USD ebenso 1:1 als CHF.
    expect(holdings).toEqual([
      {
        ticker: "AAPL",
        shares: 10,
        avgCostBasis: 200,
        currentPrice: 210,
        currentValue: 2100,
        unrealizedGain: 100,
        unrealizedGainPercent: 5,
        totalInvested: 2000,
      },
    ]);
  });

  it("Szenario 9: leer / Titel ohne aktuellen Kurs — keine NaN, aber stiller Nullwert", () => {
    expect(calculateHoldingsPerformance(S9_EMPTY.transactions, S9_EMPTY.currentPrices)).toEqual([]);

    const [noPrice] = calculateHoldingsPerformance(S9_NO_PRICE.transactions, S9_NO_PRICE.currentPrices);
    // Fehlender Kurs → Position «CHF 0» ohne Hinweis (vgl. U-13):
    expect(noPrice.currentPrice).toBe(0);
    expect(noPrice.currentValue).toBe(0);
    expect(noPrice.unrealizedGain).toBe(-1000);
    expect(noPrice.unrealizedGainPercent).toBe(-100);
    for (const v of [noPrice.avgCostBasis, noPrice.unrealizedGainPercent]) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it("Szenario 10: Oversell 150 von 100 — Position verschwindet stillschweigend (R-20)", () => {
    const holdings = calculateHoldingsPerformance(S10.transactions, S10.currentPrices);
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-20:
    // sellRatio = 150/100 = 1.5 → Kostenbasis wird auf −500 gedreht und die
    // Position endet bei −50 Aktien; wegen `shares <= 0 → continue` wird die
    // Short-Position (Wert −600, vgl. CT-1/buildValuePoints) komplett
    // verschluckt statt validiert.
    expect(holdings).toEqual([]);
  });

  it("Szenario 16: DESC-Input liefert ANDERE Holdings als ASC (R-06-Klasse)", () => {
    const asc = calculateHoldingsPerformance(S16.asc, S16.currentPrices);
    const desc = calculateHoldingsPerformance(S16.desc, S16.currentPrices);

    // ASC (chronologisch): Kauf 100, Verkauf 50 → Bestand 50, Kostenbasis 500.
    expect(asc).toEqual([
      {
        ticker: "ORD",
        shares: 50,
        avgCostBasis: 10,
        currentPrice: 12,
        currentValue: 600,
        unrealizedGain: 100,
        unrealizedGainPercent: 20,
        totalInvested: 500,
      },
    ]);

    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-06 (Klasse) / R-20:
    // DESC (wie batchGetPortfolioTransactions liefert): der Verkauf wird VOR dem
    // Kauf verarbeitet und mangels Bestand (`holding.shares > 0` false) ignoriert
    // → Bestand 100 statt 50, Kostenbasis 1'000 — der Verkauf ist verschwunden.
    expect(desc).toEqual([
      {
        ticker: "ORD",
        shares: 100,
        avgCostBasis: 10,
        currentPrice: 12,
        currentValue: 1200,
        unrealizedGain: 200,
        unrealizedGainPercent: 20,
        totalInvested: 1000,
      },
    ]);
    expect(desc).not.toEqual(asc);
  });
});
