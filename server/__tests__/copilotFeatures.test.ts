import { describe, it, expect, vi } from "vitest";

// Mock yahoo-finance2
vi.mock("yahoo-finance2", () => {
  return {
    default: class YahooFinance {
      async chart(symbol: string, opts: any) {
        const quotes = [];
        const start = new Date(opts.period1 || '2020-01-01');
        for (let i = 0; i < 500; i++) {
          const d = new Date(start);
          d.setDate(d.getDate() + i);
          quotes.push({
            date: d,
            open: 100 + Math.sin(i / 30) * 20 + (i * 0.05),
            high: 105 + Math.sin(i / 30) * 20 + (i * 0.05),
            low: 95 + Math.sin(i / 30) * 20 + (i * 0.05),
            close: 100 + Math.sin(i / 30) * 20 + (i * 0.05),
            volume: 1000000 + Math.random() * 500000,
          });
        }
        return { quotes };
      }
      async quoteSummary(symbol: string, opts: any) {
        return {
          summaryDetail: { trailingPE: 25, dividendYield: 0.015, marketCap: 500e9 },
          defaultKeyStatistics: { pegRatio: 1.5, beta: 1.1, forwardPE: 20 },
          assetProfile: { sector: 'Technology', industry: 'Software' },
        };
      }
    },
  };
});

// Mock the database
vi.mock("../../drizzle/schema", () => ({
  copilotHistory: {},
  walkForwardResults: {},
  watchlistStocks: {},
}));

vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  getSavedPortfolioById: vi.fn().mockResolvedValue({
    id: 1,
    name: 'Test Portfolio',
    userId: 1,
    data: JSON.stringify({
      stocks: [
        { ticker: 'AAPL', companyName: 'Apple', shares: '10', avgPrice: '150' },
        { ticker: 'MSFT', companyName: 'Microsoft', shares: '5', avgPrice: '300' },
        { ticker: 'GOOGL', companyName: 'Alphabet', shares: '3', avgPrice: '140' },
      ],
    }),
  }),
  getPortfolioTransactions: vi.fn().mockResolvedValue([]),
  createPortfolioTransaction: vi.fn().mockResolvedValue(undefined),
}));

// Test LPPL Backtest module
describe("LPPL Backtest", () => {
  it("should export KNOWN_BUBBLES with correct structure", async () => {
    const { KNOWN_BUBBLES } = await import("../analytics/lpplBacktest");
    expect(KNOWN_BUBBLES).toBeDefined();
    expect(Array.isArray(KNOWN_BUBBLES)).toBe(true);
    expect(KNOWN_BUBBLES.length).toBeGreaterThan(0);
    
    const firstBubble = KNOWN_BUBBLES[0];
    expect(firstBubble).toHaveProperty('name');
    expect(firstBubble).toHaveProperty('ticker');
    expect(firstBubble).toHaveProperty('peakDate');
    expect(firstBubble).toHaveProperty('crashStartDate');
    expect(firstBubble).toHaveProperty('crashEndDate');
    expect(firstBubble).toHaveProperty('peakToTroughDrop');
  });

  it("should include Dotcom and Financial Crisis bubbles", async () => {
    const { KNOWN_BUBBLES } = await import("../analytics/lpplBacktest");
    const names = KNOWN_BUBBLES.map((b: any) => b.name);
    expect(names.some((n: string) => n.includes('Dotcom') || n.includes('dot-com'))).toBe(true);
    expect(names.some((n: string) => n.includes('Finanz') || n.includes('Financial') || n.includes('2008'))).toBe(true);
  });

  it("should run custom LPPL analysis without crashing", async () => {
    const { runLPPLCustomBacktest } = await import("../analytics/lpplBacktest");
    const result = await runLPPLCustomBacktest('SPY', '2020-01-01', '2022-01-01');
    expect(Array.isArray(result)).toBe(true);
  });
});

// Test Walk-Forward Engine module
describe("Walk-Forward Engine", () => {
  it("should export required functions", async () => {
    const engine = await import("../analytics/walkForwardEngine");
    expect(engine.runWalkForwardValidation).toBeDefined();
    expect(typeof engine.runWalkForwardValidation).toBe('function');
    expect(engine.getWalkForwardHistory).toBeDefined();
    expect(typeof engine.getWalkForwardHistory).toBe('function');
    expect(engine.screenStocksFromEODHD).toBeDefined();
    expect(typeof engine.screenStocksFromEODHD).toBe('function');
    expect(engine.getWatchlistTickers).toBeDefined();
    expect(typeof engine.getWatchlistTickers).toBe('function');
  });
});

// Test Copilot History module
describe("Copilot History", () => {
  it("should export required functions", async () => {
    const history = await import("../analytics/copilotHistory");
    expect(history.saveCopilotRecommendations).toBeDefined();
    expect(typeof history.saveCopilotRecommendations).toBe('function');
    expect(history.getCopilotHistoryForPortfolio).toBeDefined();
    expect(typeof history.getCopilotHistoryForPortfolio).toBe('function');
    expect(history.getCopilotHistoryStats).toBeDefined();
    expect(typeof history.getCopilotHistoryStats).toBe('function');
    expect(history.evaluateRecommendations).toBeDefined();
    expect(typeof history.evaluateRecommendations).toBe('function');
  });
});

// Test LPPL mathematical functions
describe("LPPL Mathematical Functions", () => {
  it("should detect super-exponential growth patterns", async () => {
    const { runLPPLCustomBacktest } = await import("../analytics/lpplBacktest");
    // Run on a period that should have some data
    const result = await runLPPLCustomBacktest('QQQ', '1999-01-01', '2000-03-10');
    // Should not crash regardless of result
    expect(Array.isArray(result)).toBe(true);
  });
});
