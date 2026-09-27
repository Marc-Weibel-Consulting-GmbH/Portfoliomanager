import { describe, expect, it } from "vitest";
import { planRawHistoryBackfill } from "./portfolioRiskRecalculation";

describe("planRawHistoryBackfill", () => {
  it("selects only portfolio tickers whose canonical raw series does not reach the requested five-year start", () => {
    expect(planRawHistoryBackfill({
      tickers: ["NESN.SW", "MSFT", "ASOL.SW"],
      requestedStart: "2021-09-20",
      coverage: [
        { ticker: "NESN.SW", firstDate: "2011-05-24" },
        { ticker: "MSFT", firstDate: "2022-12-30" },
        { ticker: "ASOL.SW", firstDate: "2022-03-14" },
      ],
    })).toEqual([
      { ticker: "ASOL.SW", reason: "starts_after_requested_window", firstDate: "2022-03-14" },
      { ticker: "MSFT", reason: "starts_after_requested_window", firstDate: "2022-12-30" },
    ]);
  });

  it("treats an unknown or empty canonical series as a backfill candidate instead of silently accepting an alias", () => {
    expect(planRawHistoryBackfill({
      tickers: ["AAPL", "MU"],
      requestedStart: "2021-09-20",
      coverage: [{ ticker: "MU", firstDate: null }],
    })).toEqual([
      { ticker: "AAPL", reason: "missing_canonical_series", firstDate: null },
      { ticker: "MU", reason: "missing_canonical_series", firstDate: null },
    ]);
  });
});
