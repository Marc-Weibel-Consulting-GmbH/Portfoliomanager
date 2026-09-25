import { describe, expect, it } from "vitest";
import {
  alignReturnsByDate,
  calculatePairedBeta,
  deduplicateBenchmarkCloses,
} from "./benchmarkReturnSeries";

describe("benchmarkReturnSeries", () => {
  it("retains the latest imported close per benchmark day before returns are calculated", () => {
    const closes = deduplicateBenchmarkCloses([
      { id: 1, date: "2026-01-02", close: "100", createdAt: new Date("2026-01-03T08:00:00Z") },
      { id: 2, date: "2026-01-02", close: "101", createdAt: new Date("2026-02-03T08:00:00Z") },
      { id: 3, date: "2026-01-03", close: "102", createdAt: new Date("2026-02-03T08:00:00Z") },
    ]);

    expect(closes).toEqual([
      { date: "2026-01-02", close: 101 },
      { date: "2026-01-03", close: 102 },
    ]);
  });

  it("pairs portfolio and benchmark returns by their actual common dates, not array index", () => {
    const pairs = alignReturnsByDate(
      [
        { date: "2026-01-03", value: 0.02 },
        { date: "2026-01-06", value: -0.01 },
        { date: "2026-01-07", value: 0.03 },
      ],
      [
        { date: "2026-01-02", value: 0.01 },
        { date: "2026-01-03", value: 0.015 },
        { date: "2026-01-07", value: 0.025 },
      ],
    );

    expect(pairs).toEqual([
      { date: "2026-01-03", portfolioReturn: 0.02, benchmarkReturn: 0.015 },
      { date: "2026-01-07", portfolioReturn: 0.03, benchmarkReturn: 0.025 },
    ]);
  });

  it("calculates beta from matched return pairs", () => {
    const beta = calculatePairedBeta([
      { date: "2026-01-02", portfolioReturn: 0.02, benchmarkReturn: 0.01 },
      { date: "2026-01-03", portfolioReturn: -0.04, benchmarkReturn: -0.02 },
      { date: "2026-01-06", portfolioReturn: 0.01, benchmarkReturn: 0.005 },
    ]);

    expect(beta).toBeCloseTo(2, 8);
  });

  it("returns null when there are not enough date-matched observations", () => {
    expect(calculatePairedBeta([
      { date: "2026-01-02", portfolioReturn: 0.02, benchmarkReturn: 0.01 },
    ])).toBeNull();
  });
});
