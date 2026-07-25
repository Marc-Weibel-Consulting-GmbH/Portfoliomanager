import { describe, expect, it } from "vitest";
import { planLabel } from "./planLabel";

describe("planLabel", () => {
  it("zeigt die mittlere Stufe «plus» als «Basic» an (Rename ohne DB-Migration)", () => {
    expect(planLabel("plus")).toBe("Basic");
  });

  it("bildet Free und Pro unverändert ab", () => {
    expect(planLabel("free")).toBe("Free");
    expect(planLabel("pro")).toBe("Pro");
  });

  it("fällt bei unbekanntem/leerem Plan auf «Free» zurück", () => {
    expect(planLabel(undefined)).toBe("Free");
    expect(planLabel(null)).toBe("Free");
    expect(planLabel("unbekannt")).toBe("Free");
  });
});
