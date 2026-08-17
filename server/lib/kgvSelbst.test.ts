/**
 * Selbst gerechnetes Trailing-KGV — KIMI-PEG-Audit R2 (Schattenphase).
 *
 * Der wichtigste Test ist der Halbjahres-Fall: EODHD legt für europäische
 * Halbjahres-Berichterstatter die Semester in die «Quartals»-Slots. Eine
 * stumpfe Summe der letzten 4 Einträge addiert dann ZWEI Jahre Gewinn und
 * halbiert das KGV — genau das zeigte der Beleg-Lauf: Median-Abweichung
 * zum Vendor-Feld ~1.9 an PA/SIX/LSE, aber 1.01 an US/XETRA (echte
 * Quartale). Die TTM-Summe muss deshalb nach Datum fenstern, nicht zählen.
 */

import { describe, it, expect } from "vitest";
import { kgvSelbst } from "./kgvSelbst";

const q = (datum: string, gewinn: number) => ({ datum, gewinn });

describe("kgvSelbst", () => {
  it("Quartals-Berichterstatter: TTM aus den letzten vier Quartalen", () => {
    const r = kgvSelbst({
      marktkapitalisierung: 120_000,
      quartalsGewinne: [
        q("2024-06-30", 999),   // älter als das Fenster — zählt nicht
        q("2024-09-30", 2_000), q("2024-12-31", 2_500),
        q("2025-03-31", 2_400), q("2025-06-30", 3_100), // TTM = 10'000
      ],
      jahresGewinn: 9_000,
    });
    expect(r.kgv).toBeCloseTo(12, 4);
    expect(r.hinweis).toContain("4 Berichtsperioden");
  });

  it("Halbjahres-Berichterstatter: nur die letzten ZWEI Semester zählen — nie zwei Jahre Gewinn", () => {
    const r = kgvSelbst({
      marktkapitalisierung: 100_000,
      quartalsGewinne: [
        q("2023-12-31", 4_800), q("2024-06-30", 5_200), // Vorjahr — draussen
        q("2024-12-31", 4_900), q("2025-06-30", 5_100), // TTM = 10'000
      ],
      jahresGewinn: null,
    });
    expect(r.kgv).toBeCloseTo(10, 4);
    expect(r.hinweis).toContain("2 Berichtsperioden");
  });

  it("deckt das Fenster kein volles Jahr, fällt die Rechnung aufs Geschäftsjahr zurück", () => {
    // Junger Titel: erst zwei Quartale — deren Summe wäre ein Halbjahres-KGV.
    const r = kgvSelbst({
      marktkapitalisierung: 120_000,
      quartalsGewinne: [q("2025-03-31", 3_000), q("2025-06-30", 3_000)],
      jahresGewinn: 10_000,
    });
    expect(r.kgv).toBeCloseTo(12, 4);
    expect(r.hinweis).toContain("Geschäftsjahr");
  });

  it("Verlust heisst kein KGV — kein Vorzeichenartefakt", () => {
    const r = kgvSelbst({
      marktkapitalisierung: 120_000,
      quartalsGewinne: [
        q("2024-09-30", 5_000), q("2024-12-31", -8_000),
        q("2025-03-31", 1_000), q("2025-06-30", 1_000), // TTM −1'000
      ],
      jahresGewinn: null,
    });
    expect(r.kgv).toBeNull();
    expect(r.hinweis).toContain("Verlust");
  });

  it("ohne Marktkapitalisierung oder Gewinnbasis gibt es keinen Wert", () => {
    const voll = [q("2024-09-30", 1), q("2024-12-31", 1), q("2025-03-31", 1), q("2025-06-30", 1)];
    expect(kgvSelbst({ marktkapitalisierung: null, quartalsGewinne: voll, jahresGewinn: null }).kgv).toBeNull();
    expect(kgvSelbst({ marktkapitalisierung: 0, quartalsGewinne: voll, jahresGewinn: null }).kgv).toBeNull();
    const leer = kgvSelbst({ marktkapitalisierung: 100, quartalsGewinne: [], jahresGewinn: null });
    expect(leer.kgv).toBeNull();
    expect(leer.hinweis).toContain("keine Gewinnbasis");
  });
});
