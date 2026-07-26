import { describe, it, expect } from "vitest";
import {
  enforceAssetClassBands,
  MULTI_ASSET_ALLOCATION,
  type SleevePosition,
  type SleeveAssetKey,
} from "../lib/multiAssetSleeve";

const AUSGEWOGEN = MULTI_ASSET_ALLOCATION.ausgewogen;

/** Baut Positionen mit den angegebenen Klassen-Gewichten (je Klasse eine Position). */
function positionen(gewichte: Partial<Record<SleeveAssetKey, number>>): SleevePosition[] {
  return Object.entries(gewichte).map(([cls, w]) => ({
    ticker: `${cls.toUpperCase()}X`,
    weight: w as number,
    assetType: cls === "equity" ? "stock" : "etf",
    assetClass: cls as SleeveAssetKey,
  }));
}

const gewichtVon = (ps: SleevePosition[], cls: SleeveAssetKey) =>
  ps.filter((p) => p.assetClass === cls).reduce((s, p) => s + p.weight, 0);

describe("enforceAssetClassBands", () => {
  it("lässt eine bereits passende Allokation unverändert", () => {
    const ps = positionen(AUSGEWOGEN);
    const meldungen = enforceAssetClassBands(ps, AUSGEWOGEN, 3);
    expect(meldungen).toEqual([]);
    expect(gewichtVon(ps, "equity")).toBeCloseTo(55, 1);
    expect(gewichtVon(ps, "bond")).toBeCloseTo(25, 1);
  });

  it("zieht driftende Klassen auf ihre Soll-Quote zurück", () => {
    const ps = positionen({ ...AUSGEWOGEN, equity: 70, bond: 10 });
    enforceAssetClassBands(ps, AUSGEWOGEN, 3);
    expect(gewichtVon(ps, "equity")).toBeCloseTo(55, 1);
    expect(gewichtVon(ps, "bond")).toBeCloseTo(25, 1);
  });

  it("bläht bei fehlenden Obligationen NICHT die Aktienquote auf", () => {
    // Genau der Fall aus dem Live-Portfolio: der Obligationen-Baustein fehlt.
    // Vorher wurde proportional auf 100 % hochskaliert — die Aktienquote sprang
    // damit von 55 % auf 73 % und lag weit ausserhalb ihrer Bandbreite.
    const ohneBonds = { ...AUSGEWOGEN };
    delete (ohneBonds as Record<string, number>).bond;
    const ps = positionen(ohneBonds);

    const meldungen = enforceAssetClassBands(ps, AUSGEWOGEN, 3);

    expect(gewichtVon(ps, "equity")).toBeLessThanOrEqual(55 + 3 + 0.01);
    expect(meldungen.some((m) => m.includes("Obligationen"))).toBe(true);
  });

  it("meldet den nicht platzierbaren Rest als Liquidität", () => {
    const ohneBonds = { ...AUSGEWOGEN };
    delete (ohneBonds as Record<string, number>).bond;
    const ps = positionen(ohneBonds);

    const meldungen = enforceAssetClassBands(ps, AUSGEWOGEN, 3);

    // Aufnahmefähig sind maximal 3 Prozentpunkte je vorhandener Klasse
    // (equity, commodity, gold, realestate, crypto) = 15 von 25 fehlenden.
    const summe = ps.reduce((s, p) => s + p.weight, 0);
    expect(summe).toBeGreaterThan(84);
    expect(summe).toBeLessThan(91);
    expect(meldungen.some((m) => m.includes("Liquidität"))).toBe(true);
  });

  it("hält jede Klasse innerhalb ihrer Bandbreite", () => {
    const ohneBonds = { ...AUSGEWOGEN };
    delete (ohneBonds as Record<string, number>).bond;
    const ps = positionen(ohneBonds);
    enforceAssetClassBands(ps, AUSGEWOGEN, 3);

    for (const cls of ["equity", "commodity", "gold", "realestate", "crypto"] as SleeveAssetKey[]) {
      const ist = gewichtVon(ps, cls);
      const soll = AUSGEWOGEN[cls];
      expect(ist).toBeGreaterThanOrEqual(Math.max(0, soll - 3) - 0.01);
      expect(ist).toBeLessThanOrEqual(soll + 3 + 0.01);
    }
  });

  it("ist robust gegen ein leeres Portfolio", () => {
    expect(enforceAssetClassBands([], AUSGEWOGEN, 3)).toEqual([]);
  });
});
