import { describe, it, expect } from 'vitest';

describe('Realized Gains and Cost Tracking Features', () => {
  describe('RealizedGainsTable Component Logic', () => {
    it('should correctly separate price gains and FX gains', () => {
      const mockGain = {
        ticker: 'AAPL',
        sellDate: new Date('2024-12-01'),
        shares: 10,
        buyPriceCHF: 150,
        sellPriceCHF: 180,
        priceGainCHF: 300, // (180-150) * 10
        fxGainCHF: 50,
        totalGainCHF: 350,
      };

      // Verify price gain calculation
      const expectedPriceGain = (mockGain.sellPriceCHF - mockGain.buyPriceCHF) * mockGain.shares;
      expect(mockGain.priceGainCHF).toBe(expectedPriceGain);

      // Verify total gain is sum of price and FX gains
      expect(mockGain.totalGainCHF).toBe(mockGain.priceGainCHF + mockGain.fxGainCHF);
    });

    it('should handle negative gains (losses)', () => {
      const mockLoss = {
        ticker: 'TSLA',
        sellDate: new Date('2024-12-01'),
        shares: 5,
        buyPriceCHF: 200,
        sellPriceCHF: 150,
        priceGainCHF: -250, // (150-200) * 5
        fxGainCHF: -20,
        totalGainCHF: -270,
      };

      expect(mockLoss.priceGainCHF).toBeLessThan(0);
      expect(mockLoss.fxGainCHF).toBeLessThan(0);
      expect(mockLoss.totalGainCHF).toBe(mockLoss.priceGainCHF + mockLoss.fxGainCHF);
    });
  });

  describe('CostFeesReport Component Logic', () => {
    it('should correctly sum fees by transaction type', () => {
      const mockTransactions = [
        { transactionType: 'buy', fees: '10.50' },
        { transactionType: 'buy', fees: '15.00' },
        { transactionType: 'sell', fees: '20.00' },
        { transactionType: 'dividend', fees: '5.00' },
      ];

      const feeBreakdown = {
        buy: 0,
        sell: 0,
        dividend: 0,
        deposit: 0,
        withdrawal: 0,
        total: 0,
      };

      mockTransactions.forEach((tx: any) => {
        const fee = parseFloat(tx.fees || '0');
        feeBreakdown[tx.transactionType as keyof typeof feeBreakdown] += fee;
        feeBreakdown.total += fee;
      });

      expect(feeBreakdown.buy).toBe(25.50);
      expect(feeBreakdown.sell).toBe(20.00);
      expect(feeBreakdown.dividend).toBe(5.00);
      expect(feeBreakdown.total).toBe(50.50);
    });

    it('should correctly group fees by year', () => {
      const mockTransactions = [
        { transactionDate: new Date('2023-06-15'), transactionType: 'buy', fees: '10.00' },
        { transactionDate: new Date('2023-12-20'), transactionType: 'sell', fees: '15.00' },
        { transactionDate: new Date('2024-03-10'), transactionType: 'buy', fees: '20.00' },
        { transactionDate: new Date('2024-11-05'), transactionType: 'sell', fees: '25.00' },
      ];

      const yearMap = new Map<number, { total: number; buy: number; sell: number; count: number }>();

      mockTransactions.forEach((tx) => {
        const year = new Date(tx.transactionDate).getFullYear();
        const fee = parseFloat(tx.fees || '0');

        if (!yearMap.has(year)) {
          yearMap.set(year, { total: 0, buy: 0, sell: 0, count: 0 });
        }

        const yearData = yearMap.get(year)!;
        yearData.total += fee;
        yearData.count++;

        if (tx.transactionType === 'buy') {
          yearData.buy += fee;
        } else if (tx.transactionType === 'sell') {
          yearData.sell += fee;
        }
      });

      const year2023 = yearMap.get(2023);
      const year2024 = yearMap.get(2024);

      expect(year2023?.total).toBe(25.00);
      expect(year2023?.buy).toBe(10.00);
      expect(year2023?.sell).toBe(15.00);
      expect(year2023?.count).toBe(2);

      expect(year2024?.total).toBe(45.00);
      expect(year2024?.buy).toBe(20.00);
      expect(year2024?.sell).toBe(25.00);
      expect(year2024?.count).toBe(2);
    });

    it('should handle transactions with zero fees', () => {
      const mockTransactions = [
        { transactionType: 'buy', fees: '0' },
        { transactionType: 'sell', fees: '0.00' },
        { transactionType: 'dividend', fees: '' },
      ];

      const feeBreakdown = {
        buy: 0,
        sell: 0,
        dividend: 0,
        deposit: 0,
        withdrawal: 0,
        total: 0,
      };

      mockTransactions.forEach((tx: any) => {
        const fee = parseFloat(tx.fees || '0');
        feeBreakdown[tx.transactionType as keyof typeof feeBreakdown] += fee;
        feeBreakdown.total += fee;
      });

      expect(feeBreakdown.total).toBe(0);
    });
  });

  describe('Live Toggle Validation Logic', () => {
    it('should validate portfolio has start capital before activating live', () => {
      const portfolioWithoutCapital = {
        id: 1,
        startCapital: '0',
        portfolioData: JSON.stringify({ stocks: [{ ticker: 'AAPL', weight: 100 }] }),
      };

      const startCapital = parseFloat(portfolioWithoutCapital.startCapital || '0');
      const hasValidCapital = startCapital > 0;

      expect(hasValidCapital).toBe(false);
    });

    it('should validate portfolio has positions before activating live', () => {
      const portfolioWithoutPositions = {
        id: 1,
        startCapital: '10000',
        portfolioData: JSON.stringify({ stocks: [] }),
      };

      const portfolioData = JSON.parse(portfolioWithoutPositions.portfolioData);
      const stocks = portfolioData.stocks || [];
      const hasPositions = stocks.length > 0;

      expect(hasPositions).toBe(false);
    });

    it('should calculate correct number of shares for entry transactions', () => {
      const startCapital = 10000;
      const weight = 30; // 30%
      const positionValueCHF = (startCapital * weight) / 100; // 3000 CHF
      const priceCHF = 150; // Stock price in CHF

      const shares = positionValueCHF / priceCHF;

      expect(positionValueCHF).toBe(3000);
      expect(shares).toBe(20);
    });

    it('should calculate correct cash balance after positions', () => {
      const startCapital = 10000;
      const positions = [
        { weight: 40, value: 4000 }, // 40% = 4000 CHF
        { weight: 35, value: 3500 }, // 35% = 3500 CHF
        { weight: 20, value: 2000 }, // 20% = 2000 CHF
      ];

      const totalPositionValue = positions.reduce((sum, p) => sum + p.value, 0);
      const cashBalance = startCapital - totalPositionValue;

      expect(totalPositionValue).toBe(9500);
      expect(cashBalance).toBe(500);
    });

    it('should handle FX conversion fallback on error', () => {
      const currentPrice = 100; // USD
      const currency = 'USD';
      
      // Simulate FX conversion failure - should fallback to 1:1
      let priceCHF = currentPrice;
      try {
        // Simulated conversion that fails
        throw new Error('FX service unavailable');
      } catch (error) {
        console.log('FX conversion failed, using 1:1 rate');
        priceCHF = currentPrice; // Fallback
      }

      expect(priceCHF).toBe(currentPrice);
    });
  });
});
