import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetRiskMetricsCache,
  getCachedRiskMetrics,
  invalidateCachedRiskMetricsForUser,
  setCachedRiskMetrics,
} from "./riskMetricsCache";

afterEach(() => {
  __resetRiskMetricsCache();
  vi.useRealTimers();
});

describe("riskMetricsCache", () => {
  it("returns a fresh cached risk result without a remote dependency", () => {
    setCachedRiskMetrics("risk:42:portfolio-7:2026-09-25:revision", { sharpeRatio: 1.2 }, 60_000);

    expect(getCachedRiskMetrics<{ sharpeRatio: number }>("risk:42:portfolio-7:2026-09-25:revision"))
      .toEqual({ sharpeRatio: 1.2 });
  });

  it("expires stale results rather than presenting them as current", () => {
    vi.useFakeTimers();
    setCachedRiskMetrics("risk:42:portfolio-7:2026-09-25:revision", { maxDrawdown: -20 }, 1_000);
    vi.advanceTimersByTime(1_001);

    expect(getCachedRiskMetrics("risk:42:portfolio-7:2026-09-25:revision")).toBeNull();
  });

  it("invalidates only the mutated user's risk results", () => {
    setCachedRiskMetrics("risk:42:portfolio-7:2026-09-25:revision", { sharpeRatio: 1 }, 60_000);
    setCachedRiskMetrics("risk:84:portfolio-7:2026-09-25:revision", { sharpeRatio: 2 }, 60_000);

    invalidateCachedRiskMetricsForUser(42);

    expect(getCachedRiskMetrics("risk:42:portfolio-7:2026-09-25:revision")).toBeNull();
    expect(getCachedRiskMetrics("risk:84:portfolio-7:2026-09-25:revision")).toEqual({ sharpeRatio: 2 });
  });
});
