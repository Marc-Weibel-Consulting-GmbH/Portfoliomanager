export type VerifiedDividendYield = {
  dividendYield: number | null;
  dividendYieldBasis: "ttm_gross" | "forward_indicated" | "provider_highlights" | null;
  dividendAnnualAmount: number | null;
  dividendCurrency: string | null;
  dividendEventCount: number | null;
  dividendAsOfDate: string;
  dividendYieldSource: "EODHD /api/div" | "EODHD fundamentals" | null;
};

/**
 * Converts the result of the canonical dividend resolver into fields that may be
 * persisted in `stocks`.
 *
 * A generic multi-provider dividend field is intentionally not an input here.
 * It lacks the dated cash-event/currency evidence required for the headline
 * yield and must therefore never overwrite a verified TTM or clearly labelled
 * EODHD forward basis. `stocks.dividendYield` uses percentage units.
 */
export function toVerifiedDividendYieldUpdate(
  dividend: VerifiedDividendYield,
): Partial<{
  dividendYield: string;
  dividendYieldBasis: NonNullable<VerifiedDividendYield["dividendYieldBasis"]>;
  dividendAnnualAmount: string | null;
  dividendCurrency: string | null;
  dividendEventCount: number | null;
  dividendAsOfDate: string;
  dividendYieldSource: NonNullable<VerifiedDividendYield["dividendYieldSource"]>;
}> {
  if (
    dividend.dividendYield === null
    || !Number.isFinite(dividend.dividendYield)
    || dividend.dividendYield < 0
    || dividend.dividendYieldBasis === null
    || dividend.dividendYieldSource === null
  ) {
    return {};
  }

  return {
    dividendYield: dividend.dividendYield.toFixed(4),
    dividendYieldBasis: dividend.dividendYieldBasis,
    dividendAnnualAmount: dividend.dividendAnnualAmount === null
      ? null
      : dividend.dividendAnnualAmount.toFixed(6),
    dividendCurrency: dividend.dividendCurrency,
    dividendEventCount: dividend.dividendEventCount,
    dividendAsOfDate: dividend.dividendAsOfDate,
    dividendYieldSource: dividend.dividendYieldSource,
  };
}
