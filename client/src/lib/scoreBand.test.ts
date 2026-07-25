import { describe, it, expect } from "vitest";
import { getScoreBand } from "./scoreBand";

describe("getScoreBand", () => {
  it("maps scores to the correct band", () => {
    expect(getScoreBand(85).label).toBe("Exzellent");
    expect(getScoreBand(80).label).toBe("Exzellent");
    expect(getScoreBand(79).label).toBe("Solide");
    expect(getScoreBand(60).label).toBe("Solide");
    expect(getScoreBand(59).label).toBe("Ausbaufähig");
    expect(getScoreBand(40).label).toBe("Ausbaufähig");
    expect(getScoreBand(39).label).toBe("Kritisch");
    expect(getScoreBand(0).label).toBe("Kritisch");
  });
});
