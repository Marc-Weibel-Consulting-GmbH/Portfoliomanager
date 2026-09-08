import { describe, expect, it } from "vitest";
import { classifyPortfolioStockSearch } from "./portfolioAddableStockSearch";

const stocks = [
  { ticker: "SLHN.SW", companyName: "Swiss Life Holding" },
  { ticker: "ZURN.SW", companyName: "Zurich Insurance Group" },
];

describe("classifyPortfolioStockSearch", () => {
  it("weist Swiss Life als bereits vorhandene Position aus, statt sie wie einen nicht gefundenen Watchlisttitel zu behandeln", () => {
    expect(classifyPortfolioStockSearch({
      query: "Swiss Life",
      allStocks: stocks,
      portfolioTickers: ["SLHN.SW"],
    })).toEqual({
      addable: [],
      alreadyIncluded: [stocks[0]],
    });
  });

  it("liefert einen passenden, noch nicht gehaltenen Watchlisttitel als hinzufügbar", () => {
    expect(classifyPortfolioStockSearch({
      query: "Zurich",
      allStocks: stocks,
      portfolioTickers: ["SLHN.SW"],
    })).toEqual({
      addable: [stocks[1]],
      alreadyIncluded: [],
    });
  });
});
