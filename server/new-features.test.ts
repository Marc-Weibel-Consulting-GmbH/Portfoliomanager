import { describe, it, expect } from "vitest";

// Test the strategy presets
describe("Strategy Presets", () => {
  it("should define 3 presets with correct structure", async () => {
    const { STRATEGY_PRESETS } = await import("./analytics/optimizerWorker");
    
    expect(STRATEGY_PRESETS).toBeDefined();
    expect(Object.keys(STRATEGY_PRESETS)).toHaveLength(3);
    expect(STRATEGY_PRESETS).toHaveProperty("shortTerm");
    expect(STRATEGY_PRESETS).toHaveProperty("midTerm");
    expect(STRATEGY_PRESETS).toHaveProperty("longTerm");
  });

  it("each preset should have name, description, and weights", async () => {
    const { STRATEGY_PRESETS } = await import("./analytics/optimizerWorker");
    
    for (const [key, preset] of Object.entries(STRATEGY_PRESETS)) {
      expect(preset).toHaveProperty("name");
      expect(preset).toHaveProperty("description");
      expect(preset).toHaveProperty("weights");
      expect(typeof preset.name).toBe("string");
      expect(typeof preset.description).toBe("string");
      expect(typeof preset.weights).toBe("object");
    }
  });

  it("preset weights should sum to approximately 1.0 (100%)", async () => {
    const { STRATEGY_PRESETS } = await import("./analytics/optimizerWorker");
    
    for (const [key, preset] of Object.entries(STRATEGY_PRESETS)) {
      const sum = Object.values(preset.weights).reduce((acc: number, val: any) => acc + val, 0);
      expect(sum).toBeCloseTo(1.0, 1); // Weights are decimals summing to 1.0
    }
  });

  it("midTerm preset should be the recommended default", async () => {
    const { STRATEGY_PRESETS } = await import("./analytics/optimizerWorker");
    
    // Mid-term should emphasize quality + momentum (weights are 0-1 decimals)
    const midTerm = STRATEGY_PRESETS.midTerm;
    expect(midTerm.weights.quality).toBeGreaterThanOrEqual(0.10);
    expect(midTerm.weights.momentum).toBeGreaterThanOrEqual(0.08);
  });
});

// Test the currency filtering logic
describe("Currency Filtering for KI-Empfehlungen", () => {
  it("CHF filter should match .SW tickers", () => {
    const chfFilter = (t: string) => t.endsWith(".SW");
    
    expect(chfFilter("NESN.SW")).toBe(true);
    expect(chfFilter("NOVN.SW")).toBe(true);
    expect(chfFilter("AAPL")).toBe(false);
    expect(chfFilter("SAP.DE")).toBe(false);
  });

  it("EUR filter should match .PA, .DE, .AS, .MI tickers", () => {
    const eurFilter = (t: string) => t.endsWith(".PA") || t.endsWith(".DE") || t.endsWith(".AS") || t.endsWith(".MI");
    
    expect(eurFilter("SAP.DE")).toBe(true);
    expect(eurFilter("LVMH.PA")).toBe(true);
    expect(eurFilter("ASML.AS")).toBe(true);
    expect(eurFilter("NESN.SW")).toBe(false);
    expect(eurFilter("AAPL")).toBe(false);
  });

  it("USD filter should match tickers without dots", () => {
    const usdFilter = (t: string) => !t.includes(".");
    
    expect(usdFilter("AAPL")).toBe(true);
    expect(usdFilter("MSFT")).toBe(true);
    expect(usdFilter("NESN.SW")).toBe(false);
    expect(usdFilter("SAP.DE")).toBe(false);
  });
});

// Test the sorting logic
describe("Watchlist Sorting", () => {
  const mockStocks = [
    { ticker: "AAPL", companyName: "Apple", currentPrice: "150.00", peRatio: "25.5", dividendYield: "0.5", signalType: "buy", signalScore: 80 },
    { ticker: "MSFT", companyName: "Microsoft", currentPrice: "300.00", peRatio: "30.2", dividendYield: "0.8", signalType: "hold", signalScore: 55 },
    { ticker: "VZ", companyName: "Verizon", currentPrice: "40.00", peRatio: "8.5", dividendYield: "6.5", signalType: "buy", signalScore: 70 },
  ];

  it("should sort by score descending", () => {
    const sorted = [...mockStocks].sort((a, b) => b.signalScore - a.signalScore);
    expect(sorted[0].ticker).toBe("AAPL");
    expect(sorted[1].ticker).toBe("VZ");
    expect(sorted[2].ticker).toBe("MSFT");
  });

  it("should sort by ticker ascending", () => {
    const sorted = [...mockStocks].sort((a, b) => a.ticker.localeCompare(b.ticker));
    expect(sorted[0].ticker).toBe("AAPL");
    expect(sorted[1].ticker).toBe("MSFT");
    expect(sorted[2].ticker).toBe("VZ");
  });

  it("should sort by price descending", () => {
    const sorted = [...mockStocks].sort((a, b) => parseFloat(b.currentPrice) - parseFloat(a.currentPrice));
    expect(sorted[0].ticker).toBe("MSFT");
    expect(sorted[1].ticker).toBe("AAPL");
    expect(sorted[2].ticker).toBe("VZ");
  });

  it("should sort by dividend yield descending", () => {
    const sorted = [...mockStocks].sort((a, b) => parseFloat(b.dividendYield) - parseFloat(a.dividendYield));
    expect(sorted[0].ticker).toBe("VZ");
    expect(sorted[1].ticker).toBe("MSFT");
    expect(sorted[2].ticker).toBe("AAPL");
  });
});

// Test chart period filtering
describe("Chart Period Filtering", () => {
  it("should calculate correct start dates for each period", () => {
    const now = new Date("2026-05-24");
    
    const getStartDate = (period: string) => {
      let startDate = new Date(now);
      switch (period) {
        case "1M": startDate.setMonth(now.getMonth() - 1); break;
        case "3M": startDate.setMonth(now.getMonth() - 3); break;
        case "6M": startDate.setMonth(now.getMonth() - 6); break;
        case "1Y": startDate.setFullYear(now.getFullYear() - 1); break;
        case "3Y": startDate.setFullYear(now.getFullYear() - 3); break;
        case "5Y": startDate.setFullYear(now.getFullYear() - 5); break;
        case "10Y": startDate.setFullYear(now.getFullYear() - 10); break;
        case "MAX": startDate = new Date("2000-01-01"); break;
        default: startDate = new Date("2000-01-01");
      }
      return startDate;
    };

    expect(getStartDate("1Y").getFullYear()).toBe(2025);
    expect(getStartDate("3Y").getFullYear()).toBe(2023);
    expect(getStartDate("5Y").getFullYear()).toBe(2021);
    expect(getStartDate("10Y").getFullYear()).toBe(2016);
    expect(getStartDate("MAX").getFullYear()).toBe(2000);
  });
});
