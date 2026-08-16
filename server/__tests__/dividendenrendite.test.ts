/**
 * Einheit der Dividendenrendite.
 *
 * Anlass: In `stocks.dividendYield` standen Werte wie 151 für ABB (1.51 %),
 * 376 für Nestlé (3.76 %) und 31 für Apple (0.31 %) — alle exakt hundertfach
 * zu hoch.
 *
 * Ursache: `eodhdApi.ts:198` rechnet den EODHD-Bruch korrekt in Prozent um
 * (0.0151 → 1.51). `signalScoreRefreshScheduled` multiplizierte denselben,
 * bereits umgerechneten Wert erneut mit 100.
 *
 * Die sichtbarste Folge war nicht die Anzeige, sondern der Signal-Score:
 * `calcSignalScore` erwartete einen Bruch (Schwelle 0.06 = 6 %) und bekam
 * Prozent. Jeder Titel mit irgendeiner Ausschüttung überschritt damit die
 * oberste Stufe und erhielt +15 Punkte — live nachweisbar an den gespeicherten
 * Begründungen: «Sehr hohe Dividende (151.0%)» bei ABB, «(31.0%)» bei Apple.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  alsProzent,
  eodhdBruchZuProzent,
  istPlausibleRendite,
  PLAUSIBEL_MAX_PROZENT,
} from "../lib/dividendenrendite";
import { calcSignalScore } from "../scheduled/signalScoreRefreshScheduled";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("istPlausibleRendite", () => {
  it("akzeptiert reale Renditen", () => {
    for (const v of [0, 0.31, 1.51, 3.76, 8, 15, PLAUSIBEL_MAX_PROZENT]) {
      expect(istPlausibleRendite(v)).toBe(true);
    }
  });

  it("verwirft die hundertfach zu hohen Altwerte", () => {
    for (const v of [31, 151, 235, 368, 376, 380]) {
      expect(istPlausibleRendite(v)).toBe(false);
    }
  });

  it("verwirft fehlende und unsinnige Werte", () => {
    expect(istPlausibleRendite(null)).toBe(false);
    expect(istPlausibleRendite(undefined)).toBe(false);
    expect(istPlausibleRendite(NaN)).toBe(false);
    expect(istPlausibleRendite(-1)).toBe(false);
  });
});

describe("alsProzent", () => {
  it("lässt einen bereits korrekten Wert unverändert", () => {
    expect(alsProzent(1.51)).toBe(1.51);
    expect(alsProzent(0.31)).toBe(0.31);
    expect(alsProzent(0)).toBe(0);
  });

  it("repariert die echten Altwerte aus der Produktionsdatenbank", () => {
    expect(alsProzent(151)).toBeCloseTo(1.51, 6);   // ABBN.SW
    expect(alsProzent(376)).toBeCloseTo(3.76, 6);   // NESN.SW
    expect(alsProzent(368)).toBeCloseTo(3.68, 6);   // NOVN.SW
    expect(alsProzent(235)).toBeCloseTo(2.35, 6);   // KO.US
    expect(alsProzent(31)).toBeCloseTo(0.31, 6);    // AAPL.US
  });

  it("verwirft, was auch geteilt keine Rendite sein kann", () => {
    expect(alsProzent(90000)).toBeNull();
  });

  it("verwirft fehlende Werte, statt sie zu 0 zu machen", () => {
    expect(alsProzent(null)).toBeNull();
    expect(alsProzent(undefined)).toBeNull();
    expect(alsProzent(-5)).toBeNull();
  });
});

describe("eodhdBruchZuProzent", () => {
  it("rechnet nur den dokumentierten EODHD-Rohbruch einmalig in Prozent um", () => {
    expect(eodhdBruchZuProzent(0.0024)).toBeCloseTo(0.24, 10);
    expect(eodhdBruchZuProzent(0.0002)).toBeCloseTo(0.02, 10);
  });

  it("verwirft fehlende oder ungültige Rohwerte statt ihre Einheit zu raten", () => {
    expect(eodhdBruchZuProzent(null)).toBeNull();
    expect(eodhdBruchZuProzent(-0.01)).toBeNull();
    expect(eodhdBruchZuProzent(Number.NaN)).toBeNull();
  });
});

describe("calcSignalScore — Dividendenstufen in Prozent", () => {
  const basis = { pe: null, peg: null, priceVs52wLow: null, ytdPerf: null };
  const nur = (divYield: number | null) => calcSignalScore({ ...basis, divYield });

  it("Apples 0.31 % erreicht keine Dividendenstufe", () => {
    const r = nur(0.31);
    expect(r.reasons.some((g) => g.includes("Dividende"))).toBe(false);
    expect(r.score).toBe(50);
  });

  it("ABBs 1.51 % erreicht keine Dividendenstufe", () => {
    expect(nur(1.51).score).toBe(50);
  });

  it("Nestlés 3.76 % ergibt «Gute Dividende» (+6)", () => {
    const r = nur(3.76);
    expect(r.score).toBe(56);
    expect(r.reasons.join(" ")).toContain("Gute Dividende (3.8%)");
  });

  it("5 % ergibt «Hohe Dividende» (+12)", () => {
    expect(nur(5).score).toBe(62);
  });

  it("7 % ergibt «Sehr hohe Dividende» (+15)", () => {
    const r = nur(7);
    expect(r.score).toBe(65);
    expect(r.reasons.join(" ")).toContain("Sehr hohe Dividende (7.0%)");
  });

  it("der Begründungstext gibt den Wert unverfälscht wieder", () => {
    // Vorher stand hier `(divYield * 100)`, was aus 1.51 die Angabe «151.0%»
    // machte — genau der Text, der live in `aiReason` steht.
    expect(nur(7).reasons.join(" ")).not.toContain("700");
  });

  it("keine Ausschüttung bleibt ein leichter Abzug", () => {
    expect(nur(0).score).toBe(48);
  });

  it("fehlende Angabe wirkt sich nicht aus", () => {
    expect(nur(null).score).toBe(50);
  });
});

describe("Regression: der Fehler selbst", () => {
  it("ein Rohwert von 151 darf nicht mehr in die oberste Stufe fallen", () => {
    // Vor dem Fix: 151 > 0.06 -> +15 Punkte, für jeden Titel mit Dividende.
    // Der Wert wird jetzt an der Quelle repariert und erreicht die Funktion
    // gar nicht mehr in dieser Form.
    const repariert = alsProzent(151);
    expect(repariert).toBeCloseTo(1.51, 6);
    expect(calcSignalScore({ pe: null, peg: null, priceVs52wLow: null, ytdPerf: null, divYield: repariert }).score)
      .toBe(50);
  });
});
