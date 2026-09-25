import { describe, expect, it } from "vitest";
import { buildOptimizationUndoSummary } from "./optimizationUndo";

describe("buildOptimizationUndoSummary", () => {
  it("ermittelt den Cash-Gegeneffekt einer reinen Optimierungsbuchungsgruppe", () => {
    expect(buildOptimizationUndoSummary([
      { id: 11, source: "optimization", transactionType: "sell", totalAmountCHF: "13680.37", ticker: "SREN.SW" },
      { id: 12, source: "optimization", transactionType: "buy", totalAmountCHF: "19720.41", ticker: "SRG.MI" },
      { id: 13, source: "optimization", transactionType: "buy", totalAmountCHF: "13680.37", ticker: "GPW.WA" },
    ])).toEqual({
      transactionIds: [11, 12, 13],
      transactionCount: 3,
      reverseCashChangeChf: 19720.41,
      tickers: ["SREN.SW", "SRG.MI", "GPW.WA"],
    });
  });

  it("weist manuelle oder unvollständige Buchungsgruppen strikt ab", () => {
    expect(() => buildOptimizationUndoSummary([
      { id: 11, source: "optimization", transactionType: "sell", totalAmountCHF: "100", ticker: "SREN.SW" },
      { id: 12, source: "manual", transactionType: "buy", totalAmountCHF: "100", ticker: "SRG.MI" },
    ])).toThrow("ausschliesslich automatisch gebuchte Optimierungs-Transaktionen");
  });

  it("weist unbekannte Buchungstypen ab, statt den Cashbestand zu raten", () => {
    expect(() => buildOptimizationUndoSummary([
      { id: 11, source: "optimization", transactionType: "dividend", totalAmountCHF: "100", ticker: "SREN.SW" },
    ])).toThrow("Kauf- und Verkaufsbuchungen");
  });
});
