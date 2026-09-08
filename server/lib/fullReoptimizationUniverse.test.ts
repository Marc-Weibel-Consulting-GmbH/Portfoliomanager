import { describe, expect, it } from "vitest";
import { selectFullReoptimizationUniverse } from "./fullReoptimizationUniverse";

describe("selectFullReoptimizationUniverse", () => {
  it("schliesst Sleeves, Verkaufssignale und explizite Datenlücken aus und reserviert CHF-Kandidaten", () => {
    const selection = selectFullReoptimizationUniverse({
      candidateLimit: 4,
      method: "max_sharpe",
      minChfWeight: 0.5,
      maxEquityPositionWeight: 0.25,
      candidates: [
        { ticker: "USD1.US", currency: "USD", currentPrice: 100, sharpeRatio: 2.0, signalScore: 80, isActive: true },
        { ticker: "USD2.US", currency: "USD", currentPrice: 100, sharpeRatio: 1.8, signalScore: 78, isActive: true },
        { ticker: "CHF1.SW", currency: "CHF", currentPrice: 100, sharpeRatio: 1.2, signalScore: 70, isActive: true },
        { ticker: "CHF2.SW", currency: "CHF", currentPrice: 100, sharpeRatio: 1.1, signalScore: 69, isActive: true },
        { ticker: "BOND.SW", currency: "CHF", currentPrice: 100, sharpeRatio: 3.0, signalScore: 99, isActive: true, isSleeve: true },
        { ticker: "SELL.US", currency: "USD", currentPrice: 100, sharpeRatio: 4.0, signalScore: 99, isActive: true, signalType: "sell" },
        { ticker: "GAP.US", currency: "USD", currentPrice: 100, sharpeRatio: 4.0, signalScore: 99, isActive: true, dataQualityStatus: "Datenlücke" },
      ],
    });

    expect(selection.tickers).toHaveLength(4);
    expect(selection.tickers).toEqual(expect.arrayContaining(["USD1.US", "USD2.US", "CHF1.SW", "CHF2.SW"]));
    expect(selection.requiredChfCandidateCount).toBe(2);
    expect(selection.excluded).toEqual(expect.arrayContaining([
      expect.objectContaining({ ticker: "BOND.SW", reason: "sleeve" }),
      expect.objectContaining({ ticker: "SELL.US", reason: "sell_signal" }),
      expect.objectContaining({ ticker: "GAP.US", reason: "data_gap" }),
    ]));
  });

  it("schliesst Kandidaten ohne nachgewiesene historische Mindestabdeckung aus", () => {
    const selection = selectFullReoptimizationUniverse({
      candidateLimit: 3,
      method: "max_sharpe",
      maxEquityPositionWeight: 0.5,
      candidates: [
        { ticker: "HIST.SW", currency: "CHF", currentPrice: 100, sharpeRatio: 1.2, isActive: true, hasSufficientHistory: true },
        { ticker: "GAP.US", currency: "USD", currentPrice: 100, sharpeRatio: 2.0, isActive: true, hasSufficientHistory: false },
        { ticker: "SECOND.US", currency: "USD", currentPrice: 100, sharpeRatio: 0.8, isActive: true, hasSufficientHistory: true },
      ],
    });

    expect(selection.tickers).toEqual(["HIST.SW", "SECOND.US"]);
    expect(selection.excluded).toContainEqual({ ticker: "GAP.US", reason: "insufficient_history" });
  });

  it("behält nur Kandidaten mit mindestens 31 gemeinsamen Preisdatumswerten", () => {
    const commonDates = Array.from({ length: 31 }, (_, index) => `2025-01-${String(index + 1).padStart(2, "0")}`);
    const disjointDates = Array.from({ length: 61 }, (_, index) => `2024-01-${String((index % 28) + 1).padStart(2, "0")}`);
    const selection = selectFullReoptimizationUniverse({
      candidateLimit: 3,
      method: "max_sharpe",
      maxEquityPositionWeight: 0.5,
      candidates: [
        { ticker: "FIRST.SW", currency: "CHF", currentPrice: 100, sharpeRatio: 1.5, isActive: true, hasSufficientHistory: true, historyDates: commonDates },
        { ticker: "SECOND.US", currency: "USD", currentPrice: 100, sharpeRatio: 1.2, isActive: true, hasSufficientHistory: true, historyDates: commonDates },
        { ticker: "MISMATCH.AT", currency: "EUR", currentPrice: 100, sharpeRatio: 1.1, isActive: true, hasSufficientHistory: true, historyDates: disjointDates },
      ],
    });

    expect(selection.tickers).toEqual(["FIRST.SW", "SECOND.US"]);
    expect(selection.excluded).toContainEqual({ ticker: "MISMATCH.AT", reason: "insufficient_overlap" });
    expect(selection.commonHistoryDateCount).toBe(31);
  });
});
