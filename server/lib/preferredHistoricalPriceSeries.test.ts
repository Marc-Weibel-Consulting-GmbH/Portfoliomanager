import { describe, expect, it } from "vitest";
import { selectPreferredHistoricalPriceSeries } from "./preferredHistoricalPriceSeries";

describe("selectPreferredHistoricalPriceSeries", () => {
  it("prefers the current complete native series over a stale .US alias", () => {
    const selected = selectPreferredHistoricalPriceSeries("NVDA", [
      { ticker: "NVDA", date: "2026-09-23", close: 180, adjustedClose: 180 },
      { ticker: "NVDA", date: "2026-09-24", close: 181, adjustedClose: 181 },
      { ticker: "NVDA.US", date: "2026-07-15", close: 175, adjustedClose: 175 },
      { ticker: "NVDA.US", date: "2026-07-16", close: 176, adjustedClose: 0 },
    ]);

    expect(selected).toEqual([
      { date: "2026-09-23", close: 180, adjustedClose: 180 },
      { date: "2026-09-24", close: 181, adjustedClose: 181 },
    ]);
  });

  it("uses the .US alias intact when no native series exists", () => {
    const selected = selectPreferredHistoricalPriceSeries("NVDA", [
      { ticker: "NVDA.US", date: "2026-09-23", close: 180, adjustedClose: 180 },
      { ticker: "NVDA.US", date: "2026-09-24", close: 181, adjustedClose: 181 },
    ]);

    expect(selected).toEqual([
      { date: "2026-09-23", close: 180, adjustedClose: 180 },
      { date: "2026-09-24", close: 181, adjustedClose: 181 },
    ]);
  });

  it("does not join same-date rows from conflicting aliases", () => {
    const selected = selectPreferredHistoricalPriceSeries("NVDA", [
      { ticker: "NVDA", date: "2026-09-23", close: 180, adjustedClose: 180 },
      { ticker: "NVDA.US", date: "2026-09-23", close: 175, adjustedClose: 175 },
      { ticker: "NVDA.US", date: "2026-09-24", close: 176, adjustedClose: 176 },
    ]);

    expect(selected).toEqual([
      { date: "2026-09-23", close: 175, adjustedClose: 175 },
      { date: "2026-09-24", close: 176, adjustedClose: 176 },
    ]);
  });
});
