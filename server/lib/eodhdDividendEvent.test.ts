import { describe, expect, it } from "vitest";
import { selectSplitAdjustedEodhdDividendAmount } from "./eodhdDividendEvent";

describe("EODHD-Dividendenbetrag auf heutiger Aktienbasis", () => {
  it("nimmt nach einem 1:10-Split value statt unadjustedValue", () => {
    expect(selectSplitAdjustedEodhdDividendAmount({ value: 0.74, unadjustedValue: 7.4 })).toBe(0.74);
  });

  it("fällt nur bei fehlendem adjusted field auf den historischen Cashbetrag zurück", () => {
    expect(selectSplitAdjustedEodhdDividendAmount({ value: null, unadjustedValue: 2.5 })).toBe(2.5);
  });
});
