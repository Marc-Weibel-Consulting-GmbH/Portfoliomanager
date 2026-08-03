/**
 * Ausfalltage im Regime-Verlauf.
 *
 * Anlass: In der 90-Tage-Sparkline standen vier Punkte mit Score exakt 0 und
 * Regime «Neutral» — am 19.07. (So), 22.07. (Mi), 24.07. (Fr) und 01.08. (Sa).
 * Zwei davon sind Handelstage, es waren also keine Feiertagslücken.
 *
 * Ursache: Jede der sieben Engines gibt bei fehlgeschlagenem Datenabruf
 * `score: 0` zurück. Fallen alle aus, ist die gewichtete Summe exakt 0 — und
 * 0 liegt über der Neutral-Schwelle von -0.1. Der Cron schrieb das ungeprüft
 * weg: ein misslungener Messversuch, gespeichert als selbstbewusste Messung.
 */

import { describe, it, expect } from "vitest";
import { istAusfallZeile, MIN_ABDECKUNG_SNAPSHOT } from "../routers/marketRegimeRouter";

const ENGINES = ["trend", "breadth", "volatility", "liquidity", "credit", "sentiment", "bubble"];

const alleNull = Object.fromEntries(ENGINES.map((k) => [k, 0]));

describe("istAusfallZeile — Altbestand ohne Abdeckungsangabe", () => {
  it("erkennt den Totalausfall: alle sieben Engine-Scores exakt 0", () => {
    expect(istAusfallZeile({ engineScores: alleNull })).toBe(true);
  });

  it("erkennt ihn auch, wenn die JSON-Spalte als String zurückkommt", () => {
    expect(istAusfallZeile({ engineScores: JSON.stringify(alleNull) })).toBe(true);
  });

  it("lässt eine echte Messung stehen, sobald eine einzige Engine ungleich 0 ist", () => {
    expect(istAusfallZeile({ engineScores: { ...alleNull, bubble: -0.05 } })).toBe(false);
  });

  it("lässt eine echte Messung stehen, deren Gesamtscore zufällig 0 ergibt", () => {
    // Trend +0.30 gegen Volatility -0.45: gewichtet 0.30*0.30 + (-0.45)*0.20 = 0.
    // Der Gesamtscore ist 0, die Messung aber gültig — deshalb darf die
    // Erkennung nicht am Gesamtscore hängen.
    const echt = { ...alleNull, trend: 0.3, volatility: -0.45 };
    expect(istAusfallZeile({ engineScores: echt })).toBe(false);
  });

  it("verwirft nichts, wenn die Spalte fehlt oder unlesbar ist", () => {
    expect(istAusfallZeile({})).toBe(false);
    expect(istAusfallZeile({ engineScores: "kein json" })).toBe(false);
    expect(istAusfallZeile({ engineScores: {} })).toBe(false);
  });
});

describe("istAusfallZeile — neue Zeilen mit Abdeckungsangabe", () => {
  it("verwirft eine Zeile unterhalb der Mindestabdeckung", () => {
    expect(istAusfallZeile({ engineScores: { ...alleNull, breadth: 0.4, _abdeckung: 0.70 } })).toBe(true);
  });

  it("behält eine Zeile, die die Mindestabdeckung genau erreicht", () => {
    expect(istAusfallZeile({ engineScores: { ...alleNull, trend: 0.4, _abdeckung: MIN_ABDECKUNG_SNAPSHOT } })).toBe(false);
  });

  it("die Abdeckungsangabe schlägt die Alt-Heuristik: gedeckt trotz lauter Nullen", () => {
    // Alle Engines liefern gültig 0 — unwahrscheinlich, aber kein Ausfall.
    expect(istAusfallZeile({ engineScores: { ...alleNull, _abdeckung: 1 } })).toBe(false);
  });
});

describe("Mindestabdeckung", () => {
  it("lässt den Ausfall der drei kleinen Engines zu, nicht aber den der Trend-Engine", () => {
    const GEWICHTE: Record<string, number> = {
      trend: 0.30, breadth: 0.15, volatility: 0.20,
      liquidity: 0.15, credit: 0.10, sentiment: 0.05, bubble: 0.05,
    };
    const summe = (aus: string[]) =>
      +Object.entries(GEWICHTE).filter(([k]) => !aus.includes(k)).reduce((s, [, w]) => s + w, 0).toFixed(4);

    expect(summe([])).toBe(1);
    // Credit + Sentiment + Bubble = 20 % Ausfall -> 80 % gedeckt, wird geschrieben.
    expect(summe(["credit", "sentiment", "bubble"])).toBe(0.8);
    expect(summe(["credit", "sentiment", "bubble"])).toBeGreaterThanOrEqual(MIN_ABDECKUNG_SNAPSHOT);
    // Trend allein = 30 % Ausfall -> 70 %, wird verworfen.
    expect(summe(["trend"])).toBe(0.7);
    expect(summe(["trend"])).toBeLessThan(MIN_ABDECKUNG_SNAPSHOT);
    // Volatility allein = 20 % Ausfall -> 80 %, wird geschrieben.
    expect(summe(["volatility"])).toBeGreaterThanOrEqual(MIN_ABDECKUNG_SNAPSHOT);
    // Totalausfall -> 0 %.
    expect(summe(ENGINES)).toBe(0);
  });
});
