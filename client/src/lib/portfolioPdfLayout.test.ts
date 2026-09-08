import { describe, expect, it } from "vitest";
import { getPortfolioPdfLayout } from "./portfolioPdfLayout";

describe("getPortfolioPdfLayout", () => {
  it("setzt bei sieben Kennzahlkacheln den Chart erst unterhalb der dritten Kachelreihe", () => {
    const layout = getPortfolioPdfLayout({ kpiCount: 7, allocationRowCount: 7 });

    expect(layout.kpiRows).toBe(3);
    expect(layout.chartY).toBeGreaterThanOrEqual(layout.kpiBottom + 6);
    expect(layout.allocationY).toBeGreaterThan(layout.chartY + layout.chartHeight);
    expect(layout.qualityTop).toBeGreaterThan(layout.allocationY + 42);
    expect(layout.qualityTop + 28).toBeLessThan(288);
  });
});
