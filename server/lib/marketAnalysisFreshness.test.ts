import { describe, expect, it } from "vitest";
import { isFreshMarketAnalysis } from "./marketAnalysisFreshness";

describe("isFreshMarketAnalysis", () => {
  const now = new Date("2026-08-21T10:00:00.000Z");

  it("akzeptiert eine höchstens 36 Stunden alte Marktanalyse", () => {
    expect(isFreshMarketAnalysis({ generatedAt: new Date("2026-08-20T00:00:01.000Z") }, now)).toBe(true);
  });

  it("verwirft eine ältere Marktanalyse statt sie mit dem heutigen Datum zu kennzeichnen", () => {
    expect(isFreshMarketAnalysis({ generatedAt: new Date("2026-08-19T21:59:59.000Z") }, now)).toBe(false);
  });
});
