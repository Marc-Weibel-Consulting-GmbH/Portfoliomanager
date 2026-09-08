import { describe, expect, it } from "vitest";
import { buildWatchlistPdfRows } from "./watchlistPdfExportModel";

describe("buildWatchlistPdfRows", () => {
  it("übernimmt vorhandene Watchlist-Kennzahlen und weist Datenlücken aus", () => {
    expect(buildWatchlistPdfRows([
      { ticker: "NOVN.SW", companyName: "Novartis", sector: "Healthcare", currency: "CHF", currentPrice: "104.20", dividendYield: "3.1", peRatio: "15.8", ytdPerformance: "8.2", signalType: "buy", signalScore: 72 },
      { ticker: "LUECKE", companyName: "Ohne Kurs", priceMissing: true },
    ])).toEqual([
      { ticker: "NOVN.SW", name: "Novartis", sector: "Healthcare", currency: "CHF", price: 104.2, dividendYieldPct: 3.1, peRatio: 15.8, ytdReturnPct: 8.2, signal: "buy", score: 72, dataStatus: "OK" },
      { ticker: "LUECKE", name: "Ohne Kurs", sector: "—", currency: "—", price: null, dividendYieldPct: null, peRatio: null, ytdReturnPct: null, signal: "—", score: null, dataStatus: "Kursdaten fehlen" },
    ]);
  });
});
