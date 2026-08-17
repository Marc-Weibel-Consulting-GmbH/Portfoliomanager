/**
 * Selbst gerechnetes Trailing-KGV — KIMI-PEG-Audit R2 (Schattenphase).
 *
 * Befund: 83 Gruppen verschiedener Firmen mit bit-identischem Vendor-KGV
 * (31 % der Zeilen) plus leere Highlights-Blöcke bei Schweizer Titeln
 * (Novartis: 79 Quartale Rohdaten, aber PE null). Die Rohdaten sind da —
 * nur die fertigen Vendor-Felder taugen nichts. Marktkapitalisierung ÷
 * TTM-Nettogewinn umgeht EPS-Definitions- und Aktienzahl-Fallen.
 */

import { describe, it, expect } from "vitest";
import { kgvSelbst } from "./kgvSelbst";

describe("kgvSelbst", () => {
  it("rechnet Marktkapitalisierung durch den TTM-Gewinn aus vier Quartalen", () => {
    const r = kgvSelbst({
      marktkapitalisierung: 120_000,
      quartalsGewinne: [2_000, 2_500, 2_400, 3_100], // chronologisch, TTM = 10'000
      jahresGewinn: 9_000,
    });
    expect(r.kgv).toBeCloseTo(12, 4);
    expect(r.hinweis).toContain("4 Quartalen");
  });

  it("nur die LETZTEN vier Quartale zählen", () => {
    const r = kgvSelbst({
      marktkapitalisierung: 100_000,
      quartalsGewinne: [999_999, 2_500, 2_500, 2_500, 2_500],
      jahresGewinn: null,
    });
    expect(r.kgv).toBeCloseTo(10, 4);
  });

  it("fällt ohne vier Quartale auf das letzte Geschäftsjahr zurück — mit Hinweis", () => {
    const r = kgvSelbst({
      marktkapitalisierung: 120_000,
      quartalsGewinne: [3_000, 3_000],
      jahresGewinn: 10_000,
    });
    expect(r.kgv).toBeCloseTo(12, 4);
    expect(r.hinweis).toContain("Geschäftsjahr");
  });

  it("Verlust heisst kein KGV — kein Vorzeichenartefakt", () => {
    const r = kgvSelbst({
      marktkapitalisierung: 120_000,
      quartalsGewinne: [5_000, -8_000, 1_000, 1_000], // TTM −1'000
      jahresGewinn: null,
    });
    expect(r.kgv).toBeNull();
    expect(r.hinweis).toContain("Verlust");
  });

  it("ohne Marktkapitalisierung oder Gewinnbasis gibt es keinen Wert", () => {
    expect(kgvSelbst({ marktkapitalisierung: null, quartalsGewinne: [1, 1, 1, 1], jahresGewinn: null }).kgv).toBeNull();
    expect(kgvSelbst({ marktkapitalisierung: 0, quartalsGewinne: [1, 1, 1, 1], jahresGewinn: null }).kgv).toBeNull();
    const leer = kgvSelbst({ marktkapitalisierung: 100, quartalsGewinne: [], jahresGewinn: null });
    expect(leer.kgv).toBeNull();
    expect(leer.hinweis).toContain("keine Gewinnbasis");
  });
});
