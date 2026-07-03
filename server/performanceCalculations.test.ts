/**
 * Performance Calculations Tests
 * 
 * Tests for TWR, MWR/IRR, and comprehensive portfolio performance metrics
 */

import { describe, it, expect } from "vitest";
import {
  calculateTimeWeightedReturn,
  calculateMoneyWeightedReturn,
  calculateHoldingsPerformance,
  calculatePerformanceMetrics,
  buildValuePoints,
  type PortfolioValuePoint,
  type HoldingPerformance,
} from "../server/performanceCalculations";
import type { PortfolioTransaction } from "../drizzle/schema";

describe("Performance Calculations", () => {
  describe("calculateTimeWeightedReturn", () => {
    it("should calculate TWR correctly with no cash flows", () => {
      const valuePoints: PortfolioValuePoint[] = [
        { date: "2024-01-01", value: 10000, cashFlows: 0 },
        { date: "2024-06-30", value: 11000, cashFlows: 0 },
        { date: "2024-12-31", value: 12000, cashFlows: 0 },
      ];

      const twr = calculateTimeWeightedReturn(valuePoints);
      
      // Expected: (12000 - 10000) / 10000 = 20%
      expect(twr).toBeCloseTo(20, 1);
    });

    it("should calculate TWR correctly with cash inflows", () => {
      const valuePoints: PortfolioValuePoint[] = [
        { date: "2024-01-01", value: 10000, cashFlows: 10000 }, // Initial investment
        { date: "2024-06-30", value: 11000, cashFlows: 0 }, // 10% gain
        { date: "2024-07-01", value: 16000, cashFlows: 5000 }, // Add 5000
        { date: "2024-12-31", value: 17600, cashFlows: 0 }, // 10% gain on 16000
      ];

      const twr = calculateTimeWeightedReturn(valuePoints);
      
      // Period 1: (11000 - 10000) / 10000 = 10%
      // Period 2: (17600 - 16000) / 16000 = 10%
      // TWR = (1.1 * 1.1 - 1) * 100 = 21%
      expect(twr).toBeCloseTo(21, 0);
    });

    it("should return 0 for insufficient data", () => {
      const valuePoints: PortfolioValuePoint[] = [
        { date: "2024-01-01", value: 10000, cashFlows: 0 },
      ];

      const twr = calculateTimeWeightedReturn(valuePoints);
      expect(twr).toBe(0);
    });

    it("should handle negative returns", () => {
      const valuePoints: PortfolioValuePoint[] = [
        { date: "2024-01-01", value: 10000, cashFlows: 0 },
        { date: "2024-12-31", value: 8000, cashFlows: 0 },
      ];

      const twr = calculateTimeWeightedReturn(valuePoints);
      
      // Expected: (8000 - 10000) / 10000 = -20%
      expect(twr).toBeCloseTo(-20, 1);
    });
  });

  describe("calculateMoneyWeightedReturn", () => {
    it("should calculate MWR/IRR correctly with single investment", () => {
      const valuePoints: PortfolioValuePoint[] = [
        { date: "2024-01-01", value: 10000, cashFlows: 10000 },
        { date: "2024-12-31", value: 12000, cashFlows: 0 },
      ];

      const mwr = calculateMoneyWeightedReturn(valuePoints, 12000);
      
      // Expected: 20% return over 1 year
      expect(mwr).toBeCloseTo(20, 0);
    });

    it("should calculate MWR correctly with multiple cash flows", () => {
      const valuePoints: PortfolioValuePoint[] = [
        { date: "2024-01-01", value: 10000, cashFlows: 10000 },
        { date: "2024-06-30", value: 11000, cashFlows: 0 },
        { date: "2024-07-01", value: 16000, cashFlows: 5000 },
        { date: "2024-12-31", value: 17600, cashFlows: 0 },
      ];

      const mwr = calculateMoneyWeightedReturn(valuePoints, 17600);
      
      // MWR should be between 15-20% (less than TWR due to timing of cash flow)
      expect(mwr).toBeGreaterThan(10);
      expect(mwr).toBeLessThan(25);
    });

    it("should return 0 for insufficient data", () => {
      const valuePoints: PortfolioValuePoint[] = [];

      const mwr = calculateMoneyWeightedReturn(valuePoints, 10000);
      expect(mwr).toBe(0);
    });
  });

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

  describe("calculatePerformanceMetrics", () => {
    it("should calculate comprehensive metrics correctly", () => {
      const transactions: PortfolioTransaction[] = [
        // Initial deposit
        {
          id: 1,
          portfolioId: 1,
          transactionType: "deposit",
          ticker: null,
          shares: null,
          pricePerShare: null,
          currency: "CHF",
          totalAmount: "10000",
          totalAmountCHF: "10000",
          fxRate: "1",
          fees: "0",
          notes: null,
          transactionDate: new Date("2024-01-01"),
          createdAt: new Date("2024-01-01"),
        },
        // Buy AAPL
        {
          id: 2,
          portfolioId: 1,
          transactionType: "buy",
          ticker: "AAPL",
          shares: "50",
          pricePerShare: "150",
          currency: "USD",
          totalAmount: "7500",
          totalAmountCHF: "6750",
          fxRate: "0.9",
          fees: "10",
          notes: null,
          transactionDate: new Date("2024-01-02"),
          createdAt: new Date("2024-01-02"),
        },
        // Dividend
        {
          id: 3,
          portfolioId: 1,
          transactionType: "dividend",
          ticker: "AAPL",
          shares: null,
          pricePerShare: null,
          currency: "CHF",
          totalAmount: "100",
          totalAmountCHF: "100",
          fxRate: "1",
          fees: "0",
          notes: null,
          transactionDate: new Date("2024-06-01"),
          createdAt: new Date("2024-06-01"),
        },
      ];

      const currentPrices = new Map([["AAPL", 180]]);
      const realizedGains = 0;

      const metrics = calculatePerformanceMetrics(
        transactions,
        currentPrices,
        realizedGains
      );

      expect(metrics.totalInvested).toBe(10000); // deposits - withdrawals
      expect(metrics.currentValue).toBe(9000); // 50 * 180
      expect(metrics.dividendsReceived).toBe(100);
      expect(metrics.feesPaid).toBe(10);
      
      // Total return = current value + dividends - invested - fees
      // = 9000 + 100 - 10000 - 10 = -910
      expect(metrics.totalReturn).toBeCloseTo(-910, 0);
      
      // Unrealized gain = current value - cost basis
      // = 9000 - 6760 = 2240
      expect(metrics.unrealizedGains).toBeCloseTo(2240, 0);
    });

    it("should return zero metrics for empty portfolio", () => {
      const transactions: PortfolioTransaction[] = [];
      const currentPrices = new Map();
      const realizedGains = 0;

      const metrics = calculatePerformanceMetrics(
        transactions,
        currentPrices,
        realizedGains
      );

      expect(metrics.totalReturn).toBe(0);
      expect(metrics.totalReturnPercent).toBe(0);
      expect(metrics.currentValue).toBe(0);
      expect(metrics.totalInvested).toBe(0);
    });
  });

  describe("buildValuePoints", () => {
    it("should build value points correctly from transactions", () => {
      const transactions: PortfolioTransaction[] = [
        {
          id: 1,
          portfolioId: 1,
          transactionType: "deposit",
          ticker: null,
          shares: null,
          pricePerShare: null,
          currency: "CHF",
          totalAmount: "10000",
          totalAmountCHF: "10000",
          fxRate: "1",
          fees: "0",
          notes: null,
          transactionDate: new Date("2024-01-01"),
          createdAt: new Date("2024-01-01"),
        },
        {
          id: 2,
          portfolioId: 1,
          transactionType: "buy",
          ticker: "AAPL",
          shares: "50",
          pricePerShare: "150",
          currency: "USD",
          totalAmount: "7500",
          totalAmountCHF: "6750",
          fxRate: "0.9",
          fees: "10",
          notes: null,
          transactionDate: new Date("2024-01-02"),
          createdAt: new Date("2024-01-02"),
        },
      ];

      const currentPrices = new Map([["AAPL", 180]]);

      const valuePoints = buildValuePoints(transactions, currentPrices);

      expect(valuePoints.length).toBeGreaterThan(0);
      
      // First point should be deposit. Deposits on the portfolio creation date
      // (first transaction date) are treated as performance-neutral, so cashFlows = 0.
      // Characterization of current behavior — see OPTIMIZATION_PLAN.md R-01/R-05
      // for known issues with this module's cash flow handling.
      expect(valuePoints[0].date).toBe("2024-01-01");
      expect(valuePoints[0].cashFlows).toBe(0);
      
      // Second point should be buy
      expect(valuePoints[1].date).toBe("2024-01-02");
      expect(valuePoints[1].cashFlows).toBeCloseTo(6760, 0); // 6750 + 10 fees
    });

    it("should group transactions by date", () => {
      const transactions: PortfolioTransaction[] = [
        {
          id: 1,
          portfolioId: 1,
          transactionType: "deposit",
          ticker: null,
          shares: null,
          pricePerShare: null,
          currency: "CHF",
          totalAmount: "5000",
          totalAmountCHF: "5000",
          fxRate: "1",
          fees: "0",
          notes: null,
          transactionDate: new Date("2024-01-01"),
          createdAt: new Date("2024-01-01"),
        },
        {
          id: 2,
          portfolioId: 1,
          transactionType: "deposit",
          ticker: null,
          shares: null,
          pricePerShare: null,
          currency: "CHF",
          totalAmount: "5000",
          totalAmountCHF: "5000",
          fxRate: "1",
          fees: "0",
          notes: null,
          transactionDate: new Date("2024-01-01"),
          createdAt: new Date("2024-01-01"),
        },
      ];

      const currentPrices = new Map();

      const valuePoints = buildValuePoints(transactions, currentPrices);

      // Should group both deposits into single date. Both fall on the creation
      // date and are performance-neutral, so cashFlows = 0 (not 10000).
      // Characterization of current behavior — see OPTIMIZATION_PLAN.md R-01/R-05.
      const jan1Point = valuePoints.find(p => p.date === "2024-01-01");
      expect(jan1Point).toBeDefined();
      expect(jan1Point!.cashFlows).toBe(0);
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
