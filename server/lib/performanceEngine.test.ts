import { describe, it, expect } from 'vitest';
import {
  calculateTTWROR,
  calculateIRR,
  calculatePerformance,
  buildDailyValuations,
  buildHoldingsTimeline,
  extractPortfolioCashFlows,
  type CashFlow,
  type DailyValuation,
} from './performanceEngine';

describe('performanceEngine', () => {
  describe('calculateTTWROR', () => {
    it('returns 0 for a single valuation (no period)', () => {
      const valuations: DailyValuation[] = [
        { date: '2025-01-01', marketValue: 100000 },
      ];
      const result = calculateTTWROR(valuations, []);
      expect(result.totalReturn).toBe(0);
      expect(result.periodDays).toBe(0);
    });

    it('calculates simple return without cash flows', () => {
      // Portfolio goes from 100k to 110k over 10 days = +10%
      const valuations: DailyValuation[] = [
        { date: '2025-01-01', marketValue: 100000 },
        { date: '2025-01-02', marketValue: 101000 },
        { date: '2025-01-03', marketValue: 102000 },
        { date: '2025-01-04', marketValue: 103000 },
        { date: '2025-01-05', marketValue: 104000 },
        { date: '2025-01-06', marketValue: 105000 },
        { date: '2025-01-07', marketValue: 106000 },
        { date: '2025-01-08', marketValue: 107000 },
        { date: '2025-01-09', marketValue: 108000 },
        { date: '2025-01-10', marketValue: 109000 },
        { date: '2025-01-11', marketValue: 110000 },
      ];
      const result = calculateTTWROR(valuations, []);
      expect(result.totalReturn).toBeCloseTo(0.10, 2); // 10%
      expect(result.periodDays).toBe(10);
    });

    it('neutralizes deposit impact on TTWROR', () => {
      // Day 1: 100k
      // Day 2: deposit 50k, portfolio grows to 160k (10k gain on 150k base)
      // Without TTWROR: (160k - 100k) / 100k = 60% (WRONG - includes deposit)
      // With TTWROR: Day 1 return = 0, Day 2 return = 160k / (100k + 50k) - 1 = 6.67%
      // But we need to account for the gain before deposit too
      const valuations: DailyValuation[] = [
        { date: '2025-01-01', marketValue: 100000 },
        { date: '2025-01-02', marketValue: 160000 }, // After deposit + growth
      ];
      const cashFlows: CashFlow[] = [
        { date: '2025-01-02', amount: 50000, type: 'deposit' },
      ];
      const result = calculateTTWROR(valuations, cashFlows);
      // (160000) / (100000 + 50000) - 1 = 160000/150000 - 1 = 0.0667
      expect(result.totalReturn).toBeCloseTo(0.0667, 3);
    });

    it('neutralizes withdrawal impact on TTWROR', () => {
      // Day 1: 100k
      // Day 2: withdraw 20k, portfolio ends at 85k
      // TTWROR: (85000 + 20000) / 100000 - 1 = 105000/100000 - 1 = 5%
      const valuations: DailyValuation[] = [
        { date: '2025-01-01', marketValue: 100000 },
        { date: '2025-01-02', marketValue: 85000 }, // After withdrawal + growth
      ];
      const cashFlows: CashFlow[] = [
        { date: '2025-01-02', amount: -20000, type: 'withdrawal' },
      ];
      const result = calculateTTWROR(valuations, cashFlows);
      // (85000 + 20000) / 100000 - 1 = 5%
      expect(result.totalReturn).toBeCloseTo(0.05, 3);
    });

    it('compounds daily returns correctly over multiple days', () => {
      // 3 days: +5%, +3%, -2%
      // Compound: (1.05 * 1.03 * 0.98) - 1 = 0.05947
      const valuations: DailyValuation[] = [
        { date: '2025-01-01', marketValue: 100000 },
        { date: '2025-01-02', marketValue: 105000 }, // +5%
        { date: '2025-01-03', marketValue: 108150 }, // +3% of 105000
        { date: '2025-01-04', marketValue: 105987 }, // -2% of 108150
      ];
      const result = calculateTTWROR(valuations, []);
      expect(result.totalReturn).toBeCloseTo(0.05987, 4);
    });

    it('produces daily series for charting', () => {
      const valuations: DailyValuation[] = [
        { date: '2025-01-01', marketValue: 100000 },
        { date: '2025-01-02', marketValue: 105000 },
        { date: '2025-01-03', marketValue: 110000 },
      ];
      const result = calculateTTWROR(valuations, []);
      expect(result.dailySeries).toHaveLength(3);
      expect(result.dailySeries[0].cumulativeReturn).toBe(0);
      expect(result.dailySeries[1].cumulativeReturn).toBeCloseTo(0.05, 4);
      expect(result.dailySeries[2].cumulativeReturn).toBeCloseTo(0.10, 2);
    });

    it('handles zero market value gracefully', () => {
      const valuations: DailyValuation[] = [
        { date: '2025-01-01', marketValue: 0 },
        { date: '2025-01-02', marketValue: 50000 },
      ];
      const cashFlows: CashFlow[] = [
        { date: '2025-01-02', amount: 50000, type: 'deposit' },
      ];
      const result = calculateTTWROR(valuations, cashFlows);
      // Denominator = 0 + 50000 = 50000, Numerator = 50000
      // Return = 0 (money just arrived, no gain)
      expect(result.totalReturn).toBeCloseTo(0, 2);
    });
  });

  describe('calculateIRR', () => {
    it('returns simple return when no cash flows', () => {
      // 100k -> 110k over 365 days = 10% annualized
      const result = calculateIRR(100000, 110000, [], '2025-01-01', '2025-12-31');
      expect(result.annualizedIRR).toBeCloseTo(0.10, 2);
      expect(result.converged).toBe(true);
    });

    it('returns 0 when MVB and MVE are equal with no cash flows', () => {
      const result = calculateIRR(100000, 100000, [], '2025-01-01', '2025-06-30');
      expect(result.annualizedIRR).toBeCloseTo(0, 4);
      expect(result.converged).toBe(true);
    });

    it('accounts for cash flow timing', () => {
      // Start: 100k, deposit 50k at midpoint, end: 165k
      // Simple return would be (165k - 150k) / 150k = 10%
      // But IRR accounts for the fact that the 50k was only invested for half the period
      const cashFlows: CashFlow[] = [
        { date: '2025-07-01', amount: 50000, type: 'deposit' },
      ];
      const result = calculateIRR(100000, 165000, cashFlows, '2025-01-01', '2025-12-31');
      expect(result.converged).toBe(true);
      // IRR should be higher than simple 10% because the 50k was only at risk for 6 months
      expect(result.annualizedIRR).toBeGreaterThan(0.08);
      expect(result.annualizedIRR).toBeLessThan(0.20);
    });

    it('handles negative returns', () => {
      // 100k -> 80k = -20% loss
      const result = calculateIRR(100000, 80000, [], '2025-01-01', '2025-12-31');
      expect(result.annualizedIRR).toBeCloseTo(-0.20, 2);
      expect(result.converged).toBe(true);
    });

    it('converges for complex scenarios', () => {
      // Multiple deposits and withdrawals
      const cashFlows: CashFlow[] = [
        { date: '2025-03-01', amount: 20000, type: 'deposit' },
        { date: '2025-06-01', amount: -10000, type: 'withdrawal' },
        { date: '2025-09-01', amount: 30000, type: 'deposit' },
      ];
      const result = calculateIRR(100000, 155000, cashFlows, '2025-01-01', '2025-12-31');
      expect(result.converged).toBe(true);
      // Net invested: 100k + 20k - 10k + 30k = 140k, end = 155k
      // Positive return expected
      expect(result.annualizedIRR).toBeGreaterThan(0);
    });

    it('returns 0 for zero-length period', () => {
      const result = calculateIRR(100000, 100000, [], '2025-01-01', '2025-01-01');
      expect(result.annualizedIRR).toBe(0);
    });
  });

  describe('calculatePerformance', () => {
    it('returns combined TTWROR and IRR metrics', () => {
      const valuations: DailyValuation[] = [
        { date: '2025-01-01', marketValue: 100000 },
        { date: '2025-01-15', marketValue: 102000 },
        { date: '2025-02-01', marketValue: 105000 },
      ];
      const cashFlows: CashFlow[] = [];
      const result = calculatePerformance(valuations, cashFlows, '2025-01-01', '2025-02-01');
      
      expect(result.ttwror.totalReturn).toBeCloseTo(0.05, 2);
      expect(result.irr.converged).toBe(true);
      expect(result.currentValue).toBe(105000);
      expect(result.startDate).toBe('2025-01-01');
      expect(result.endDate).toBe('2025-02-01');
    });

    it('calculates absolute gain correctly', () => {
      const valuations: DailyValuation[] = [
        { date: '2025-01-01', marketValue: 100000 },
        { date: '2025-06-01', marketValue: 115000 },
      ];
      const cashFlows: CashFlow[] = [
        { date: '2025-03-01', amount: 10000, type: 'deposit' },
      ];
      const result = calculatePerformance(valuations, cashFlows, '2025-01-01', '2025-06-01');
      // Total invested = MVB (100k) + deposits (10k) = 110k
      // Current value = 115k
      // Absolute gain = 115k + 0 (withdrawals) - 110k = 5k
      expect(result.absoluteGain).toBeCloseTo(5000, 0);
    });
  });

  describe('buildHoldingsTimeline', () => {
    it('tracks buy transactions correctly', () => {
      const transactions = [
        { transactionType: 'buy', transactionDate: '2025-01-02', ticker: 'AAPL', shares: '10' },
        { transactionType: 'buy', transactionDate: '2025-01-05', ticker: 'AAPL', shares: '5' },
      ];
      const dates = ['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04', '2025-01-05', '2025-01-06'];
      const result = buildHoldingsTimeline(transactions, dates);
      
      const aaplHoldings = result.get('AAPL')!;
      expect(aaplHoldings.get('2025-01-01')).toBeUndefined(); // No holdings before first buy
      expect(aaplHoldings.get('2025-01-02')).toBe(10);
      expect(aaplHoldings.get('2025-01-03')).toBe(10);
      expect(aaplHoldings.get('2025-01-05')).toBe(15);
      expect(aaplHoldings.get('2025-01-06')).toBe(15);
    });

    it('tracks sell transactions correctly', () => {
      const transactions = [
        { transactionType: 'buy', transactionDate: '2025-01-01', ticker: 'NOVN', shares: '100' },
        { transactionType: 'sell', transactionDate: '2025-01-03', ticker: 'NOVN', shares: '30' },
      ];
      const dates = ['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04'];
      const result = buildHoldingsTimeline(transactions, dates);
      
      const novnHoldings = result.get('NOVN')!;
      expect(novnHoldings.get('2025-01-01')).toBe(100);
      expect(novnHoldings.get('2025-01-02')).toBe(100);
      expect(novnHoldings.get('2025-01-03')).toBe(70);
      expect(novnHoldings.get('2025-01-04')).toBe(70);
    });

    it('handles multiple tickers', () => {
      const transactions = [
        { transactionType: 'buy', transactionDate: '2025-01-01', ticker: 'AAPL', shares: '10' },
        { transactionType: 'buy', transactionDate: '2025-01-01', ticker: 'NOVN', shares: '50' },
      ];
      const dates = ['2025-01-01', '2025-01-02'];
      const result = buildHoldingsTimeline(transactions, dates);
      
      expect(result.has('AAPL')).toBe(true);
      expect(result.has('NOVN')).toBe(true);
      expect(result.get('AAPL')!.get('2025-01-01')).toBe(10);
      expect(result.get('NOVN')!.get('2025-01-01')).toBe(50);
    });
  });

  describe('extractPortfolioCashFlows', () => {
    it('extracts deposits as positive inflows', () => {
      const transactions = [
        { transactionType: 'deposit', transactionDate: '2025-01-01', totalAmountCHF: '100000' },
      ];
      const result = extractPortfolioCashFlows(transactions);
      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(100000);
      expect(result[0].type).toBe('deposit');
    });

    it('extracts withdrawals as negative outflows', () => {
      const transactions = [
        { transactionType: 'withdrawal', transactionDate: '2025-06-01', totalAmountCHF: '20000' },
      ];
      const result = extractPortfolioCashFlows(transactions);
      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(-20000);
      expect(result[0].type).toBe('withdrawal');
    });

    it('ignores buy/sell/dividend (internal movements)', () => {
      const transactions = [
        { transactionType: 'deposit', transactionDate: '2025-01-01', totalAmountCHF: '100000' },
        { transactionType: 'buy', transactionDate: '2025-01-02', totalAmountCHF: '50000', ticker: 'AAPL' },
        { transactionType: 'sell', transactionDate: '2025-03-01', totalAmountCHF: '30000', ticker: 'AAPL' },
        { transactionType: 'dividend', transactionDate: '2025-04-01', totalAmountCHF: '500', ticker: 'AAPL' },
      ];
      const result = extractPortfolioCashFlows(transactions);
      // Only deposit should be extracted
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('deposit');
    });

    it('handles entry type as deposit', () => {
      const transactions = [
        { transactionType: 'entry', transactionDate: '2025-01-01', totalAmountCHF: '50000' },
      ];
      const result = extractPortfolioCashFlows(transactions);
      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(50000);
      expect(result[0].type).toBe('entry');
    });
  });

  describe('buildDailyValuations', () => {
    it('calculates market value from holdings and prices', () => {
      const holdingsOverTime = new Map<string, Map<string, number>>();
      const aaplHoldings = new Map([['2025-01-01', 10], ['2025-01-02', 10]]);
      holdingsOverTime.set('AAPL', aaplHoldings);

      const pricesCHF = new Map<string, Map<string, number>>();
      const aaplPrices = new Map([['2025-01-01', 150], ['2025-01-02', 155]]);
      pricesCHF.set('AAPL', aaplPrices);

      const cashBalances = new Map([['2025-01-01', 5000], ['2025-01-02', 5000]]);
      const dates = ['2025-01-01', '2025-01-02'];

      const result = buildDailyValuations(holdingsOverTime, pricesCHF, cashBalances, dates);
      
      expect(result).toHaveLength(2);
      expect(result[0].marketValue).toBe(10 * 150 + 5000); // 1500 + 5000 = 6500
      expect(result[1].marketValue).toBe(10 * 155 + 5000); // 1550 + 5000 = 6550
    });

    it('handles missing prices by looking back', () => {
      const holdingsOverTime = new Map<string, Map<string, number>>();
      const aaplHoldings = new Map([['2025-01-01', 10], ['2025-01-02', 10], ['2025-01-03', 10]]);
      holdingsOverTime.set('AAPL', aaplHoldings);

      const pricesCHF = new Map<string, Map<string, number>>();
      // Price missing for 2025-01-02 (weekend)
      const aaplPrices = new Map([['2025-01-01', 150], ['2025-01-03', 160]]);
      pricesCHF.set('AAPL', aaplPrices);

      const cashBalances = new Map([['2025-01-01', 0], ['2025-01-02', 0], ['2025-01-03', 0]]);
      const dates = ['2025-01-01', '2025-01-02', '2025-01-03'];

      const result = buildDailyValuations(holdingsOverTime, pricesCHF, cashBalances, dates);
      
      expect(result[0].marketValue).toBe(1500); // 10 * 150
      expect(result[1].marketValue).toBe(1500); // Uses 2025-01-01 price (lookback)
      expect(result[2].marketValue).toBe(1600); // 10 * 160
    });
  });

  describe('TTWROR vs IRR divergence', () => {
    it('TTWROR and IRR diverge when cash flow timing matters', () => {
      // Scenario: Market drops 20%, investor deposits more, market recovers
      // TTWROR should show the pure market performance
      // IRR should show worse result because more money was invested at the bottom
      
      // Day 1: 100k
      // Day 2: Market drops to 80k (-20%)
      // Day 3: Deposit 100k, total = 180k
      // Day 4: Market recovers +25% -> 180k * 1.25 = 225k
      const valuations: DailyValuation[] = [
        { date: '2025-01-01', marketValue: 100000 },
        { date: '2025-01-02', marketValue: 80000 },
        { date: '2025-01-03', marketValue: 180000 }, // After deposit
        { date: '2025-01-04', marketValue: 225000 }, // +25% on 180k
      ];
      const cashFlows: CashFlow[] = [
        { date: '2025-01-03', amount: 100000, type: 'deposit' },
      ];

      const ttwror = calculateTTWROR(valuations, cashFlows);
      
      // TTWROR: 
      // Day 2: 80k/100k - 1 = -20%
      // Day 3: 180k / (80k + 100k) - 1 = 0% (deposit neutralized)
      // Day 4: 225k / 180k - 1 = +25%
      // Total: (0.8 * 1.0 * 1.25) - 1 = 0% (break even)
      expect(ttwror.totalReturn).toBeCloseTo(0.0, 1);

      // IRR would be different because the investor put in 200k total and got 225k
      const irrResult = calculateIRR(100000, 225000, cashFlows, '2025-01-01', '2025-01-04');
      // The investor made money (225k on 200k invested), so IRR > 0
      expect(irrResult.periodicIRR).toBeGreaterThan(0);
    });
  });
});
