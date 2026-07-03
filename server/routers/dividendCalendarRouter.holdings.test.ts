/**
 * R-31 — Unit-Tests für die Holdings-Aggregation des Dividendenkalenders.
 * Pinnt die korrigierte Semantik: `entry` zählt wie `buy` (konsistent mit
 * performanceEngine.buildHoldingsTimeline), und der Fallback aus portfolioData
 * erfindet keine `|| 1`-Phantom-Aktie mehr — ohne Stückzahl wird die Position
 * mit 0 geführt und später herausgefiltert.
 */

import { describe, it, expect } from "vitest";
import {
  aggregateHoldingsFromTransactions,
  aggregateHoldingsFromPortfolioData,
} from "./dividendCalendarRouter";

describe("R-31 aggregateHoldingsFromTransactions", () => {
  it("zählt entry-Transaktionen wie buy (toggleLive-Portfolios)", () => {
    const holdings = aggregateHoldingsFromTransactions([
      { ticker: "NESN.SW", transactionType: "entry", shares: "50" },
      { ticker: "NESN.SW", transactionType: "buy", shares: "10" },
      { ticker: "NOVN.SW", transactionType: "entry", shares: "20" },
    ]);
    expect(holdings).toEqual({ "NESN.SW": 60, "NOVN.SW": 20 });
  });

  it("subtrahiert sell und ignoriert nicht-bestandswirksame Typen", () => {
    const holdings = aggregateHoldingsFromTransactions([
      { ticker: "AAPL", transactionType: "buy", shares: "30" },
      { ticker: "AAPL", transactionType: "sell", shares: "12" },
      { ticker: "AAPL", transactionType: "dividend", shares: "5" },
      { ticker: "AAPL", transactionType: "deposit", shares: null },
    ]);
    expect(holdings).toEqual({ AAPL: 18 });
  });

  it("überspringt Zeilen ohne parsebare Stückzahl statt sie zu erfinden", () => {
    const holdings = aggregateHoldingsFromTransactions([
      { ticker: "ROG.SW", transactionType: "buy", shares: null },
      { ticker: "ROG.SW", transactionType: "buy", shares: "abc" },
      { ticker: "ROG.SW", transactionType: "buy", shares: "7" },
    ]);
    expect(holdings).toEqual({ "ROG.SW": 7 });
  });
});

describe("R-31 aggregateHoldingsFromPortfolioData", () => {
  it("kein || 1-Phantom: Stocks ohne shares/quantity ergeben keinen Bestand", () => {
    const holdings = aggregateHoldingsFromPortfolioData([
      { ticker: "NESN.SW", shares: "25" },
      { ticker: "NOVN.SW" }, // keine Stückzahl → vorher 1 Phantom-Aktie
      { ticker: "CASH", shares: "1000" },
      { ticker: "ZURN.SW", quantity: "4" },
    ]);
    expect(holdings).toEqual({ "NESN.SW": 25, "ZURN.SW": 4 });
  });
});
