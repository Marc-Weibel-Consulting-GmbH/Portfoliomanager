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
import { kgvSelbst, kgvMitGegenprobe } from "./kgvSelbst";

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

/**
 * E4b: Die validierte Selbstrechnung wird Primärquelle (Beleg-Lauf #180001:
 * Median-Abweichung 1.02–1.06 auf allen sechs Börsen, 90 % Abdeckung, füllt
 * 12 Vendor-Lücken). Das Vendor-Feld bleibt Gegenprobe — bei Widerspruch
 * über Faktor 1.5 zählt die vorsichtigere Zahl (das höhere KGV).
 */
describe("kgvMitGegenprobe", () => {
  it("die Selbstrechnung führt, wenn die Gegenprobe sie bestätigt", () => {
    const r = kgvMitGegenprobe(20.1, 20.5, 18.0);
    expect(r.kgv).toBeCloseTo(20.1, 4);
    expect(r.hinweis).toBeNull();
  });

  it("fehlt die Selbstrechnung, trägt das Vendor-Feld (trailing vor forward)", () => {
    expect(kgvMitGegenprobe(null, 21.0, 18.0).kgv).toBeCloseTo(21.0, 4);
    expect(kgvMitGegenprobe(null, null, 18.0).kgv).toBeCloseTo(18.0, 4);
    expect(kgvMitGegenprobe(null, null, null).kgv).toBeNull();
  });

  it("bei Widerspruch über Faktor 1.5 zählt die vorsichtigere Zahl — mit Hinweis", () => {
    // Selbstrechnung 10, Vendor 23 (Sanofi-Klasse: Vendor-EPS veraltet) →
    // vorsichtiger ist das höhere KGV (weniger Punkte, Deckel greift eher).
    const hoch = kgvMitGegenprobe(10, 23, null);
    expect(hoch.kgv).toBeCloseTo(23, 4);
    expect(hoch.hinweis).toContain("widersprechen sich");
    const tief = kgvMitGegenprobe(30, 12, null);
    expect(tief.kgv).toBeCloseTo(30, 4);
    expect(tief.hinweis).toContain("widersprechen sich");
  });

  it("ohne Vendor-Feld läuft die Selbstrechnung ungeprüft — 12 Titel haben nur sie", () => {
    const r = kgvMitGegenprobe(15.5, null, null);
    expect(r.kgv).toBeCloseTo(15.5, 4);
    expect(r.hinweis).toContain("selbst gerechnet");
  });
});
