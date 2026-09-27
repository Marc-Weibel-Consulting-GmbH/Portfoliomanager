import { describe, expect, it } from "vitest";
import {
  buildSplitAdjustedPriceRows,
  buildEventReconstructedTotalReturnRows,
  hasMaterialTotalReturnMismatch,
} from "./totalReturnFromEvents";

describe("event-reconstructed total-return history", () => {
  it("removes a 20-for-1 split from the price-only series without adding a dividend", () => {
    const rows = buildSplitAdjustedPriceRows({
      rawRows: [
        { date: "2022-07-15", close: 2250 },
        { date: "2022-07-18", close: 112.5 },
        { date: "2022-07-19", close: 115 },
      ],
      splits: [{ date: "2022-07-18", split: "20.000000/1.000000" }],
    });

    expect(rows).toEqual([
      { date: "2022-07-15", adjustedClose: 112.5 },
      { date: "2022-07-18", adjustedClose: 112.5 },
      { date: "2022-07-19", adjustedClose: 115 },
    ]);
  });

  it("uses the split-adjusted price series as the dividend-reinvestment base", () => {
    const splitAdjusted = buildSplitAdjustedPriceRows({
      rawRows: [
        { date: "2022-07-15", close: 2250 },
        { date: "2022-07-18", close: 112.5 },
        { date: "2022-07-19", close: 110 },
      ],
      splits: [{ date: "2022-07-18", split: "20/1" }],
    });
    const totalReturn = buildEventReconstructedTotalReturnRows({
      quoteCurrency: "USD",
      rawRows: splitAdjusted.map((row) => ({ date: row.date, close: row.adjustedClose })),
      dividends: [{ date: "2022-07-19", amount: 2.5, currency: "USD" }],
    });

    expect(totalReturn.at(-1)?.adjustedClose).toBeCloseTo(112.5, 10);
  });

  it("reinvests a cash dividend on the ex-date into the raw price series", () => {
    const rows = buildEventReconstructedTotalReturnRows({
      quoteCurrency: "USD",
      rawRows: [
        { date: "2026-01-02", close: 100 },
        { date: "2026-01-03", close: 95 },
        { date: "2026-01-04", close: 96 },
      ],
      dividends: [{ date: "2026-01-03", amount: 5, currency: "USD" }],
    });

    expect(rows).toEqual([
      { date: "2026-01-02", adjustedClose: 100 },
      { date: "2026-01-03", adjustedClose: 100 },
      { date: "2026-01-04", adjustedClose: 101.05263157894737 },
    ]);
  });

  it("converts GBP cash dividends into GBp before combining them with LSE quotes", () => {
    const rows = buildEventReconstructedTotalReturnRows({
      quoteCurrency: "GBp",
      rawRows: [
        { date: "2026-09-09", close: 330 },
        { date: "2026-09-10", close: 323.2 },
      ],
      dividends: [{ date: "2026-09-10", amount: 0.068, currency: "GBP" }],
    });

    expect(rows.at(-1)?.adjustedClose).toBeCloseTo(330, 10);
  });

  it("moves an event falling on a non-trading date to the next available close", () => {
    const rows = buildEventReconstructedTotalReturnRows({
      quoteCurrency: "CHF",
      rawRows: [
        { date: "2026-01-02", close: 100 },
        { date: "2026-01-05", close: 98 },
      ],
      dividends: [{ date: "2026-01-03", amount: 2, currency: "CHF" }],
    });

    expect(rows.at(-1)?.adjustedClose).toBeCloseTo(100, 10);
  });

  it("flags a provider adjusted series that omits a material dividend adjustment", () => {
    expect(hasMaterialTotalReturnMismatch({
      providerRows: [
        { date: "2026-01-02", adjustedClose: 100 },
        { date: "2026-01-03", adjustedClose: 95 },
      ],
      reconstructedRows: [
        { date: "2026-01-02", adjustedClose: 100 },
        { date: "2026-01-03", adjustedClose: 100 },
      ],
    })).toBe(true);
  });

  it("does not replace an adjusted provider series that agrees with cash events", () => {
    expect(hasMaterialTotalReturnMismatch({
      providerRows: [
        { date: "2026-01-02", adjustedClose: 100 },
        { date: "2026-01-03", adjustedClose: 100.1 },
      ],
      reconstructedRows: [
        { date: "2026-01-02", adjustedClose: 100 },
        { date: "2026-01-03", adjustedClose: 100 },
      ],
    })).toBe(false);
  });
});
