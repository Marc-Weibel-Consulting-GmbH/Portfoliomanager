import { describe, expect, it } from "vitest";
import { assessSignalDataQuality } from "./signalDataQualityGate";

describe("assessSignalDataQuality", () => {
  const complete = {
    rawPriceRows: 252,
    qualityScore: 72,
    valuationScore: 58,
    timingScore: 63,
  };

  it("releases a three-score signal only with a full raw-price and score basis", () => {
    expect(assessSignalDataQuality(complete)).toEqual({ allowed: true, reasons: [] });
  });

  it("blocks a buy/sell signal when the 52-week price basis is incomplete", () => {
    expect(assessSignalDataQuality({ ...complete, rawPriceRows: 249 })).toEqual({
      allowed: false,
      reasons: ["Rohkursreihe nur 249 Handelstage (nötig mindestens 250 für 52-Wochen-Timing)"],
    });
  });

  it("blocks rather than falling back to a legacy blended signal when a required component is missing", () => {
    expect(assessSignalDataQuality({ ...complete, timingScore: null })).toEqual({
      allowed: false,
      reasons: ["Timing-Score nicht berechenbar"],
    });
    expect(assessSignalDataQuality({ ...complete, qualityScore: null, valuationScore: null })).toEqual({
      allowed: false,
      reasons: ["Qualitäts-Score nicht berechenbar", "Bewertungs-Score nicht berechenbar"],
    });
  });
});
