import { describe, expect, it } from "vitest";
import { needsPortfolioReturnSnapshotRefresh, resolvePortfolioReturnSnapshotWindow } from "./totalReturnHistoryProvider";

describe("needsPortfolioReturnSnapshotRefresh", () => {
  const now = new Date("2026-09-28T08:00:00.000Z").getTime();
  const maxAgeMs = 24 * 60 * 60 * 1000;

  it("keeps a ticker fresh only when both labelled return bases exist and are current", () => {
    expect(needsPortfolioReturnSnapshotRefresh({
      totalReturnRetrievedAt: new Date("2026-09-28T07:00:00.000Z"),
      splitAdjustedRetrievedAt: new Date("2026-09-28T07:00:00.000Z"),
      now,
      maxAgeMs,
    })).toBe(false);
  });

  it("repairs a missing split-adjusted snapshot even when total-return data is fresh", () => {
    expect(needsPortfolioReturnSnapshotRefresh({
      totalReturnRetrievedAt: new Date("2026-09-28T07:00:00.000Z"),
      splitAdjustedRetrievedAt: null,
      now,
      maxAgeMs,
    })).toBe(true);
  });

  it("refreshes an outdated split-adjusted snapshot independently of total return", () => {
    expect(needsPortfolioReturnSnapshotRefresh({
      totalReturnRetrievedAt: new Date("2026-09-28T07:00:00.000Z"),
      splitAdjustedRetrievedAt: new Date("2026-09-27T07:00:00.000Z"),
      now,
      maxAgeMs,
    })).toBe(true);
  });

  it("repairs a newly written but incomplete 5J split series", () => {
    expect(needsPortfolioReturnSnapshotRefresh({
      totalReturnRetrievedAt: new Date("2026-09-28T07:00:00.000Z"),
      splitAdjustedRetrievedAt: new Date("2026-09-28T07:00:00.000Z"),
      totalReturnCoverage: { firstDate: "2021-09-27", lastDate: "2026-09-25" },
      splitAdjustedCoverage: { firstDate: "2026-09-21", lastDate: "2026-09-25" },
      requiredFrom: "2021-09-27",
      requiredTo: "2026-09-25",
      now,
      maxAgeMs,
    })).toBe(true);
  });

  it("treats an invalid timestamp as stale rather than silently trusting it", () => {
    expect(needsPortfolioReturnSnapshotRefresh({
      totalReturnRetrievedAt: new Date("invalid"),
      splitAdjustedRetrievedAt: new Date("2026-09-28T07:00:00.000Z"),
      now,
      maxAgeMs,
    })).toBe(true);
  });

  it("expands a daily raw-price job to the full portfolio analytics window", () => {
    expect(resolvePortfolioReturnSnapshotWindow({
      requestedFrom: "2026-09-21",
      to: "2026-09-25",
    })).toEqual({ from: "2021-09-25", to: "2026-09-25" });
  });
});
