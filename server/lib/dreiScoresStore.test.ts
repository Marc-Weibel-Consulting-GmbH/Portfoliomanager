import { describe, expect, it } from "vitest";
import {
  istVorbereiteterScoreFrisch,
  MAX_VORBERECHNETES_SCORE_ALTER_MS,
  unqualifizierterDreiScore,
} from "./dreiScoresStore";

describe("Frische vorberechneter Drei-Scores", () => {
  const jetzt = new Date("2026-10-06T09:40:00.000Z");

  it("akzeptiert einen Score aus dem vorgesehenen Zwei-Stunden-Lauf mit Puffer", () => {
    const frisch = new Date(jetzt.getTime() - (MAX_VORBERECHNETES_SCORE_ALTER_MS - 1));
    expect(istVorbereiteterScoreFrisch(frisch, jetzt)).toBe(true);
  });

  it("verwirft einen alten Score statt ihn als aktuelles Signal auszugeben", () => {
    const veraltet = new Date(jetzt.getTime() - MAX_VORBERECHNETES_SCORE_ALTER_MS - 1);
    expect(istVorbereiteterScoreFrisch(veraltet, jetzt)).toBe(false);
    expect(istVorbereiteterScoreFrisch("2026-09-01 16:43:24", jetzt)).toBe(false);
  });

  it("verwirft fehlende oder nicht parsebare Zeitstempel", () => {
    expect(istVorbereiteterScoreFrisch(null, jetzt)).toBe(false);
    expect(istVorbereiteterScoreFrisch("keine-zeit", jetzt)).toBe(false);
  });

  it("modelliert eine lückenhafte Kursreihe explizit ohne Timing und Handelssignal", () => {
    const gesperrt = unqualifizierterDreiScore("NFLX");
    expect(gesperrt.timing).toBeNull();
    expect(gesperrt.signalScore).toBeNull();
    expect(gesperrt.signalLabel).toBeNull();
  });
});
