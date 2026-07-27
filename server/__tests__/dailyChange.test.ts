import { describe, it, expect } from "vitest";
import { berechneTagesveraenderung, letzterSchlussVor } from "../lib/dailyChange";

const KURSE = [
  { date: "2026-07-22", close: 100 },
  { date: "2026-07-23", close: 102 },
  { date: "2026-07-24", close: 105 },
];

describe("letzterSchlussVor", () => {
  it("nimmt den jüngsten Schluss vor dem Stichtag", () => {
    expect(letzterSchlussVor(KURSE, "2026-07-27")?.date).toBe("2026-07-24");
  });

  it("schliesst den Stichtag selbst aus", () => {
    // Läge der heutige Eintrag bereits vor, waere er identisch mit
    // currentPrice — die Veraenderung waere 0 % und damit das alte Symptom.
    expect(letzterSchlussVor([...KURSE, { date: "2026-07-27", close: 110 }], "2026-07-27")?.close).toBe(105);
  });

  it("ignoriert unbrauchbare Eintraege", () => {
    const mitMuell = [
      ...KURSE,
      { date: "2026-07-25", close: 0 },
      { date: "2026-07-26", close: NaN },
    ];
    expect(letzterSchlussVor(mitMuell, "2026-07-27")?.close).toBe(105);
  });

  it("liefert null ohne Historie", () => {
    expect(letzterSchlussVor([], "2026-07-27")).toBeNull();
  });
});

describe("berechneTagesveraenderung", () => {
  it("rechnet gegen den letzten Schluss", () => {
    const r = berechneTagesveraenderung(107.1, KURSE, "2026-07-27");
    expect(r.percent).toBeCloseTo(2, 6); // 105 → 107.10
    expect(r.basisDate).toBe("2026-07-24");
  });

  it("bildet auch Rueckgaenge ab", () => {
    expect(berechneTagesveraenderung(99.75, KURSE, "2026-07-27").percent).toBeCloseTo(-5, 6);
  });

  it("liefert null statt 0 %, wenn keine Basis vorliegt", () => {
    // Entscheidend: null heisst «unbekannt» und wird als «—» angezeigt.
    // Ein 0 % waere die Falschaussage, die vorher ueberall stand.
    expect(berechneTagesveraenderung(107, [], "2026-07-27").percent).toBeNull();
  });

  it("liefert null bei fehlendem oder unsinnigem Kurs", () => {
    expect(berechneTagesveraenderung(null, KURSE, "2026-07-27").percent).toBeNull();
    expect(berechneTagesveraenderung(0, KURSE, "2026-07-27").percent).toBeNull();
    expect(berechneTagesveraenderung(undefined, KURSE, "2026-07-27").percent).toBeNull();
  });

  it("ist 0 %, wenn sich der Kurs wirklich nicht bewegt hat", () => {
    expect(berechneTagesveraenderung(105, KURSE, "2026-07-27").percent).toBe(0);
  });
});
