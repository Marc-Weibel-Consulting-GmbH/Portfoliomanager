import { describe, it, expect } from "vitest";
import { buildHoldings, type HoldingsSourceTransaction } from "./holdings";

function tx(
  transactionType: string,
  transactionDate: string,
  ticker: string | null,
  shares: string | null,
  pricePerShare: string | null = null
): HoldingsSourceTransaction {
  return { transactionType, transactionDate: new Date(transactionDate), ticker, shares, pricePerShare };
}

describe("buildHoldings", () => {
  it("replays buy/entry/sell into net shares and local cost basis", () => {
    const holdings = buildHoldings([
      tx("buy", "2024-01-02", "NESN", "100", "95"),
      tx("entry", "2024-01-03", "ROG", "10", "250"),
      tx("buy", "2024-02-01", "NESN", "100", "105"),
      tx("sell", "2024-03-01", "NESN", "50", "110"),
    ]);

    // NESN: 200 bought for 20'000, moving-average 100/share, 50 sold -> 150 @ 15'000.
    // Ohne totalAmountCHF fällt totalCostChf auf shares x pricePerShare zurück.
    expect(holdings.get("NESN")).toEqual({ shares: 150, totalCostLocal: 15000, totalCostChf: 15000 });
    // entry behaves like buy (performanceEngine semantics).
    expect(holdings.get("ROG")).toEqual({ shares: 10, totalCostLocal: 2500, totalCostChf: 2500 });
  });

  it("ignores non-position transaction types and rows without ticker", () => {
    const holdings = buildHoldings([
      tx("deposit", "2024-01-01", null, null),
      tx("buy", "2024-01-02", "NESN", "100", "95"),
      tx("dividend", "2024-06-01", "NESN", null),
      tx("withdrawal", "2024-07-01", null, null),
    ]);

    expect(holdings.size).toBe(1);
    expect(holdings.get("NESN")).toEqual({ shares: 100, totalCostLocal: 9500, totalCostChf: 9500 });
  });

  it("oversell: shares go negative (consumers filter <= 0), cost basis clamps at 0", () => {
    const holdings = buildHoldings([
      tx("buy", "2024-01-02", "ORD", "100", "10"),
      tx("sell", "2024-02-01", "ORD", "150", "12"),
    ]);

    const pos = holdings.get("ORD")!;
    expect(pos.shares).toBe(-50); // not clamped — matches performanceEngine
    expect(pos.totalCostLocal).toBe(0); // clamped — never negative
  });

  it("sell into an empty position yields no NaN and no negative cost", () => {
    const holdings = buildHoldings([
      tx("sell", "2024-01-02", "ORD", "50", "12"),
    ]);

    const pos = holdings.get("ORD")!;
    expect(pos.shares).toBe(-50);
    expect(pos.totalCostLocal).toBe(0);
    expect(Number.isFinite(pos.totalCostLocal)).toBe(true);
  });

  it("upToDate cutoff is inclusive and drops later transactions", () => {
    const txs = [
      tx("buy", "2024-01-02", "NESN", "100", "95"),
      tx("sell", "2024-02-01", "NESN", "40", "100"),
      tx("buy", "2024-03-01", "NESN", "10", "101"),
    ];

    expect(buildHoldings(txs, "2024-01-01").get("NESN")).toBeUndefined();
    expect(buildHoldings(txs, "2024-01-02").get("NESN")!.shares).toBe(100); // inclusive
    expect(buildHoldings(txs, "2024-02-15").get("NESN")!.shares).toBe(60);
    expect(buildHoldings(txs, "2024-12-31").get("NESN")!.shares).toBe(70);
  });

  it("DESC input produces the same result as ASC (sorted internally)", () => {
    const asc = [
      tx("buy", "2024-01-02", "ORD", "100", "10"),
      tx("sell", "2024-02-01", "ORD", "50", "12"),
    ];
    const desc = [...asc].reverse();

    expect(buildHoldings(desc)).toEqual(buildHoldings(asc));
    expect(buildHoldings(desc).get("ORD")).toEqual({ shares: 50, totalCostLocal: 500, totalCostChf: 500 });
  });

  it("accepts string transaction dates and non-finite share values", () => {
    const holdings = buildHoldings([
      { transactionType: "buy", transactionDate: "2024-01-02T10:30:00Z", ticker: "NESN", shares: "100", pricePerShare: "95" },
      { transactionType: "buy", transactionDate: "2024-01-03", ticker: "NESN", shares: "garbage", pricePerShare: "95" },
    ]);

    expect(holdings.get("NESN")).toEqual({ shares: 100, totalCostLocal: 9500, totalCostChf: 9500 });
  });

  it("totalCostChf accumulates totalAmountCHF and falls back to local for legacy rows", () => {
    const holdings = buildHoldings([
      // USD-Kauf: 100 x 10 USD = 1'000 lokal, aber 900 CHF laut Transaktion.
      { transactionType: "buy", transactionDate: "2024-01-02", ticker: "AAPL", shares: "100", pricePerShare: "10", totalAmountCHF: "900" },
      // Alt-Transaktion ohne CHF-Betrag: Fallback shares x pricePerShare.
      { transactionType: "buy", transactionDate: "2024-02-01", ticker: "AAPL", shares: "100", pricePerShare: "12" },
      // Verkauf der Hälfte reduziert beide Kostenbasen proportional.
      { transactionType: "sell", transactionDate: "2024-03-01", ticker: "AAPL", shares: "100", pricePerShare: "15" },
    ]);

    const pos = holdings.get("AAPL")!;
    expect(pos.shares).toBe(100);
    expect(pos.totalCostLocal).toBe(1100); // (1000 + 1200) / 2
    expect(pos.totalCostChf).toBe(1050); // (900 + 1200) / 2
  });
});
