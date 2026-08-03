/**
 * Gemessener und geschätzter Teil der Bewertung.
 *
 * Das PEG enthält eine Wachstumserwartung. Was 2022 für 2023 erwartet wurde,
 * ist nirgends gespeichert — der Faktor lässt sich also nicht rückwirkend
 * prüfen. Er bleibt live in der Bewertung (so gewollt), wird aber getrennt
 * ausgewiesen, damit sichtbar ist, welcher Teil der Zahl gemessen und welcher
 * geglaubt ist. `scoreGemessen` ist die Grösse, gegen die sich backtesten
 * lässt.
 */

import { describe, it, expect } from "vitest";
import { berechneBewertung } from "./dreiScores";

const STANDARD = {
  adjustedPeg: 1.2,
  kgv: 18,
  fcfRendite: 5,
  dividendenrendite: 3,
  kursBuchwert: 2.5,
  epsWachstumTTM: 8,
  epsWachstum5j: 6,
  sektor: "Industrials",
};

describe("Bewertung — gemessen gegen geschätzt", () => {
  it("weist beide Zahlen aus", () => {
    const b = berechneBewertung(STANDARD);
    expect(b.score).not.toBeNull();
    expect(b.scoreGemessen).not.toBeNull();
  });

  it("markiert das PEG als Schätzung, die übrigen Faktoren nicht", () => {
    const b = berechneBewertung(STANDARD);
    const peg = b.faktoren.find((f) => f.name.startsWith("PEG"));
    expect(peg?.geschaetzt).toBe(true);
    const fcf = b.faktoren.find((f) => f.name.startsWith("Free-Cash-Flow"));
    expect(fcf?.geschaetzt).toBeFalsy();
  });

  it("beziffert den geschätzten Anteil", () => {
    // Standardprofil: PEG 0.45, FCF 0.35, Dividende 0.20 — alle belegt.
    const b = berechneBewertung(STANDARD);
    expect(b.anteilGeschaetzt).toBeCloseTo(0.45, 2);
  });

  it("der gemessene Score ignoriert das PEG vollständig", () => {
    const mitGutemPeg = berechneBewertung({ ...STANDARD, adjustedPeg: 0.8 });
    const mitSchlechtemPeg = berechneBewertung({ ...STANDARD, adjustedPeg: 3.5 });
    // Der volle Score reagiert...
    expect(mitGutemPeg.score).not.toBe(mitSchlechtemPeg.score);
    // ...der gemessene nicht.
    expect(mitGutemPeg.scoreGemessen).toBe(mitSchlechtemPeg.scoreGemessen);
  });

  it("verteilt das Gewicht des PEG auf die übrigen Faktoren", () => {
    const b = berechneBewertung(STANDARD);
    // Ohne PEG bleiben FCF 0.35 und Dividende 0.20 — normiert 0.636 / 0.364.
    // Punkte: FCF 5 % → 62.5, Dividende 3 % → 60 (linear 0..5 bzw. 0..8).
    const fcf = b.faktoren.find((f) => f.name.startsWith("Free-Cash-Flow"))!.punkte!;
    const div = b.faktoren.find((f) => f.name === "Dividendenrendite")!.punkte!;
    const erwartet = (fcf * 0.35 + div * 0.20) / 0.55;
    expect(b.scoreGemessen).toBeCloseTo(erwartet, 1);
  });

  it("beim Banken-Profil ist alles gemessen", () => {
    // Kurs-Buchwert, KGV und Dividende beruhen auf berichteten Zahlen.
    const bank = berechneBewertung({ ...STANDARD, sektor: "Financial Services" });
    expect(bank.anteilGeschaetzt).toBe(0);
    expect(bank.scoreGemessen).toBe(bank.score);
  });

  it("gibt keinen gemessenen Score, wenn ohne PEG zu wenig übrig bleibt", () => {
    const duenn = berechneBewertung({
      ...STANDARD, fcfRendite: null, dividendenrendite: null,
    });
    // PEG allein trägt 0.45 von 1.0 — für den vollen Score zu wenig, und für
    // den gemessenen bleibt gar nichts.
    expect(duenn.scoreGemessen).toBeNull();
  });

  it("der gemessene Score kann bestehen, wo der volle scheitert", () => {
    // Ohne PEG sind nur 55 % des vorgesehenen Gewichts belegt — zu wenig für
    // den vollen Score. Der gemessene Score wird jedoch AUS SEINEN EIGENEN
    // Faktoren gebildet, und die sind vollständig da. Das ist gewollt: Für den
    // Backtest zählt, ob die berichteten Zahlen reichen, nicht ob eine
    // Schätzung fehlt, die es historisch ohnehin nie gab.
    const ohnePeg = berechneBewertung({ ...STANDARD, adjustedPeg: null });
    expect(ohnePeg.anteilGeschaetzt).toBe(0);
    expect(ohnePeg.score).toBeNull();
    expect(ohnePeg.scoreGemessen).not.toBeNull();
  });
});
