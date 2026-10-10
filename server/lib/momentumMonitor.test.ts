import { describe, expect, it } from "vitest";
import {
  assessMomentumCrashRisk,
  calculateMomentumFeatures,
  classifyMomentumTrend,
  median,
  momentumPercentile,
} from "./momentumMonitor";

function linearSeries(length: number, start: number, end: number) {
  return Array.from({ length }, (_unused, index) => {
    const date = new Date(Date.UTC(2024, 0, 1 + index)).toISOString().slice(0, 10);
    return {
      date,
      close: start + ((end - start) * index) / Math.max(1, length - 1),
    };
  });
}

describe("Momentum-Monitor", () => {
  it("berechnet 6M- und 12M-Kursmomentum ausschliesslich aus einer homogenen Preisreihe", () => {
    const rows = Array.from({ length: 253 }, (_unused, index) => ({
      date: `2025-${String(Math.floor(index / 21) + 1).padStart(2, "0")}-${String((index % 21) + 1).padStart(2, "0")}`,
      close: 100 + index,
    }));

    const result = calculateMomentumFeatures(rows);

    expect(result?.return6mPct).toBeCloseTo(((352 / 226) - 1) * 100, 10);
    expect(result?.return12mPct).toBeCloseTo(((352 / 100) - 1) * 100, 10);
    expect(result?.compositeMomentumPct).toBeCloseTo((result!.return6mPct + result!.return12mPct) / 2, 10);
    expect(result?.coverageDays).toBe(253);
  });

  it("verwirft eine unvollständige Reihe statt einen Rang zu schätzen", () => {
    expect(calculateMomentumFeatures(linearSeries(252, 100, 150))).toBeNull();
  });

  it("ordnet Perzentile und Median bei Bindungen stabil ein", () => {
    expect(momentumPercentile(20, [10, 20, 20, 30])).toBe(50);
    expect(momentumPercentile(30, [10, 20, 20, 30])).toBe(88);
    expect(median([9, 1, 3, 7])).toBe(5);
    expect(median([])).toBeNull();
  });

  it("klassifiziert einen steigenden, nicht überhitzten Trend als intakt", () => {
    const trend = classifyMomentumTrend({
      prices: linearSeries(260, 100, 200),
      relative6mPct: 4,
      relative12mPct: 8,
    });

    expect(trend.state).toBe("intakt");
    expect(trend.distanceToSma200Pct).toBeGreaterThan(0);
  });

  it("markiert einen außergewöhnlichen Abstand zum 10-Monats-Filter als Überhitzungsrisiko", () => {
    const prices = [
      ...linearSeries(200, 100, 105),
      ...linearSeries(60, 106, 180),
    ].map((row, index) => ({
      ...row,
      date: new Date(Date.UTC(2024, 0, 1 + index)).toISOString().slice(0, 10),
    }));
    const trend = classifyMomentumTrend({ prices, relative6mPct: 12, relative12mPct: 25 });

    expect(trend.state).toBe("ueberhitzt");
    expect(trend.distanceToSma200Pct).toBeGreaterThanOrEqual(30);
  });

  it("aktiviert das Crash-Gate nur bei der dokumentierten Stresskombination", () => {
    const preRebound = [
      ...linearSeries(180, 100, 180),
      ...linearSeries(45, 180, 90),
    ].map((row, index) => ({
      ...row,
      date: new Date(Date.UTC(2024, 0, 1 + index)).toISOString().slice(0, 10),
    }));
    const volatileRebound = [90, 80, 100, 82, 105, 84, 108, 86, 110, 84, 114, 86, 112, 89, 118, 88, 115, 92, 120, 95, 116]
      .map((close, index) => ({
        close,
        date: new Date(Date.UTC(2024, 0, 1 + preRebound.length + index)).toISOString().slice(0, 10),
      }));
    const benchmarkPrices = [...preRebound, ...volatileRebound];

    const stressed = assessMomentumCrashRisk({
      benchmarkPrices,
      assetReturn12mPct: 30,
      relative6mPct: -4,
    });
    const normal = assessMomentumCrashRisk({
      benchmarkPrices: linearSeries(253, 100, 145),
      assetReturn12mPct: 30,
      relative6mPct: -4,
    });

    expect(stressed.active).toBe(true);
    expect(stressed.reason).toContain("Drawdown");
    expect(normal.active).toBe(false);
  });
});
