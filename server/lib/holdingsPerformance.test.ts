/**
 * Holdings Performance Tests
 *
 * Moved verbatim from server/performanceCalculations.test.ts when
 * calculateHoldingsPerformance was extracted into lib/holdingsPerformance.ts
 * (D-01 Phase 5.1) and the legacy engine was deleted. Assertions unchanged.
 */

import { describe, it, expect } from "vitest";
import { calculateHoldingsPerformance } from "./holdingsPerformance";
import type { PortfolioTransaction } from "../../drizzle/schema";

describe("Holdings Performance", () => {
  describe("calculateHoldingsPerformance", () => {
    it("should calculate holdings correctly for single buy", () => {
      const transactions: PortfolioTransaction[] = [
        {
          id: 1,
          portfolioId: 1,
          transactionType: "buy",
          ticker: "AAPL",
          shares: "10",
          pricePerShare: "150",
          currency: "USD",
          totalAmount: "1500",
          totalAmountCHF: "1350", // Assuming 0.9 FX rate
          fxRate: "0.9",
          fees: "10",
          notes: null,
          source: 'manual',
          transactionDate: new Date("2024-01-01"),
          createdAt: new Date("2024-01-01"),
        },
      ];

      const currentPrices = new Map([["AAPL", 180]]);

      const holdings = calculateHoldingsPerformance(transactions, currentPrices);

      expect(holdings).toHaveLength(1);
      expect(holdings[0].ticker).toBe("AAPL");
      expect(holdings[0].shares).toBe(10);
      expect(holdings[0].currentValue).toBe(1800); // 10 * 180
      expect(holdings[0].totalInvested).toBe(1360); // 1350 + 10 fees
      expect(holdings[0].unrealizedGain).toBe(440); // 1800 - 1360
      expect(holdings[0].unrealizedGainPercent).toBeCloseTo(32.35, 1); // (440 / 1360) * 100
    });

    it("should calculate holdings correctly for buy and sell", () => {
      const transactions: PortfolioTransaction[] = [
        {
          id: 1,
          portfolioId: 1,
          transactionType: "buy",
          ticker: "AAPL",
          shares: "10",
          pricePerShare: "150",
          currency: "USD",
          totalAmount: "1500",
          totalAmountCHF: "1350",
          fxRate: "0.9",
          fees: "10",
          notes: null,
          source: 'manual',
          transactionDate: new Date("2024-01-01"),
          createdAt: new Date("2024-01-01"),
        },
        {
          id: 2,
          portfolioId: 1,
          transactionType: "sell",
          ticker: "AAPL",
          shares: "5",
          pricePerShare: "180",
          currency: "USD",
          totalAmount: "900",
          totalAmountCHF: "810",
          fxRate: "0.9",
          fees: "5",
          notes: null,
          source: 'manual',
          transactionDate: new Date("2024-06-01"),
          createdAt: new Date("2024-06-01"),
        },
      ];

      const currentPrices = new Map([["AAPL", 200]]);

      const holdings = calculateHoldingsPerformance(transactions, currentPrices);

      expect(holdings).toHaveLength(1);
      expect(holdings[0].ticker).toBe("AAPL");
      expect(holdings[0].shares).toBe(5); // 10 - 5
      expect(holdings[0].currentValue).toBe(1000); // 5 * 200

      // Cost basis should be reduced proportionally
      // Original cost: 1360, sold 50%, remaining cost: 680
      expect(holdings[0].totalInvested).toBeCloseTo(680, 0);
    });

    it("should exclude closed positions (shares = 0)", () => {
      const transactions: PortfolioTransaction[] = [
        {
          id: 1,
          portfolioId: 1,
          transactionType: "buy",
          ticker: "AAPL",
          shares: "10",
          pricePerShare: "150",
          currency: "USD",
          totalAmount: "1500",
          totalAmountCHF: "1350",
          fxRate: "0.9",
          fees: "10",
          notes: null,
          source: 'manual',
          transactionDate: new Date("2024-01-01"),
          createdAt: new Date("2024-01-01"),
        },
        {
          id: 2,
          portfolioId: 1,
          transactionType: "sell",
          ticker: "AAPL",
          shares: "10",
          pricePerShare: "180",
          currency: "USD",
          totalAmount: "1800",
          totalAmountCHF: "1620",
          fxRate: "0.9",
          fees: "10",
          notes: null,
          source: 'manual',
          transactionDate: new Date("2024-06-01"),
          createdAt: new Date("2024-06-01"),
        },
      ];

      const currentPrices = new Map([["AAPL", 200]]);

      const holdings = calculateHoldingsPerformance(transactions, currentPrices);

      expect(holdings).toHaveLength(0); // Closed position should be excluded
    });

    it("should handle multiple holdings", () => {
      const transactions: PortfolioTransaction[] = [
        {
          id: 1,
          portfolioId: 1,
          transactionType: "buy",
          ticker: "AAPL",
          shares: "10",
          pricePerShare: "150",
          currency: "USD",
          totalAmount: "1500",
          totalAmountCHF: "1350",
          fxRate: "0.9",
          fees: "10",
          notes: null,
          source: 'manual',
          transactionDate: new Date("2024-01-01"),
          createdAt: new Date("2024-01-01"),
        },
        {
          id: 2,
          portfolioId: 1,
          transactionType: "buy",
          ticker: "MSFT",
          shares: "5",
          pricePerShare: "300",
          currency: "USD",
          totalAmount: "1500",
          totalAmountCHF: "1350",
          fxRate: "0.9",
          fees: "10",
          notes: null,
          source: 'manual',
          transactionDate: new Date("2024-01-01"),
          createdAt: new Date("2024-01-01"),
        },
      ];

      const currentPrices = new Map([
        ["AAPL", 180],
        ["MSFT", 350],
      ]);

      const holdings = calculateHoldingsPerformance(transactions, currentPrices);

      expect(holdings).toHaveLength(2);

      const aapl = holdings.find(h => h.ticker === "AAPL");
      const msft = holdings.find(h => h.ticker === "MSFT");

      expect(aapl).toBeDefined();
      expect(msft).toBeDefined();

      expect(aapl!.currentValue).toBe(1800); // 10 * 180
      expect(msft!.currentValue).toBe(1750); // 5 * 350
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero prices gracefully", () => {
      const transactions: PortfolioTransaction[] = [
        {
          id: 1,
          portfolioId: 1,
          transactionType: "buy",
          ticker: "AAPL",
          shares: "10",
          pricePerShare: "150",
          currency: "USD",
          totalAmount: "1500",
          totalAmountCHF: "1350",
          fxRate: "0.9",
          fees: "10",
          notes: null,
          source: 'manual',
          transactionDate: new Date("2024-01-01"),
          createdAt: new Date("2024-01-01"),
        },
      ];

      const currentPrices = new Map([["AAPL", 0]]);

      const holdings = calculateHoldingsPerformance(transactions, currentPrices);

      expect(holdings[0].currentValue).toBe(0);
      expect(holdings[0].unrealizedGain).toBeLessThan(0); // Loss
    });

    it("should handle missing price data", () => {
      const transactions: PortfolioTransaction[] = [
        {
          id: 1,
          portfolioId: 1,
          transactionType: "buy",
          ticker: "AAPL",
          shares: "10",
          pricePerShare: "150",
          currency: "USD",
          totalAmount: "1500",
          totalAmountCHF: "1350",
          fxRate: "0.9",
          fees: "10",
          notes: null,
          source: 'manual',
          transactionDate: new Date("2024-01-01"),
          createdAt: new Date("2024-01-01"),
        },
      ];

      const currentPrices = new Map(); // No price data

      const holdings = calculateHoldingsPerformance(transactions, currentPrices);

      expect(holdings[0].currentValue).toBe(0);
      expect(holdings[0].currentPrice).toBe(0);
    });

    it("should handle very small values", () => {
      const transactions: PortfolioTransaction[] = [
        {
          id: 1,
          portfolioId: 1,
          transactionType: "buy",
          ticker: "PENNY",
          shares: "1000",
          pricePerShare: "0.01",
          currency: "USD",
          totalAmount: "10",
          totalAmountCHF: "9",
          fxRate: "0.9",
          fees: "0.5",
          notes: null,
          source: 'manual',
          transactionDate: new Date("2024-01-01"),
          createdAt: new Date("2024-01-01"),
        },
      ];

      const currentPrices = new Map([["PENNY", 0.02]]);

      const holdings = calculateHoldingsPerformance(transactions, currentPrices);

      expect(holdings[0].currentValue).toBeCloseTo(20, 1); // 1000 * 0.02
      expect(holdings[0].unrealizedGain).toBeCloseTo(10.5, 1); // 20 - 9.5
    });
  });
});
