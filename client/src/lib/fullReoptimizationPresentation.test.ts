import { describe, expect, it } from "vitest";
import {
  formatFullReoptimizationFraction,
  getFullReoptimizationReturnEvidence,
} from "./fullReoptimizationPresentation";

describe("formatFullReoptimizationFraction", () => {
  it("formatiert eine als Dezimalzahl zurückgegebene Volatilität als Prozentwert", () => {
    expect(formatFullReoptimizationFraction(0.1636)).toBe("16.4%");
  });

  it("kennzeichnet eine 1,9-jährige Teilreihe ausdrücklich als unzureichend für einen Zehnjahresvergleich", () => {
    expect(getFullReoptimizationReturnEvidence({
      requestedLookbackDays: 2520,
      historicalAnnualizedReturn: 0.141,
      basis: { jahreMin: 1.9, jahreMedian: 3.2, gemeinsameTage: 487 },
    })).toMatchObject({
      label: "Historische Rendite p.a. (hypothetisch)",
      value: "14.1%",
      requestedYears: 10,
      hasRequestedHistory: false,
      basisText: "1.9 Jahre mindestens · 3.2 Jahre Median · 487 gemeinsame Handelstage",
    });
  });

  it("akzeptiert eine vollständig kalenderabgedeckte Dreijahresbasis trotz international weniger gemeinsamer Handelstage", () => {
    expect(getFullReoptimizationReturnEvidence({
      requestedLookbackDays: 756,
      historicalAnnualizedReturn: 0.123,
      hasFullRequestedWindow: true,
      basis: { jahreMin: 3.0, jahreMedian: 3.1, gemeinsameTage: 709 },
    }).hasRequestedHistory).toBe(true);
  });
});
