import { describe, expect, it } from "vitest";
import {
  calculateSplitAdjustedMarketMetrics,
  selectDirectSplitAdjustedMetricSeries,
} from "./splitAdjustedMarketMetrics";

describe("splitbereinigte Marktkennzahlen", () => {
  it("berechnet Swissquote-YTD und 52-Wochen-Spanne auf einer 1:10-homogenen Preisbasis", () => {
    const metrics = calculateSplitAdjustedMarketMetrics([
      { date: "2025-10-09", close: 54.35 },
      { date: "2026-01-05", close: 49.74 },
      { date: "2026-05-27", close: 39.82 },
      { date: "2026-10-07", close: 34.04 },
      { date: "2026-10-09", close: 34.84 },
    ], new Date("2026-10-09T12:00:00Z"));

    expect(metrics).toMatchObject({
      startDate: "2026-01-05",
      startPrice: 49.74,
      endDate: "2026-10-09",
      endPrice: 34.84,
      week52High: 54.35,
      week52Low: 34.04,
    });
    expect(metrics?.ytdPerformancePct).toBeCloseTo(-29.95577, 5);
  });

  it("behandelt einen Reverse-Split als homogene Preisreihe statt als Renditesprung", () => {
    const metrics = calculateSplitAdjustedMarketMetrics([
      { date: "2025-10-09", close: 4 },
      { date: "2026-01-02", close: 2.5 },
      { date: "2026-08-05", close: 2.4 },
      { date: "2026-10-09", close: 2.2 },
    ], new Date("2026-10-09T12:00:00Z"));

    expect(metrics?.ytdPerformancePct).toBeCloseTo(-12, 8);
    expect(metrics?.week52High).toBe(4);
    expect(metrics?.week52Low).toBe(2.2);
  });

  it("verwendet einen plausiblen neueren EODHD-Quote nur als YTD-Endpunkt", () => {
    const metrics = calculateSplitAdjustedMarketMetrics([
      { date: "2026-01-02", close: 226.5 },
      { date: "2026-10-08", close: 254.06 },
    ], new Date("2026-10-09T12:00:00Z"), 262.43);

    expect(metrics).toMatchObject({
      startPrice: 226.5,
      endDate: "2026-10-08",
      endPrice: 262.43,
    });
    expect(metrics?.ytdPerformancePct).toBeCloseTo(15.8631346578, 8);
  });

  it("verwirft einen mehr als doppelt so hohen, nicht zur Splitreihe passenden Quote", () => {
    const metrics = calculateSplitAdjustedMarketMetrics([
      { date: "2026-01-02", close: 56.4 },
      { date: "2026-10-08", close: 73.85 },
    ], new Date("2026-10-09T12:00:00Z"), 229.31);

    expect(metrics?.endPrice).toBe(73.85);
    expect(metrics?.ytdPerformancePct).toBeCloseTo(30.9397163121, 8);
  });

  it("akzeptiert die exakte native Sekundärlinie, aber nie eine nur für Risiko freigegebene Fremdlisting-Proxylinie", () => {
    const d05 = selectDirectSplitAdjustedMetricSeries({
      ticker: "D05.SI",
      currency: "SGD",
    }, [{
      date: "2026-01-02",
      adjustedClose: "56.4",
      currency: "SGD",
      source: "yahoo_close_split_adjusted",
      sourceSymbol: "D05.SI",
    }]);
    const bravida = selectDirectSplitAdjustedMetricSeries({
      ticker: "SE0007491303.SG",
      currency: "EUR",
      isin: "SE0007491303",
    }, [{
      date: "2026-01-02",
      adjustedClose: "88.4",
      currency: "SEK",
      source: "yahoo_close_split_adjusted",
      sourceSymbol: "BRAV.ST",
    }]);

    expect(d05?.rows).toEqual([{ date: "2026-01-02", close: 56.4 }]);
    expect(bravida).toBeNull();
  });

  it("verweigert eine EODHD-ADR-Proxylinie für direkte Kennzahlen", () => {
    const series = selectDirectSplitAdjustedMetricSeries({
      ticker: "6856.T",
      currency: "JPY",
    }, [{
      date: "2026-01-05",
      adjustedClose: "16325",
      currency: "EUR",
      source: "eodhd_split_adjusted",
      sourceSymbol: "01H.F",
    }]);

    expect(series).toBeNull();
  });
});
