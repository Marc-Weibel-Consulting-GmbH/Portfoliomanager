import { describe, it, expect } from 'vitest';

describe('Currency Conversion and Realized Gains', () => {
  describe('FX Rate Calculations', () => {
    it('should calculate correct CHF value from USD', () => {
      const usdAmount = 1000;
      const fxRate = 0.88; // 1 USD = 0.88 CHF
      const chfAmount = usdAmount * fxRate;

      expect(chfAmount).toBe(880);
    });

    it('should calculate correct CHF value from EUR', () => {
      const eurAmount = 1000;
      const fxRate = 0.93; // 1 EUR = 0.93 CHF
      const chfAmount = eurAmount * fxRate;

      expect(chfAmount).toBe(930);
    });

    it('should handle CHF to CHF conversion (identity)', () => {
      const chfAmount = 1000;
      const fxRate = 1.0; // 1 CHF = 1 CHF
      const result = chfAmount * fxRate;

      expect(result).toBe(1000);
    });
  });

  describe('Realized Gains with Currency Split', () => {
    it('should calculate stock gain in local currency', () => {
      // Buy 100 shares at $150, sell at $160
      const shares = 100;
      const buyPrice = 150;
      const sellPrice = 160;

      const stockGainLocal = (sellPrice - buyPrice) * shares;

      expect(stockGainLocal).toBe(1000); // $1000 stock gain
    });

    it('should calculate FX gain separately', () => {
      // Buy 100 shares at $150 when USD/CHF = 0.90
      // Sell 100 shares at $160 when USD/CHF = 0.88
      const shares = 100;
      const buyPrice = 150;
      const sellPrice = 160;
      const buyFxRate = 0.90;
      const sellFxRate = 0.88;

      // Stock gain in USD
      const stockGainLocal = (sellPrice - buyPrice) * shares; // $1000

      // Total amounts in CHF
      const buyCostCHF = shares * buyPrice * buyFxRate; // 100 * 150 * 0.90 = 13500 CHF
      const sellProceedsCHF = shares * sellPrice * sellFxRate; // 100 * 160 * 0.88 = 14080 CHF

      // Total realized gain in CHF
      const totalRealizedGainCHF = sellProceedsCHF - buyCostCHF; // 14080 - 13500 = 580 CHF

      // Stock gain in CHF (using sell FX rate)
      const stockGainCHF = stockGainLocal * sellFxRate; // 1000 * 0.88 = 880 CHF

      // FX gain = Total gain - Stock gain
      const fxGain = totalRealizedGainCHF - stockGainCHF; // 580 - 880 = -300 CHF

      expect(stockGainLocal).toBe(1000); // $1000 stock gain
      expect(stockGainCHF).toBe(880); // 880 CHF stock gain
      expect(fxGain).toBe(-300); // -300 CHF FX loss (USD weakened)
      expect(totalRealizedGainCHF).toBe(580); // 580 CHF total gain
    });

    it('should handle FX gain when currency strengthens', () => {
      // Buy 100 shares at $150 when USD/CHF = 0.88
      // Sell 100 shares at $150 when USD/CHF = 0.90 (USD strengthened)
      const shares = 100;
      const buyPrice = 150;
      const sellPrice = 150; // No stock gain
      const buyFxRate = 0.88;
      const sellFxRate = 0.90;

      // Stock gain in USD
      const stockGainLocal = (sellPrice - buyPrice) * shares; // $0

      // Total amounts in CHF
      const buyCostCHF = shares * buyPrice * buyFxRate; // 100 * 150 * 0.88 = 13200 CHF
      const sellProceedsCHF = shares * sellPrice * sellFxRate; // 100 * 150 * 0.90 = 13500 CHF

      // Total realized gain in CHF
      const totalRealizedGainCHF = sellProceedsCHF - buyCostCHF; // 13500 - 13200 = 300 CHF

      // Stock gain in CHF (using sell FX rate)
      const stockGainCHF = stockGainLocal * sellFxRate; // 0 * 0.90 = 0 CHF

      // FX gain = Total gain - Stock gain
      const fxGain = totalRealizedGainCHF - stockGainCHF; // 300 - 0 = 300 CHF

      expect(stockGainLocal).toBe(0); // $0 stock gain
      expect(stockGainCHF).toBe(0); // 0 CHF stock gain
      expect(fxGain).toBe(300); // 300 CHF FX gain (USD strengthened)
      expect(totalRealizedGainCHF).toBe(300); // 300 CHF total gain
    });

    it('should calculate correct average cost basis for partial sells', () => {
      // Buy 100 shares at $150, then 50 shares at $160
      // Average cost = (100*150 + 50*160) / 150 = 153.33
      const buy1Shares = 100;
      const buy1Price = 150;
      const buy2Shares = 50;
      const buy2Price = 160;

      const totalCost = buy1Shares * buy1Price + buy2Shares * buy2Price;
      const totalShares = buy1Shares + buy2Shares;
      const avgCost = totalCost / totalShares;

      expect(avgCost).toBeCloseTo(153.33, 2);

      // Sell 75 shares at $170
      const sellShares = 75;
      const sellPrice = 170;

      const realizedGain = (sellPrice - avgCost) * sellShares;

      expect(realizedGain).toBeCloseTo(1250, 0); // (170 - 153.33) * 75 ≈ 1250
    });
  });

  describe('Tax Reporting - Realized Gains Split', () => {
    it('should separate stock gains and FX gains for tax purposes', () => {
      // Scenario: Swiss tax requires separate reporting of stock gains and FX gains
      // Buy 100 AAPL at $150 when USD/CHF = 0.90
      // Sell 100 AAPL at $160 when USD/CHF = 0.88

      const shares = 100;
      const buyPrice = 150;
      const sellPrice = 160;
      const buyFxRate = 0.90;
      const sellFxRate = 0.88;

      // Stock gain in USD (taxable as capital gain)
      const stockGainUSD = (sellPrice - buyPrice) * shares; // $1000

      // Buy cost in CHF
      const buyCostCHF = shares * buyPrice * buyFxRate; // 13500 CHF

      // Sell proceeds in CHF
      const sellProceedsCHF = shares * sellPrice * sellFxRate; // 14080 CHF

      // Total realized gain in CHF
      const totalRealizedGainCHF = sellProceedsCHF - buyCostCHF; // 580 CHF

      // Stock gain in CHF (for tax reporting)
      const stockGainCHF = stockGainUSD * sellFxRate; // 880 CHF

      // FX gain/loss (for tax reporting)
      const fxGain = totalRealizedGainCHF - stockGainCHF; // -300 CHF

      // Tax reporting structure
      const taxReport = {
        ticker: 'AAPL',
        shares,
        stockGainLocal: stockGainUSD,
        stockGainCHF,
        fxGain,
        totalRealizedGainCHF,
        buyFxRate,
        sellFxRate,
      };

      expect(taxReport.stockGainLocal).toBe(1000);
      expect(taxReport.stockGainCHF).toBe(880);
      expect(taxReport.fxGain).toBe(-300);
      expect(taxReport.totalRealizedGainCHF).toBe(580);
    });

    it('should handle multiple sells with different FX rates', () => {
      // Buy 200 shares at $150 when USD/CHF = 0.90
      // Sell 100 shares at $160 when USD/CHF = 0.88
      // Sell 100 shares at $165 when USD/CHF = 0.87

      const buyShares = 200;
      const buyPrice = 150;
      const buyFxRate = 0.90;

      const sell1Shares = 100;
      const sell1Price = 160;
      const sell1FxRate = 0.88;

      const sell2Shares = 100;
      const sell2Price = 165;
      const sell2FxRate = 0.87;

      // Sell 1
      const sell1StockGainUSD = (sell1Price - buyPrice) * sell1Shares; // $1000
      const sell1BuyCostCHF = sell1Shares * buyPrice * buyFxRate; // 13500 CHF
      const sell1ProceedsCHF = sell1Shares * sell1Price * sell1FxRate; // 14080 CHF
      const sell1TotalGainCHF = sell1ProceedsCHF - sell1BuyCostCHF; // 580 CHF
      const sell1StockGainCHF = sell1StockGainUSD * sell1FxRate; // 880 CHF
      const sell1FxGain = sell1TotalGainCHF - sell1StockGainCHF; // -300 CHF

      // Sell 2
      const sell2StockGainUSD = (sell2Price - buyPrice) * sell2Shares; // $1500
      const sell2BuyCostCHF = sell2Shares * buyPrice * buyFxRate; // 13500 CHF
      const sell2ProceedsCHF = sell2Shares * sell2Price * sell2FxRate; // 14355 CHF
      const sell2TotalGainCHF = sell2ProceedsCHF - sell2BuyCostCHF; // 855 CHF
      const sell2StockGainCHF = sell2StockGainUSD * sell2FxRate; // 1305 CHF
      const sell2FxGain = sell2TotalGainCHF - sell2StockGainCHF; // -450 CHF

      // Total
      const totalStockGainUSD = sell1StockGainUSD + sell2StockGainUSD; // $2500
      const totalStockGainCHF = sell1StockGainCHF + sell2StockGainCHF; // 2185 CHF
      const totalFxGain = sell1FxGain + sell2FxGain; // -750 CHF
      const totalRealizedGainCHF = sell1TotalGainCHF + sell2TotalGainCHF; // 1435 CHF

      expect(totalStockGainUSD).toBe(2500);
      expect(totalStockGainCHF).toBe(2185);
      expect(totalFxGain).toBe(-750);
      expect(totalRealizedGainCHF).toBe(1435);
    });
  });
});
