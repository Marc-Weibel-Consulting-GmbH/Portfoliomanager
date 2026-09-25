import { describe, expect, it } from "vitest";
import { calculateChfHoldingWeights } from "./copilotHoldings";

describe("calculateChfHoldingWeights", () => {
  it("uses CHF market values and includes the cash reserve in each displayed weight", () => {
    // The NOK face value is intentionally much larger than its CHF value.
    // Passing a converted CHF value must prevent it from dominating the portfolio.
    const result = calculateChfHoldingWeights(
      [
        { ticker: "AKRBP.OL", marketValueCHF: 13_200 },
        { ticker: "CHDVD.SW", marketValueCHF: 93_900 },
      ],
      129_825,
    );

    expect(result.totalValueCHF).toBe(236_925);
    expect(result.weightsByTicker["AKRBP.OL"]).toBeCloseTo(13_200 / 236_925, 10);
    expect(result.weightsByTicker["CHDVD.SW"]).toBeCloseTo(93_900 / 236_925, 10);
    expect(result.investedWeight).toBeCloseTo((13_200 + 93_900) / 236_925, 10);
  });

  it("keeps an unvalued position at zero instead of inventing a local-currency weight", () => {
    const result = calculateChfHoldingWeights(
      [
        { ticker: "MISSING.FX", marketValueCHF: null },
        { ticker: "CHF.SW", marketValueCHF: 10_000 },
      ],
      5_000,
    );

    expect(result.weightsByTicker["MISSING.FX"]).toBe(0);
    expect(result.weightsByTicker["CHF.SW"]).toBeCloseTo(10_000 / 15_000, 10);
  });
});
