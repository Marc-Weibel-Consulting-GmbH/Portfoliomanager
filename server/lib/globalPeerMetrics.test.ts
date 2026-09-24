import { describe, expect, it } from "vitest";
import { deriveGlobalPeerMarketMetrics } from "./globalPeerMetrics";

function syntheticEodSeries(days = 520) {
  const start = Date.parse("2024-01-02T00:00:00Z");
  let price = 100;
  const dates: string[] = [];
  const prices: number[] = [];
  for (let index = 0; index < days; index += 1) {
    // A varied, positive series gives every metric a measurable basis.
    price *= 1 + 0.0008 + Math.sin(index / 11) * 0.003;
    dates.push(new Date(start + index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
    prices.push(price);
  }
  return { dates, prices };
}

describe("deriveGlobalPeerMarketMetrics", () => {
  it("derives a risk-adjusted Sharpe and timing score from a read-only EOD series", () => {
    const result = deriveGlobalPeerMarketMetrics(syntheticEodSeries());
    expect(result.sharpeRatio).not.toBeNull();
    expect(Number.isFinite(result.sharpeRatio)).toBe(true);
    expect(result.timing).not.toBeNull();
    expect(Number.isFinite(result.timing)).toBe(true);
  });

  it("keeps metrics as data gaps when the series is too short", () => {
    const result = deriveGlobalPeerMarketMetrics({
      dates: ["2026-01-02", "2026-01-03"],
      prices: [100, 101],
    });
    expect(result.sharpeRatio).toBeNull();
    expect(result.timing).toBeNull();
  });
});
