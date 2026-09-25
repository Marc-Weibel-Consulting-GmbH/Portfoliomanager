import { describe, expect, it } from "vitest";
import {
  calculateRebalancingSuggestions,
  type PortfolioHolding,
  type RankingResult,
} from "./portfolioCopilot";

function holding(ticker: string, weight: number): PortfolioHolding {
  return {
    ticker,
    companyName: ticker,
    weight,
    shares: 1,
    currentPrice: 1,
    currency: "CHF",
    prices: [100, 101, 102],
  };
}

function ranking(ticker: string, rankScore: number): RankingResult {
  return {
    ticker,
    companyName: ticker,
    currentWeight: 0,
    rankScore,
    outperformProbability: 0.5,
    uncertainty: 0,
    signal: "hold",
    momentum: 0,
    riskAdjustedReturn: 0,
    drivers: [],
  };
}

describe("calculateRebalancingSuggestions", () => {
  it("keeps the cash reserve outside of the securities target budget", () => {
    // The holdings make up only 75% of the total portfolio; 25% is cash.
    const suggestions = calculateRebalancingSuggestions(
      [holding("A.SW", 0.4), holding("B.SW", 0.35)],
      [ranking("A.SW", 70), ranking("B.SW", 30)],
    );

    expect(suggestions.reduce((total, item) => total + item.targetWeight, 0)).toBeCloseTo(0.75, 10);
  });
});
