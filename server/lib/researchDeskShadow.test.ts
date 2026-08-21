import { describe, expect, it } from "vitest";
import { assertShadowModeOnly, buildResearchDeskRunKey } from "./researchDeskShadow";

describe("Research Desk Shadow Mode", () => {
  it("bindet einen Lauf eindeutig an seinen Kalendertag und die versionierte Pilotmenge", () => {
    expect(buildResearchDeskRunKey({
      runDate: new Date("2026-08-21T10:30:00.000Z"),
      universeVersion: "hyperscaler-us-v1",
      sourceVersion: "sec-submissions-v1",
    })).toBe("research-desk:2026-08-21:hyperscaler-us-v1:sec-submissions-v1");
  });

  it("verbietet alle Score-, Empfehlungs- und Handelswirkungen im Pilot", () => {
    expect(assertShadowModeOnly({ isShadowMode: true, decisionImpact: "none" })).toEqual({
      isShadowMode: true,
      decisionImpact: "none",
    });
    expect(() => assertShadowModeOnly({ isShadowMode: false, decisionImpact: "none" })).toThrow(/shadow/i);
    expect(() => assertShadowModeOnly({ isShadowMode: true, decisionImpact: "score" })).toThrow(/shadow/i);
  });
});
