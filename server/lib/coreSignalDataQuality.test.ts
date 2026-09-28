import { describe, expect, it } from "vitest";
import { projectCoreSignalDataQuality, SIGNAL_GATE_MARKER } from "./coreSignalDataQuality";

describe("projectCoreSignalDataQuality", () => {
  it("marks blocked core signals for review with a visible reason", () => {
    const result = projectCoreSignalDataQuality({
      signalScore: null,
      reason: "Keine Kauf-/Verkaufsempfehlung – Datenbasis nicht freigegeben: Qualitäts-Score fehlt.",
      dataQualityNotes: "Identität geprüft",
    });
    expect(result.dataQualityStatus).toBe("pruefen");
    expect(result.dataQualityNotes).toContain("Identität geprüft");
    expect(result.dataQualityNotes).toContain(SIGNAL_GATE_MARKER);
    expect(result.dataQualityNotes).toContain("Qualitäts-Score fehlt");
  });

  it("removes only its own resolved warning and leaves other notes intact", () => {
    const result = projectCoreSignalDataQuality({
      signalScore: 71,
      dataQualityStatus: "pruefen",
      dataQualityNotes: `Identität geprüft · ${SIGNAL_GATE_MARKER} Timing fehlt`,
    });
    expect(result.dataQualityStatus).toBeUndefined();
    expect(result.dataQualityNotes).toBe("Identität geprüft");
  });

  it("returns the dynamic status contract when its only warning is resolved", () => {
    const result = projectCoreSignalDataQuality({
      signalScore: 71,
      dataQualityStatus: "pruefen",
      dataQualityNotes: `${SIGNAL_GATE_MARKER} Qualitäts-Score fehlt`,
    });
    expect(result.dataQualityStatus).toBeNull();
    expect(result.dataQualityNotes).toBeNull();
  });
});
