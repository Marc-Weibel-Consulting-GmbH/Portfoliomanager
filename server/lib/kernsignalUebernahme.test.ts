import { describe, it, expect } from "vitest";
import { signalFelderAusCache, alertEntscheid, ALERT_SCORE_SPRUNG } from "./kernsignalUebernahme";

describe("signalFelderAusCache", () => {
  it("übernimmt Score (gerundet) und Typ aus der Cache-Zeile", () => {
    expect(signalFelderAusCache({ combinedScore: "63.4", signalType: "buy", signalStrength: "strong" }))
      .toEqual({ signalScore: 63, signalType: "buy" });
  });

  it("ohne Cache-Zeile oder ohne Score gibt es ehrlich kein Signal", () => {
    expect(signalFelderAusCache(undefined)).toEqual({ signalScore: null, signalType: null });
    expect(signalFelderAusCache(null)).toEqual({ signalScore: null, signalType: null });
    expect(signalFelderAusCache({ combinedScore: null, signalType: "buy", signalStrength: "strong" }))
      .toEqual({ signalScore: null, signalType: null });
    expect(signalFelderAusCache({ combinedScore: "abc", signalType: "buy", signalStrength: "weak" }))
      .toEqual({ signalScore: null, signalType: null });
  });

  it("unbekannter Typ fällt auf hold, Score wird auf 0–100 geklemmt", () => {
    expect(signalFelderAusCache({ combinedScore: 104, signalType: "??", signalStrength: null }))
      .toEqual({ signalScore: 100, signalType: "hold" });
  });
});

describe("alertEntscheid", () => {
  const basis = {
    typ: "buy", staerke: "strong", score: 78,
    vorherTyp: "hold", vorherScore: 55,
    tageSeitLetztemAlert: Infinity, cooldownTage: 7,
  };

  it("meldet «stark» beim Übergang in den starken guten Zustand", () => {
    expect(alertEntscheid(basis)).toBe("stark");
  });

  it("meldet «schwach» bei starkem sell-Zustand", () => {
    expect(alertEntscheid({ ...basis, typ: "sell", score: 22, vorherTyp: "hold" })).toBe("schwach");
  });

  it("meldet nichts ohne starke Ausprägung oder ohne Score", () => {
    expect(alertEntscheid({ ...basis, staerke: "moderate" })).toBeNull();
    expect(alertEntscheid({ ...basis, score: null })).toBeNull();
    expect(alertEntscheid({ ...basis, typ: "hold" })).toBeNull();
  });

  it("respektiert den Cooldown", () => {
    expect(alertEntscheid({ ...basis, tageSeitLetztemAlert: 3 })).toBeNull();
    expect(alertEntscheid({ ...basis, tageSeitLetztemAlert: 8 })).toBe("stark");
    expect(alertEntscheid({ ...basis, tageSeitLetztemAlert: 3, cooldownTage: 0 })).toBe("stark");
  });

  it("ohne Übergang keine Wiederholungs-Meldung", () => {
    expect(alertEntscheid({ ...basis, vorherTyp: "buy", vorherScore: 78 })).toBeNull();
    expect(alertEntscheid({ ...basis, vorherTyp: "buy", vorherScore: 78 - ALERT_SCORE_SPRUNG })).toBe("stark");
    expect(alertEntscheid({ ...basis, vorherTyp: "buy", vorherScore: null })).toBe("stark");
  });
});
