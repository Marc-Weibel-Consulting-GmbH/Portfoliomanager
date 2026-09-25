import { describe, expect, it } from "vitest";
import {
  assessHistoricalWindowCoverage,
  hasSufficientCommonReturnCoverage,
} from "./historicalWindowCoverage";

describe("assessHistoricalWindowCoverage", () => {
  it("weist eine ausdrücklich dreijährige Historie zurück, wenn eine Preisreihe erst nach dem erforderlichen Start beginnt", () => {
    const evidence = assessHistoricalWindowCoverage({
      historyDates: ["2024-07-01", "2024-07-02", "2026-09-07"],
      requiredStartDate: "2023-09-08",
      requiredEndDate: "2026-09-08",
    });

    expect(evidence.hasFullRequestedWindow).toBe(false);
    expect(evidence.reason).toBe("starts_too_late");
  });

  it("akzeptiert übliche Feiertagslücken an den Rändern einer vollständigen Dreijahresbasis", () => {
    const evidence = assessHistoricalWindowCoverage({
      historyDates: ["2023-09-11", "2024-01-02", "2025-01-02", "2026-09-04"],
      requiredStartDate: "2023-09-08",
      requiredEndDate: "2026-09-08",
      maxBoundaryGapCalendarDays: 5,
    });

    expect(evidence.hasFullRequestedWindow).toBe(true);
    expect(evidence.reason).toBeNull();
  });

  it("verwirft eine scheinbar vollständige Fünfjahresbasis, wenn nach FX- und Kalenderabgleich nur 195 gemeinsame Renditetage bleiben", () => {
    expect(hasSufficientCommonReturnCoverage({
      requestedLookbackDays: 1260,
      commonReturnDays: 195,
    })).toBe(false);
  });

  it("akzeptiert internationale Fünfjahresreihen mit realistischen Feiertagsdifferenzen", () => {
    expect(hasSufficientCommonReturnCoverage({
      requestedLookbackDays: 1260,
      commonReturnDays: 1129,
    })).toBe(true);
  });
});
