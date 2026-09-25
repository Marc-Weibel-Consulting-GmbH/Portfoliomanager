import { describe, expect, it } from "vitest";
import { planAdjustedCloseEnrichment } from "./controlledAdjustedCloseEnrichment";

describe("planAdjustedCloseEnrichment", () => {
  it("enriches only missing adjusted values when all existing history matches the provider", () => {
    const plan = planAdjustedCloseEnrichment(
      [
        { date: "2026-01-02", close: 100, adjustedClose: 95 },
        { date: "2026-01-05", close: 101, adjustedClose: 0 },
        { date: "2026-01-06", close: 102, adjustedClose: null },
      ],
      [
        { date: "2026-01-02", close: 100, adjustedClose: 95 },
        { date: "2026-01-05", close: 101, adjustedClose: 96 },
        { date: "2026-01-06", close: 102, adjustedClose: 97 },
      ],
    );

    expect(plan).toEqual({
      eligible: true,
      reason: null,
      updates: [
        { date: "2026-01-05", adjustedClose: 96 },
        { date: "2026-01-06", adjustedClose: 97 },
      ],
    });
  });

  it("rejects a complete ticker when any retained adjusted close differs from the provider", () => {
    const plan = planAdjustedCloseEnrichment(
      [
        { date: "2026-01-02", close: 100, adjustedClose: 95 },
        { date: "2026-01-05", close: 101, adjustedClose: 0 },
      ],
      [
        { date: "2026-01-02", close: 100, adjustedClose: 94 },
        { date: "2026-01-05", close: 101, adjustedClose: 96 },
      ],
    );

    expect(plan).toEqual({
      eligible: false,
      reason: "existing_adjusted_close_differs",
      updates: [],
    });
  });

  it("rejects a complete ticker when any raw close differs from the provider", () => {
    const plan = planAdjustedCloseEnrichment(
      [
        { date: "2026-01-02", close: 100, adjustedClose: 95 },
        { date: "2026-01-05", close: 101, adjustedClose: 0 },
      ],
      [
        { date: "2026-01-02", close: 99.5, adjustedClose: 95 },
        { date: "2026-01-05", close: 101, adjustedClose: 96 },
      ],
    );

    expect(plan).toEqual({
      eligible: false,
      reason: "raw_close_differs",
      updates: [],
    });
  });

  it("never inserts a provider-only date", () => {
    const plan = planAdjustedCloseEnrichment(
      [{ date: "2026-01-02", close: 100, adjustedClose: 0 }],
      [
        { date: "2026-01-02", close: 100, adjustedClose: 95 },
        { date: "2026-01-05", close: 101, adjustedClose: 96 },
      ],
    );

    expect(plan).toEqual({
      eligible: true,
      reason: null,
      updates: [{ date: "2026-01-02", adjustedClose: 95 }],
    });
  });
});
