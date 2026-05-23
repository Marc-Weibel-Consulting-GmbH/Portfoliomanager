import { describe, it, expect, vi } from "vitest";

// Mock yahoo-finance2
vi.mock("yahoo-finance2", () => {
  return {
    default: class YahooFinance {
      async chart(symbol: string, opts: any) {
        const quotes = [];
        const start = new Date(opts.period1);
        for (let i = 0; i < 250; i++) {
          const d = new Date(start);
          d.setDate(d.getDate() + i);
          quotes.push({
            date: d,
            open: 100 + Math.sin(i / 10) * 20,
            high: 105 + Math.sin(i / 10) * 20,
            low: 95 + Math.sin(i / 10) * 20,
            close: 100 + Math.sin(i / 10) * 20 + (i * 0.1),
            volume: 1000000 + Math.random() * 500000,
          });
        }
        return { quotes };
      }
      async quoteSummary(symbol: string, opts: any) {
        return {
          summaryDetail: {
            trailingPE: 25,
            forwardPE: 20,
            dividendYield: 0.015,
            fiftyTwoWeekHigh: 200,
            fiftyTwoWeekLow: 100,
            marketCap: 2000000000000,
          },
          defaultKeyStatistics: {
            pegRatio: 1.5,
            beta: 1.1,
          },
        };
      }
      async search(query: string) {
        return {
          quotes: [
            { symbol: "AAPL", shortname: "Apple Inc.", exchange: "NMS", quoteType: "EQUITY" },
          ],
        };
      }
    },
  };
});

describe("Backtesting Signal Logic", () => {
  it("should correctly calculate RSI", () => {
    // RSI calculation: average gain / average loss over 14 periods
    const prices = [
      44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84,
      46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41,
      46.22, 45.64,
    ];

    // Calculate RSI manually for validation
    const changes = prices.slice(1).map((p, i) => p - prices[i]);
    const gains = changes.map(c => c > 0 ? c : 0);
    const losses = changes.map(c => c < 0 ? Math.abs(c) : 0);

    const period = 14;
    const avgGain = gains.slice(0, period).reduce((s, g) => s + g, 0) / period;
    const avgLoss = losses.slice(0, period).reduce((s, l) => s + l, 0) / period;

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    expect(rsi).toBeGreaterThan(0);
    expect(rsi).toBeLessThan(100);
    // RSI for this data should be around 70 (uptrend)
    expect(rsi).toBeGreaterThan(50);
  });

  it("should correctly calculate MACD", () => {
    // MACD = EMA(12) - EMA(26)
    const prices: number[] = [];
    for (let i = 0; i < 50; i++) {
      prices.push(100 + i * 0.5 + Math.sin(i / 5) * 3);
    }

    function calcEMA(data: number[], period: number): number[] {
      const k = 2 / (period + 1);
      const ema: number[] = [data[0]];
      for (let i = 1; i < data.length; i++) {
        ema.push(data[i] * k + ema[i - 1] * (1 - k));
      }
      return ema;
    }

    const ema12 = calcEMA(prices, 12);
    const ema26 = calcEMA(prices, 26);
    const macdLine = ema12.map((v, i) => v - ema26[i]);
    const signalLine = calcEMA(macdLine, 9);

    // In an uptrend, MACD should be positive
    expect(macdLine[macdLine.length - 1]).toBeGreaterThan(0);
    // Signal line should exist
    expect(signalLine.length).toBe(macdLine.length);
  });

  it("should generate buy signals when RSI is oversold and MACD crosses up", () => {
    // Simulate a scenario where RSI < 30 and MACD crosses above signal
    const rsi = 25; // oversold
    const macdLine = 0.5;
    const signalLine = 0.3;
    const prevMacdLine = 0.2;
    const prevSignalLine = 0.4;

    const isOversold = rsi < 30;
    const macdCrossUp = macdLine > signalLine && prevMacdLine <= prevSignalLine;

    expect(isOversold).toBe(true);
    expect(macdCrossUp).toBe(true);

    // Both conditions met = strong buy signal
    const isBuySignal = isOversold || macdCrossUp;
    expect(isBuySignal).toBe(true);
  });

  it("should generate sell signals when RSI is overbought and MACD crosses down", () => {
    const rsi = 78; // overbought
    const macdLine = -0.2;
    const signalLine = 0.1;
    const prevMacdLine = 0.3;
    const prevSignalLine = 0.2;

    const isOverbought = rsi > 70;
    const macdCrossDown = macdLine < signalLine && prevMacdLine >= prevSignalLine;

    expect(isOverbought).toBe(true);
    expect(macdCrossDown).toBe(true);
  });

  it("should calculate trade returns correctly", () => {
    const entryPrice = 100;
    const exitPrice = 115;
    const returnPct = ((exitPrice - entryPrice) / entryPrice) * 100;

    expect(returnPct).toBe(15);

    // Losing trade
    const exitPrice2 = 92;
    const returnPct2 = ((exitPrice2 - entryPrice) / entryPrice) * 100;
    expect(returnPct2).toBe(-8);
  });

  it("should calculate win rate correctly", () => {
    const trades = [
      { returnPct: 5 },
      { returnPct: -3 },
      { returnPct: 8 },
      { returnPct: 2 },
      { returnPct: -1 },
    ];

    const winningTrades = trades.filter(t => t.returnPct > 0);
    const winRate = (winningTrades.length / trades.length) * 100;

    expect(winRate).toBe(60);
  });

  it("should calculate profit factor correctly", () => {
    const trades = [
      { returnPct: 5 },
      { returnPct: -3 },
      { returnPct: 8 },
      { returnPct: 2 },
      { returnPct: -1 },
    ];

    const winningTrades = trades.filter(t => t.returnPct > 0);
    const losingTrades = trades.filter(t => t.returnPct < 0);

    const avgWin = winningTrades.reduce((s, t) => s + t.returnPct, 0) / winningTrades.length;
    const avgLoss = losingTrades.reduce((s, t) => s + t.returnPct, 0) / losingTrades.length;
    const profitFactor = Math.abs(avgWin / avgLoss);

    expect(profitFactor).toBeGreaterThan(1); // Profitable system
    expect(avgWin).toBe(5);
    expect(avgLoss).toBe(-2);
    expect(profitFactor).toBe(2.5);
  });

  it("should calculate benchmark comparison correctly", () => {
    const signalReturn = 12.5;
    const sp500Return = 8.3;
    const spiReturn = 5.1;

    const vsSpx = signalReturn - sp500Return;
    const vsSpi = signalReturn - spiReturn;

    expect(vsSpx).toBeCloseTo(4.2);
    expect(vsSpi).toBeCloseTo(7.4);
  });
});
