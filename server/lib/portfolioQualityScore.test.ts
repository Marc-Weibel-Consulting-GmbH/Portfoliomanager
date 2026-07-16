import { describe, it, expect } from "vitest";
import {
  calculatePortfolioQualityScore,
  calculateHHI,
  type QualityScoreInput,
} from "./portfolioQualityScore";

describe("portfolioQualityScore", () => {
  describe("calculatePortfolioQualityScore", () => {
    it("returns 0 with 0% coverage when all inputs are null", () => {
      const result = calculatePortfolioQualityScore({});
      expect(result.totalScore).toBe(0);
      expect(result.dataCoveragePct).toBe(0);
      expect(result.components.every((c) => !c.available)).toBe(true);
    });

    it("calculates a high score for an excellent portfolio", () => {
      const input: QualityScoreInput = {
        sharpe: 1.2,
        sortino: 1.5,
        maxDrawdown: -0.05,
        avgPEG: 1.0,
        avgPE: 15,
        pegDistribution: { below15: 8, above3: 1, total: 12 },
        volatility: 0.10,
        avgBeta: 0.7,
        hhi: 0.06,
        avgDividendYield: 0.035,
        sectorHHI: 0.12,
        foreignCurrencyPct: 0.35,
        positionCount: 15,
      };
      const result = calculatePortfolioQualityScore(input);
      expect(result.totalScore).toBeGreaterThan(70);
      expect(result.dataCoveragePct).toBe(100);
      expect(result.components.every((c) => c.available)).toBe(true);
    });

    it("calculates a low score for a poor portfolio", () => {
      const input: QualityScoreInput = {
        sharpe: -0.3,
        sortino: -0.4,
        maxDrawdown: -0.35,
        avgPEG: 4.0,
        avgPE: 35,
        pegDistribution: { below15: 1, above3: 7, total: 10 },
        volatility: 0.30,
        avgBeta: 1.6,
        hhi: 0.25,
        avgDividendYield: 0.005,
        sectorHHI: 0.45,
        foreignCurrencyPct: 0.95,
        positionCount: 3,
      };
      const result = calculatePortfolioQualityScore(input);
      expect(result.totalScore).toBeLessThan(35);
      expect(result.dataCoveragePct).toBe(100);
    });

    it("renormalizes when some components are missing", () => {
      // Only risk-adjusted return and risk available
      const input: QualityScoreInput = {
        sharpe: 0.8,
        sortino: 1.0,
        maxDrawdown: -0.08,
        volatility: 0.12,
        avgBeta: 0.9,
        hhi: 0.08,
      };
      const result = calculatePortfolioQualityScore(input);
      expect(result.dataCoveragePct).toBe(50); // 30% + 20% = 50%
      expect(result.totalScore).toBeGreaterThan(0);
      // Only 2 of 5 components available
      expect(result.components.filter((c) => c.available).length).toBe(2);
    });

    it("is deterministic (same inputs → same score)", () => {
      const input: QualityScoreInput = {
        sharpe: 0.6,
        avgPEG: 1.8,
        volatility: 0.15,
        avgDividendYield: 0.025,
        positionCount: 10,
      };
      const r1 = calculatePortfolioQualityScore(input);
      const r2 = calculatePortfolioQualityScore(input);
      expect(r1.totalScore).toBe(r2.totalScore);
      expect(r1.dataCoveragePct).toBe(r2.dataCoveragePct);
    });

    it("handles edge case: only dividend yield available", () => {
      const input: QualityScoreInput = { avgDividendYield: 0.04 };
      const result = calculatePortfolioQualityScore(input);
      expect(result.dataCoveragePct).toBe(15);
      expect(result.totalScore).toBeGreaterThan(70); // 4% yield → high income score
      expect(result.components.filter((c) => c.available).length).toBe(1);
    });

    it("PEG warning zone: very low PEG gets capped score (too good to be true)", () => {
      const input: QualityScoreInput = { avgPEG: 0.3, avgPE: 8 };
      const result = calculatePortfolioQualityScore(input);
      // PEG < 0.5 → score around 50 (not 100), because it may indicate unreliable estimates
      const bewertung = result.components.find((c) => c.name === "Bewertung");
      expect(bewertung?.available).toBe(true);
      // The combined score should be moderate, not maximum
      expect(bewertung!.score).toBeLessThan(90);
    });
  });

  describe("calculateHHI", () => {
    it("returns 1.0 for a single position", () => {
      expect(calculateHHI([1.0])).toBeCloseTo(1.0);
    });

    it("returns 0.5 for two equal positions", () => {
      expect(calculateHHI([0.5, 0.5])).toBeCloseTo(0.5);
    });

    it("returns ~0.1 for 10 equal positions", () => {
      const weights = Array(10).fill(0.1);
      expect(calculateHHI(weights)).toBeCloseTo(0.1);
    });

    it("returns higher HHI for concentrated portfolio", () => {
      const concentrated = calculateHHI([0.6, 0.2, 0.1, 0.1]);
      const diversified = calculateHHI([0.25, 0.25, 0.25, 0.25]);
      expect(concentrated).toBeGreaterThan(diversified);
    });
  });
});
