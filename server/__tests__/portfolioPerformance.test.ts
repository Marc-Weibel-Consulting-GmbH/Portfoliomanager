import { describe, it, expect } from 'vitest';
import {
  createMockBuyTransaction,
  createMockSellTransaction,
  createMockDepositTransaction,
  createMockDividendTransaction,
  calculateHoldingsFromTransactions,
  calculateCashPosition,
  calculateTotalInvested,
  type MockTransaction,
} from './utils/testHelpers';

describe('Portfolio Performance Calculations', () => {
  describe('Holdings Calculation', () => {
    it('should calculate correct holdings from buy transactions', () => {
      const transactions = [
        createMockBuyTransaction('AAPL', 100, 150, new Date('2025-01-01'), true),
        createMockBuyTransaction('GOOGL', 50, 2800, new Date('2025-01-02'), true),
      ];

      const holdings = calculateHoldingsFromTransactions(transactions);

      expect(holdings['AAPL']).toBe(100);
      expect(holdings['GOOGL']).toBe(50);
    });

    it('should handle partial sells correctly', () => {
      const transactions = [
        createMockBuyTransaction('AAPL', 100, 150, new Date('2025-01-01'), true),
        createMockSellTransaction('AAPL', 40, 160, new Date('2025-02-01')),
      ];

      const holdings = calculateHoldingsFromTransactions(transactions);

      expect(holdings['AAPL']).toBe(60); // 100 - 40 = 60
    });

    it('should handle complete sells correctly', () => {
      const transactions = [
        createMockBuyTransaction('AAPL', 100, 150, new Date('2025-01-01'), true),
        createMockSellTransaction('AAPL', 100, 160, new Date('2025-02-01')),
      ];

      const holdings = calculateHoldingsFromTransactions(transactions);

      expect(holdings['AAPL']).toBe(0);
    });

    it('should handle multiple buys and sells', () => {
      const transactions = [
        createMockBuyTransaction('AAPL', 100, 150, new Date('2025-01-01'), true),
        createMockBuyTransaction('AAPL', 50, 155, new Date('2025-01-15')),
        createMockSellTransaction('AAPL', 70, 160, new Date('2025-02-01')),
        createMockBuyTransaction('AAPL', 30, 165, new Date('2025-02-15')),
      ];

      const holdings = calculateHoldingsFromTransactions(transactions);

      expect(holdings['AAPL']).toBe(110); // 100 + 50 - 70 + 30 = 110
    });
  });

  describe('Cash Position Calculation', () => {
    it('should calculate cash correctly with initial buy (implicit deposit)', () => {
      const transactions = [
        createMockBuyTransaction('AAPL', 100, 150, new Date('2025-01-01'), true), // 15000 CHF
      ];

      const cash = calculateCashPosition(transactions);

      // Initial buy: deposit 15000, spend 15000 → cash = 0
      expect(cash).toBe(0);
    });

    it('should calculate cash correctly with deposit and buy', () => {
      const transactions = [
        createMockBuyTransaction('AAPL', 100, 150, new Date('2025-01-01'), true), // Initial: 15000
        createMockDepositTransaction(10000, new Date('2025-02-01')), // Additional deposit
      ];

      const cash = calculateCashPosition(transactions);

      // Initial buy: 15000 - 15000 = 0, then deposit 10000 → cash = 10000
      expect(cash).toBe(10000);
    });

    it('should calculate cash correctly with sell transaction', () => {
      const transactions = [
        createMockBuyTransaction('AAPL', 100, 150, new Date('2025-01-01'), true), // 15000 CHF
        createMockSellTransaction('AAPL', 40, 160, new Date('2025-02-01')), // 6400 CHF proceeds
      ];

      const cash = calculateCashPosition(transactions);

      // Initial: 15000 - 15000 = 0, sell proceeds: +6400 → cash = 6400
      expect(cash).toBe(6400);
    });

    it('should handle dividends correctly', () => {
      const transactions = [
        createMockBuyTransaction('AAPL', 100, 150, new Date('2025-01-01'), true), // 15000 CHF
        createMockDividendTransaction('AAPL', 500, new Date('2025-03-01')), // 500 CHF dividend
      ];

      const cash = calculateCashPosition(transactions);

      // Initial: 0, dividend: +500 → cash = 500
      expect(cash).toBe(500);
    });

    it('should handle complex scenario with multiple transaction types', () => {
      const transactions = [
        createMockBuyTransaction('AAPL', 100, 150, new Date('2025-01-01'), true), // 15000 CHF (implicit deposit)
        createMockDepositTransaction(10000, new Date('2025-02-01')), // +10000
        createMockBuyTransaction('GOOGL', 5, 2800, new Date('2025-02-02')), // -14000
        createMockDividendTransaction('AAPL', 500, new Date('2025-03-01')), // +500
        createMockSellTransaction('AAPL', 40, 160, new Date('2025-03-15')), // +6400
      ];

      const cash = calculateCashPosition(transactions);

      // Initial: 15000 - 15000 = 0
      // Deposit: +10000 = 10000
      // Buy GOOGL: -14000 = -4000
      // Dividend: +500 = -3500
      // Sell: +6400 = 2900
      expect(cash).toBe(2900);
    });
  });

  describe('Total Invested Calculation', () => {
    it('should calculate total invested from initial transactions', () => {
      const transactions = [
        createMockBuyTransaction('AAPL', 100, 150, new Date('2025-01-01'), true), // 15000 CHF
        createMockBuyTransaction('GOOGL', 50, 2800, new Date('2025-01-02'), true), // 140000 CHF
      ];

      const totalInvested = calculateTotalInvested(transactions);

      expect(totalInvested).toBe(155000); // 15000 + 140000
    });

    it('should include additional deposits in total invested', () => {
      const transactions = [
        createMockBuyTransaction('AAPL', 100, 150, new Date('2025-01-01'), true), // 15000 CHF
        createMockDepositTransaction(10000, new Date('2025-02-01')), // +10000
      ];

      const totalInvested = calculateTotalInvested(transactions);

      expect(totalInvested).toBe(25000); // 15000 + 10000
    });

    it('should not count non-initial buys as deposits', () => {
      const transactions = [
        createMockBuyTransaction('AAPL', 100, 150, new Date('2025-01-01'), true), // 15000 CHF (counts)
        createMockBuyTransaction('GOOGL', 5, 2800, new Date('2025-02-01')), // 14000 CHF (doesn't count)
      ];

      const totalInvested = calculateTotalInvested(transactions);

      expect(totalInvested).toBe(15000); // Only initial transaction counts
    });
  });

  describe('Regression Tests - Critical Bugs', () => {
    it('should not show negative cash position (Bug: Nov 10, 2025)', () => {
      // Scenario: User invested 261k, sold Swiss Re (52 shares), deposited 10k
      // Expected: Cash should be positive
      const transactions = [
        createMockBuyTransaction('SREN.SW', 52, 5000, new Date('2025-11-01'), true), // 260000 CHF
        createMockDepositTransaction(10000, new Date('2025-11-09')), // +10000
        createMockSellTransaction('SREN.SW', 52, 5000, new Date('2025-11-09')), // +260000 (no profit)
      ];

      const cash = calculateCashPosition(transactions);

      expect(cash).toBeGreaterThan(0);
      // Initial: 260000 - 260000 = 0, deposit: +10000 = 10000, sell: +260000 = 270000
      expect(cash).toBeCloseTo(270000, 0); // Cash includes sell proceeds
    });

    it('should handle partial sell without negative performance (Bug: Nov 10, 2025)', () => {
      // Scenario: Partial sell of EOS (109 of 209 shares)
      // Performance should not be negative just because of the sell
      const transactions = [
        createMockBuyTransaction('EOS', 209, 18.26, new Date('2025-10-29'), true), // 3816.34 CHF
        createMockSellTransaction('EOS', 109, 18.26, new Date('2025-11-10')), // 1990.34 CHF (break-even)
      ];

      const holdings = calculateHoldingsFromTransactions(transactions);
      const cash = calculateCashPosition(transactions);

      expect(holdings['EOS']).toBe(100); // 209 - 109 = 100
      expect(cash).toBeCloseTo(1990.34, 2); // Sell proceeds at break-even price
    });

    it('should calculate correct cash with initial buys treated as implicit deposits', () => {
      // Bug fix: Initial buys (261k) were not counted as deposits
      const transactions = [
        createMockBuyTransaction('AAPL', 100, 150, new Date('2025-11-01'), true), // 15000 CHF
        createMockBuyTransaction('GOOGL', 50, 2800, new Date('2025-11-01'), true), // 140000 CHF
        createMockBuyTransaction('MSFT', 30, 3533.33, new Date('2025-11-01'), true), // 106000 CHF
        // Total initial: 261000 CHF
        createMockDepositTransaction(10000, new Date('2025-11-09')), // +10000
        createMockSellTransaction('AAPL', 100, 150, new Date('2025-11-09')), // +15000 (break-even)
      ];

      const totalInvested = calculateTotalInvested(transactions);
      const cash = calculateCashPosition(transactions);

      expect(totalInvested).toBeCloseTo(271000, 0); // 261000 + 10000
      expect(cash).toBeCloseTo(25000, 0); // 10000 deposit + 15000 sell proceeds
    });
  });
});
