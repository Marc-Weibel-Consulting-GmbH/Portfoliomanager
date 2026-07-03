/**
 * CT-13 — Tests für computeDayChange (server/lib/dayChange.ts),
 * extrahiert aus dashboardRouter.getAggregatedMetrics (R-29).
 *
 * Hinweis zur Methodik: Die alte Inline-Logik («heute» = stocks.currentPrice
 * via calculatePortfolioValueFromData, «gestern» = historicalPrices-Close via
 * calculatePortfolioValueAtDate, beides async und DB-gebunden) liess sich
 * nicht praktikabel verhaltensneutral als pure Function extrahieren. Diese
 * Tests pinnen deshalb das NEUE Verhalten; das alte ist in den Kommentaren
 * («vorher (R-29)») dokumentiert.
 */

import { describe, it, expect } from "vitest";
import { computeDayChange } from "../lib/dayChange";

const NO_FX = new Map<string, number>();

describe("CT-13 computeDayChange — symmetrisches Skipping (R-29)", () => {
  it("Titel mit currentPrice aber OHNE Historie trägt nichts mehr zum Tagesgewinn bei", () => {
    // vorher (R-29): «heute» zählte NOHIST voll (stocks.currentPrice),
    // «gestern» gar nicht (keine historicalPrices-Zeile) — der komplette
    // Positionswert (10 000 CHF) erschien als Tagesgewinn.
    const result = computeDayChange(
      [
        { ticker: "AAA", shares: 10, currency: "CHF" },
        { ticker: "NOHIST", shares: 100, currency: "CHF" }, // keine Preiszeilen
      ],
      new Map([
        ["AAA", [
          { date: "2026-07-02", close: 102 },
          { date: "2026-07-01", close: 100 },
        ]],
      ]),
      NO_FX,
    );

    // Nur AAA zählt: 10 × (102 − 100) = +20 CHF auf Basis 10 × 100 = 1000.
    expect(result.dayChangeCHF).toBeCloseTo(20, 10);
    expect(result.baseValueCHF).toBeCloseTo(1000, 10);
    expect(result.dayChangePercent).toBeCloseTo(2, 10);
  });

  it("Titel mit nur EINEM Close (kein Vortag) wird beidseitig übersprungen", () => {
    const result = computeDayChange(
      [
        { ticker: "AAA", shares: 10, currency: "CHF" },
        { ticker: "ONEDAY", shares: 50, currency: "CHF" },
      ],
      new Map([
        ["AAA", [
          { date: "2026-07-02", close: 102 },
          { date: "2026-07-01", close: 100 },
        ]],
        ["ONEDAY", [{ date: "2026-07-02", close: 40 }]], // nur ein Handelstag
      ]),
      NO_FX,
    );

    expect(result.dayChangeCHF).toBeCloseTo(20, 10);
    expect(result.baseValueCHF).toBeCloseTo(1000, 10);
  });

  it("beide Seiten aus historicalPrices — stocks.currentPrice fliesst nicht ein", () => {
    // Reihen unsortiert und mit älteren Tagen: es zählen die zwei jüngsten
    // unterschiedlichen Daten (close(letzter) vs. close(vorletzter Handelstag)).
    const result = computeDayChange(
      [{ ticker: "AAA", shares: 4, currency: "CHF" }],
      new Map([
        ["AAA", [
          { date: "2026-06-29", close: 90 },
          { date: "2026-07-02", close: 110 },
          { date: "2026-07-01", close: 100 },
          { date: "2026-06-30", close: 95 },
        ]],
      ]),
      NO_FX,
    );

    expect(result.dayChangeCHF).toBeCloseTo(4 * 10, 10);
    expect(result.dayChangePercent).toBeCloseTo(10, 10);
  });

  it("EIN FX-Satz pro Währung für beide Seiten — reine Kursbewegung", () => {
    // vorher (R-29): FX von heute vs. FX von gestern wurden gemischt — eine
    // FX-Bewegung ohne Kursänderung erschien als Tagesveränderung.
    const result = computeDayChange(
      [{ ticker: "USD1", shares: 10, currency: "USD" }],
      new Map([
        ["USD1", [
          { date: "2026-07-02", close: 200 },
          { date: "2026-07-01", close: 190 },
        ]],
      ]),
      new Map([["USD", 0.8]]),
    );

    expect(result.dayChangeCHF).toBeCloseTo(10 * 10 * 0.8, 10);
    expect(result.baseValueCHF).toBeCloseTo(10 * 190 * 0.8, 10);
  });

  it("fehlender FX-Satz: Titel wird beidseitig übersprungen (kein 1:1-Mix)", () => {
    const result = computeDayChange(
      [{ ticker: "EUR1", shares: 10, currency: "EUR" }],
      new Map([
        ["EUR1", [
          { date: "2026-07-02", close: 50 },
          { date: "2026-07-01", close: 49 },
        ]],
      ]),
      NO_FX, // kein EUR-Satz
    );

    expect(result.dayChangeCHF).toBe(0);
    expect(result.baseValueCHF).toBe(0);
    expect(result.dayChangePercent).toBe(0);
  });

  it("keine beitragenden Titel → 0/0/0 statt Division durch 0", () => {
    const result = computeDayChange(
      [{ ticker: "NOHIST", shares: 100, currency: "CHF" }],
      new Map(),
      NO_FX,
    );

    expect(result).toEqual({ dayChangeCHF: 0, baseValueCHF: 0, dayChangePercent: 0 });
  });
});
