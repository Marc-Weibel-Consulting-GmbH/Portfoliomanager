import { describe, expect, it } from "vitest";
import {
  buildEodhdSearchQueries,
  normalizeEodhdSearchInstrument,
  selectEodhdHistoricalChartSeries,
  type EodhdSearchRawInstrument,
} from "./eodhdInstrumentSearch";

describe("normalizeEodhdSearchInstrument", () => {
  it("normalisiert eine LSE-ETF-Antwort in einen für Detail- und EODHD-Pfade nutzbaren Ticker", () => {
    const raw: EodhdSearchRawInstrument = {
      Code: "WQDS",
      Exchange: "LSE",
      Name: "iShares MSCI World Quality Dividend ESG UCITS ETF",
      Type: "ETF",
      Country: "UK",
    };

    expect(normalizeEodhdSearchInstrument(raw)).toEqual({
      ticker: "WQDS.LSE",
      companyName: "iShares MSCI World Quality Dividend ESG UCITS ETF",
      exchange: "LSE",
      quoteType: "ETF",
      country: "UK",
      source: "EODHD",
    });
  });

  it("ordnet NASDAQ- und NYSE-Ergebnisse dem EODHD-US-Markt zu", () => {
    const raw: EodhdSearchRawInstrument = {
      Code: "HDV",
      Exchange: "NASDAQ",
      Name: "iShares Core High Dividend ETF",
      Type: "ETF",
    };

    expect(normalizeEodhdSearchInstrument(raw)?.ticker).toBe("HDV.US");
  });

  it("weist unvollständige oder nicht unterstützte Antwortformen zurück", () => {
    expect(normalizeEodhdSearchInstrument({ Code: "", Exchange: "LSE", Name: "ETF" })).toBeNull();
    expect(normalizeEodhdSearchInstrument({ Code: "WQDS", Exchange: "", Name: "ETF" })).toBeNull();
    expect(normalizeEodhdSearchInstrument({ Code: "WQDS", Exchange: "LSE", Name: "", Type: "ETF" })).toBeNull();
  });
});

describe("buildEodhdSearchQueries", () => {
  it("tries a concise ETF-description if the provider does not index the verbose product name", () => {
    expect(buildEodhdSearchQueries("iShares MSCI High Dividend Yield")).toEqual([
      "iShares MSCI High Dividend Yield",
      "iShares High Dividend",
      "High Dividend",
    ]);
  });
});

describe("selectEodhdHistoricalChartSeries", () => {
  it("uses the complete adjusted EODHD basis for a split-adjusted external chart", () => {
    expect(selectEodhdHistoricalChartSeries([
      { date: "2026-04-30", close: 140, adjustedClose: 27 },
      { date: "2026-05-01", close: 27.34, adjustedClose: 26.9253 },
    ])).toEqual({
      status: "adjusted_close",
      points: [
        { date: "2026-04-30", close: 27 },
        { date: "2026-05-01", close: 26.9253 },
      ],
    });
  });

  it("suppresses a raw series with a split-like jump when no homogeneous adjusted basis exists", () => {
    expect(selectEodhdHistoricalChartSeries([
      { date: "2026-04-30", close: 140, adjustedClose: null },
      { date: "2026-05-01", close: 27.34, adjustedClose: null },
    ])).toEqual({ status: "incompatible", points: [] });
  });
});
