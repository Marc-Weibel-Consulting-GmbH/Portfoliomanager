import { describe, it, expect } from "vitest";
import { computeWikifolioConsensus, type ConsensusTradeInput } from "./wikifolioConsensus";
import { mapWikifolioSearchResults } from "./wikifolioService";

const ASOF = new Date("2026-07-07T00:00:00Z").getTime();
const daysAgo = (n: number) => new Date(ASOF - n * 86_400_000).toISOString();

describe("computeWikifolioConsensus", () => {
  it("erzeugt ein Kauf-Signal, wenn genug distinct Wikifolios im Fenster kaufen", () => {
    const trades: ConsensusTradeInput[] = [
      { wikifolioId: 1, resolvedTicker: "NESN.SW", side: "buy", executedAt: daysAgo(5), sharpe: 2 },
      { wikifolioId: 2, resolvedTicker: "NESN.SW", side: "buy", executedAt: daysAgo(10), sharpe: 1 },
    ];
    const [r] = computeWikifolioConsensus(trades, { asOfMs: ASOF });
    expect(r.ticker).toBe("NESN.SW");
    expect(r.buyWikifolios).toBe(2);
    expect(r.netDirection).toBe("buy");
    expect(r.score).toBeGreaterThan(0);
    expect(r.provenance).toContain("2 erfolgreiche Wikifolios");
  });

  it("unterdrückt Signale unter der Mindestanzahl Wikifolios", () => {
    const trades: ConsensusTradeInput[] = [
      { wikifolioId: 1, resolvedTicker: "ROG.SW", side: "buy", executedAt: daysAgo(3), sharpe: 1 },
    ];
    expect(computeWikifolioConsensus(trades, { asOfMs: ASOF })).toHaveLength(0);
  });

  it("zählt ein Wikifolio je Seite nur einmal (distinct), auch bei Mehrfach-Trades", () => {
    const trades: ConsensusTradeInput[] = [
      { wikifolioId: 1, resolvedTicker: "ABBN.SW", side: "buy", executedAt: daysAgo(2), sharpe: 1 },
      { wikifolioId: 1, resolvedTicker: "ABBN.SW", side: "buy", executedAt: daysAgo(1), sharpe: 1 },
      { wikifolioId: 2, resolvedTicker: "ABBN.SW", side: "buy", executedAt: daysAgo(1), sharpe: 1 },
    ];
    const [r] = computeWikifolioConsensus(trades, { asOfMs: ASOF });
    expect(r.buyWikifolios).toBe(2);
  });

  it("ignoriert Trades ausserhalb des Fensters", () => {
    const trades: ConsensusTradeInput[] = [
      { wikifolioId: 1, resolvedTicker: "UBSG.SW", side: "buy", executedAt: daysAgo(40), sharpe: 1 },
      { wikifolioId: 2, resolvedTicker: "UBSG.SW", side: "buy", executedAt: daysAgo(45), sharpe: 1 },
    ];
    expect(computeWikifolioConsensus(trades, { asOfMs: ASOF, windowDays: 30 })).toHaveLength(0);
  });

  it("nettiert Käufe gegen Verkäufe zu 'sell', wenn Verkäufe dominieren", () => {
    const trades: ConsensusTradeInput[] = [
      { wikifolioId: 1, resolvedTicker: "CSGN.SW", side: "sell", executedAt: daysAgo(3), sharpe: 2 },
      { wikifolioId: 2, resolvedTicker: "CSGN.SW", side: "sell", executedAt: daysAgo(4), sharpe: 2 },
      { wikifolioId: 3, resolvedTicker: "CSGN.SW", side: "buy", executedAt: daysAgo(5), sharpe: 1 },
    ];
    const [r] = computeWikifolioConsensus(trades, { asOfMs: ASOF });
    expect(r.sellWikifolios).toBe(2);
    expect(r.buyWikifolios).toBe(1);
    expect(r.netDirection).toBe("sell");
    expect(r.score).toBeLessThan(0);
  });

  it("überspringt Trades ohne aufgelösten Ticker", () => {
    const trades: ConsensusTradeInput[] = [
      { wikifolioId: 1, resolvedTicker: null, side: "buy", executedAt: daysAgo(2), sharpe: 1 },
      { wikifolioId: 2, resolvedTicker: null, side: "buy", executedAt: daysAgo(2), sharpe: 1 },
    ];
    expect(computeWikifolioConsensus(trades, { asOfMs: ASOF })).toHaveLength(0);
  });
});

describe("mapWikifolioSearchResults", () => {
  it("reicht Kennzahlen durch, wenn sie flach am Objekt liegen", () => {
    const [r] = mapWikifolioSearchResults([
      { symbol: "wftest", shortDescription: "Test", trader: { fullName: "Max" }, sharpeRatio: 1.8, maxDrawdown: -12.5, isin: "DE000LS9ABC1" },
    ]);
    expect(r.symbol).toBe("wftest");
    expect(r.rankValue).toBe(1.8);
    expect(r.maxDrawdown).toBe(-12.5);
    expect(r.isin).toBe("DE000LS9ABC1");
  });

  it("findet Kennzahlen auch unter stats/keyFigures", () => {
    const [r] = mapWikifolioSearchResults([
      { symbol: "wf2", stats: { sharpeRatio: 2.1, totalInvestments: 500000 } },
    ]);
    expect(r.rankValue).toBe(2.1);
    expect(r.capital).toBe(500000);
  });

  it("liefert null statt zu werfen, wenn keine Kennzahlen vorhanden sind", () => {
    const [r] = mapWikifolioSearchResults([{ symbol: "wf3" }]);
    expect(r.rankValue).toBeNull();
    expect(r.maxDrawdown).toBeNull();
  });
});
