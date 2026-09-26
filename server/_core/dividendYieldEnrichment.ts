import type { EODHDFundamentals } from "./eodhdApi";
import { fetchEodhdTrailingDividendYield } from "./eodhdDividendYield";

export type DividendYieldEnrichment = {
  dividendYield: number | null;
  dividendYieldBasis: "ttm_gross" | "forward_indicated" | "provider_highlights" | null;
  dividendAnnualAmount: number | null;
  dividendCurrency: string | null;
  dividendEventCount: number | null;
  dividendAsOfDate: string;
  dividendYieldSource: "EODHD /api/div" | "EODHD fundamentals" | null;
};

/**
 * Deterministic source order for an instrument's headline dividend yield:
 *
 * 1. TTM gross dividend yield from dated EODHD cash events in the listing
 *    currency (explicitly excludes special dividends).
 * 2. EODHD's annual indicated / forward field, labeled as forward.
 * 3. EODHD's generic Highlights field, labeled as provider data.
 *
 * This deliberately does not annualize a single payment or turn an USD dividend
 * into a NOK yield.  A data gap is preferable to a false precision.
 */
export async function resolveDividendYieldEnrichment(input: {
  ticker: string;
  currentPrice: number | string | null | undefined;
  currency: string | null | undefined;
  fundamentals: EODHDFundamentals;
  asOfDate?: string;
}): Promise<DividendYieldEnrichment> {
  const asOfDate = input.asOfDate ?? new Date().toISOString().slice(0, 10);
  const ttm = await fetchEodhdTrailingDividendYield({
    ticker: input.ticker,
    currentPrice: input.currentPrice,
    tradingCurrency: input.currency,
    asOfDate,
  });

  if (ttm.status === "available" && ttm.dividendYieldPct !== null) {
    return {
      dividendYield: ttm.dividendYieldPct,
      dividendYieldBasis: "ttm_gross",
      dividendAnnualAmount: ttm.annualDividendPerShare,
      dividendCurrency: ttm.currency,
      dividendEventCount: ttm.eventCount,
      dividendAsOfDate: ttm.asOfDate,
      dividendYieldSource: ttm.source,
    };
  }

  if (
    input.fundamentals.dividendYieldBasis === "forward_indicated"
    && input.fundamentals.dividendYield !== null
    && Number.isFinite(input.fundamentals.dividendYield)
  ) {
    return {
      dividendYield: input.fundamentals.dividendYield,
      dividendYieldBasis: "forward_indicated",
      dividendAnnualAmount: input.fundamentals.forwardAnnualDividendRate,
      dividendCurrency: input.currency?.toUpperCase() ?? null,
      dividendEventCount: null,
      dividendAsOfDate: asOfDate,
      dividendYieldSource: "EODHD fundamentals",
    };
  }

  if (input.fundamentals.dividendYield !== null && Number.isFinite(input.fundamentals.dividendYield)) {
    return {
      dividendYield: input.fundamentals.dividendYield,
      dividendYieldBasis: "provider_highlights",
      dividendAnnualAmount: null,
      dividendCurrency: input.currency?.toUpperCase() ?? null,
      dividendEventCount: null,
      dividendAsOfDate: asOfDate,
      dividendYieldSource: "EODHD fundamentals",
    };
  }

  return {
    dividendYield: null,
    dividendYieldBasis: null,
    dividendAnnualAmount: null,
    dividendCurrency: null,
    dividendEventCount: null,
    dividendAsOfDate: asOfDate,
    dividendYieldSource: null,
  };
}
