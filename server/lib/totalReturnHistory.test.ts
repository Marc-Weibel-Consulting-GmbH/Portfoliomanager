import { describe, expect, it } from "vitest";
import { selectTotalReturnHistorySeries } from "./totalReturnHistory";

describe("selectTotalReturnHistorySeries", () => {
  it("uses only the EODHD adjusted-close snapshot for an EODHD risk series", () => {
    const selection = selectTotalReturnHistorySeries({
      priceSource: "eodhd_primary",
      nativeCurrency: "CHF",
      eodhdRows: [
        { date: "2021-09-27", adjustedClose: 90 },
        { date: "2026-09-25", adjustedClose: 120 },
      ],
      nativeRows: [
        { date: "2021-09-27", adjustedClose: 99 },
      ],
    });

    expect(selection).toEqual({
      source: "eodhd_adjusted",
      currency: "CHF",
      rows: [
        { date: "2021-09-27", adjustedClose: 90 },
        { date: "2026-09-25", adjustedClose: 120 },
      ],
    });
  });

  it("uses a complete native adjusted series without mixing it with EODHD", () => {
    const selection = selectTotalReturnHistorySeries({
      priceSource: "yahoo_native",
      nativeCurrency: "SGD",
      eodhdRows: [
        { date: "2021-09-27", adjustedClose: 90 },
      ],
      nativeRows: [
        { date: "2021-09-27", adjustedClose: 70 },
        { date: "2026-09-25", adjustedClose: 120 },
      ],
    });

    expect(selection).toEqual({
      source: "yahoo_adjusted",
      currency: "SGD",
      rows: [
        { date: "2021-09-27", adjustedClose: 70 },
        { date: "2026-09-25", adjustedClose: 120 },
      ],
    });
  });

  it("reports a data gap instead of using a secondary series for an EODHD instrument", () => {
    const selection = selectTotalReturnHistorySeries({
      priceSource: "eodhd_primary",
      nativeCurrency: "USD",
      eodhdRows: [],
      nativeRows: [{ date: "2021-09-27", adjustedClose: 100 }],
    });

    expect(selection).toEqual({
      source: "unavailable",
      currency: null,
      rows: [],
      reason: "missing_adjusted_history",
    });
  });

  it("deduplicates invalid snapshot rows and keeps a chronological homogeneous series", () => {
    const selection = selectTotalReturnHistorySeries({
      priceSource: "yahoo_primary_equivalent",
      nativeCurrency: "SEK",
      eodhdRows: [],
      nativeRows: [
        { date: "2026-09-25", adjustedClose: 120 },
        { date: "2021-09-27", adjustedClose: 70 },
        { date: "2021-09-27", adjustedClose: 71 },
        { date: "invalid", adjustedClose: 100 },
        { date: "2024-01-01", adjustedClose: 0 },
      ],
    });

    expect(selection.rows).toEqual([
      { date: "2021-09-27", adjustedClose: 71 },
      { date: "2026-09-25", adjustedClose: 120 },
    ]);
  });
});
