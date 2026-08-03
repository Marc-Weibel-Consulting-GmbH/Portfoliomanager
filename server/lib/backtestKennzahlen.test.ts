/**
 * Zielgrössen der Lernschleife.
 *
 * Der Kern der Umstellung ist die Behauptung, dass die Trefferquote die falsche
 * Zielgrösse ist. Der erste Test hier belegt genau das: zwei Reihen, gleiche
 * Trefferquote, entgegengesetztes Ergebnis.
 */

import { describe, it, expect } from "vitest";
import { kennzahlen, rundlaufKostenPct, HANDELSTAGE_PRO_JAHR } from "./backtestKennzahlen";
import { STANDARD_KOSTEN } from "./kostenModell";

describe("rundlaufKostenPct", () => {
  it("rechnet Kauf und Verkauf, mit gemitteltem Stempel", () => {
    // Je Seite: 40 Courtage + 5 halbe Spanne + (7.5+15)/2 = 11.25 Stempel = 56.25 bps
    // Rundlauf: 112.5 bps = 1.125 %
    expect(rundlaufKostenPct(STANDARD_KOSTEN)).toBeCloseTo(1.125, 6);
  });

  it("ist bei kostenfreien Sätzen null", () => {
    expect(rundlaufKostenPct({
      courtageBps: 0, mindestcourtageCHF: 0, stempelInlandBps: 0,
      stempelAuslandBps: 0, halbeSpanneBps: 0, terBps: 25,
    })).toBe(0);
  });
});

describe("kennzahlen", () => {
  it("trennt gleiche Trefferquote nach tatsächlichem Ertrag", () => {
    // Beide: 3 von 4 richtig (75 %). Die erste Reihe verdient, die zweite nicht:
    // ein einziger grosser Verlust frisst drei kleine Gewinne.
    const gut = kennzahlen([2, 2, 2, -1], 3, 4, 20);
    const schlecht = kennzahlen([1, 1, 1, -9], 3, 4, 20);

    expect(gut.hitRate).toBe(75);
    expect(schlecht.hitRate).toBe(75);

    expect(gut.mittlereRendite).toBeCloseTo(1.25, 6);
    expect(schlecht.mittlereRendite).toBeCloseTo(-1.5, 6);
    expect(gut.sharpe).toBeGreaterThan(0);
    expect(schlecht.sharpe).toBeLessThan(0);
  });

  it("hält die Trefferquote als Berichtsgrösse fest", () => {
    const k = kennzahlen([1, -1, 1], 2, 3, 10);
    expect(k.correct).toBe(2);
    expect(k.total).toBe(3);
    expect(k.hitRate).toBeCloseTo(66.667, 3);
    expect(k.n).toBe(3);
  });

  it("annualisiert, damit ein längerer Horizont nicht allein durch Grösse gewinnt", () => {
    const reihe = [3, -1, 2, -2, 4];
    const kurz = kennzahlen(reihe, 3, 5, 5);
    const lang = kennzahlen(reihe, 3, 5, 20);
    // Dieselbe Reihe über den kürzeren Horizont ist doppelt so gut:
    // sqrt(252/5) / sqrt(252/20) = 2.
    expect(kurz.sharpe / lang.sharpe).toBeCloseTo(2, 6);
    expect(lang.sharpe).toBeCloseTo(
      (lang.mittlereRendite / lang.streuung) * Math.sqrt(HANDELSTAGE_PRO_JAHR / 20),
      6,
    );
  });

  it("gibt 0 statt Division durch null, wenn alle Renditen gleich sind", () => {
    const k = kennzahlen([2, 2, 2], 3, 3, 20);
    expect(k.streuung).toBe(0);
    expect(k.sharpe).toBe(0);
    expect(k.mittlereRendite).toBe(2);
  });

  it("liefert bei einem einzelnen Signal keine Streuungsschätzung", () => {
    const k = kennzahlen([5], 1, 1, 20);
    expect(k.n).toBe(1);
    expect(k.sharpe).toBe(0);
  });

  it("verträgt leere Eingaben", () => {
    const k = kennzahlen([], 0, 0, 20);
    expect(k).toEqual({
      n: 0, correct: 0, total: 0, hitRate: 0,
      mittlereRendite: 0, streuung: 0, sharpe: 0,
    });
  });

  it("ignoriert nicht-endliche Werte", () => {
    const k = kennzahlen([1, NaN, 3, Infinity], 2, 4, 20);
    expect(k.n).toBe(2);
    expect(k.mittlereRendite).toBe(2);
    // Die Trefferquote zählt weiter alle gemeldeten Signale.
    expect(k.total).toBe(4);
  });
});
