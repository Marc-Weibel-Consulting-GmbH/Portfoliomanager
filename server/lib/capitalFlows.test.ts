import { describe, it, expect } from "vitest";
import { classifySectorFlow, percentileRank, cotStance } from "./capitalFlows";

describe("classifySectorFlow", () => {
  it("erhöhtes Volumen + steigender Kurs = Zufluss", () => {
    expect(classifySectorFlow(1.25, 3.2)).toBe("zufluss");
  });
  it("erhöhtes Volumen + fallender Kurs = Abfluss (Distribution)", () => {
    expect(classifySectorFlow(1.3, -2.5)).toBe("abfluss");
  });
  it("normales Volumen = neutral, egal welche Richtung", () => {
    expect(classifySectorFlow(0.95, 5)).toBe("neutral");
    expect(classifySectorFlow(1.0, -4)).toBe("neutral");
  });
  it("erhöhtes Volumen ohne klare Richtung = neutral", () => {
    expect(classifySectorFlow(1.2, 0.5)).toBe("neutral");
  });
});

describe("percentileRank", () => {
  it("Maximum ≈ oberes Perzentil, Minimum ≈ unteres", () => {
    const s = [10, 20, 30, 40, 50];
    expect(percentileRank(50, s)).toBeGreaterThanOrEqual(85);
    expect(percentileRank(10, s)).toBeLessThanOrEqual(15);
  });
  it("Median liegt um 50", () => {
    expect(percentileRank(30, [10, 20, 30, 40, 50])).toBe(50);
  });
  it("leere Serie ⇒ 50 (neutral)", () => {
    expect(percentileRank(5, [])).toBe(50);
  });
  it("funktioniert mit negativen Netto-Positionen (z.B. 10Y-Treasuries)", () => {
    const s = [-900000, -850000, -880000, -820000, -800000];
    expect(percentileRank(-900000, s)).toBeLessThanOrEqual(15);
    expect(percentileRank(-800000, s)).toBeGreaterThanOrEqual(85);
  });
});

describe("cotStance", () => {
  it("mappt Perzentile auf die fünf Einordnungen", () => {
    expect(cotStance(90)).toBe("sehr bullisch positioniert");
    expect(cotStance(65)).toBe("bullisch positioniert");
    expect(cotStance(50)).toBe("neutral positioniert");
    expect(cotStance(30)).toBe("bärisch positioniert");
    expect(cotStance(10)).toBe("sehr bärisch positioniert");
  });
});
