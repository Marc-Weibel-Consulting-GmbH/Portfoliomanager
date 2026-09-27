import { getHistoricalPriceCurrency, isHistoricalPriceSeriesCompatible } from "./eodhdSymbol";

/**
 * A single native daily close. These rows are intentionally separate from the
 * database shape: a risk series must be selected as one homogeneous source
 * before it is persisted and must never be stitched day-by-day with another
 * provider.
 */
export type NativeRiskPriceRow = {
  date: string;
  close: number;
};

export type VerifiedNativeRiskSource = {
  source: "yahoo_native" | "yahoo_primary_equivalent";
  sourceSymbol: string;
  sourceCurrency: string;
  /** Exact same listing, or same ISIN with a documented 1:1 ordinary-share basis. */
  identity: "same_listing" | "same_isin_primary_listing";
  expectedIsin?: string;
  conversionRatio?: number;
  sourceLabel: string;
};

/**
 * A deliberately small allow-list for EODHD gaps.
 *
 * EODHD remains the primary source. A secondary source is considered only for
 * exact, native exchange symbols. ADRs and foreign-currency proxy symbols are
 * never listed here. Bravida is exceptional because both the stored Stuttgart
 * listing (`SE0007491303.SG`) and the Nasdaq Stockholm primary line (`BRAV.ST`)
 * carry the exact same ISIN; ordinary shares are therefore 1:1, while their
 * market currencies differ. The mapping is used only for historical risk
 * series and never changes the held ticker, current valuation, cash, or ledger.
 */
const VERIFIED_NATIVE_RISK_SOURCES: Record<string, VerifiedNativeRiskSource> = {
  "6856.T": {
    source: "yahoo_native",
    sourceSymbol: "6856.T",
    sourceCurrency: "JPY",
    identity: "same_listing",
    sourceLabel: "Yahoo Finance native TSE line",
  },
  "D05.SI": {
    source: "yahoo_native",
    sourceSymbol: "D05.SI",
    sourceCurrency: "SGD",
    identity: "same_listing",
    sourceLabel: "Yahoo Finance native SGX line",
  },
  "SRG.MI": {
    source: "yahoo_native",
    sourceSymbol: "SRG.MI",
    sourceCurrency: "EUR",
    identity: "same_listing",
    sourceLabel: "Yahoo Finance native Borsa Italiana line",
  },
  "SE0007491303.SG": {
    source: "yahoo_primary_equivalent",
    sourceSymbol: "BRAV.ST",
    sourceCurrency: "SEK",
    identity: "same_isin_primary_listing",
    expectedIsin: "SE0007491303",
    conversionRatio: 1,
    sourceLabel: "Yahoo Finance Nasdaq Stockholm primary line; exact ISIN, 1:1 ordinary share",
  },
};

function normalise(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase();
}

/** A legacy portfolio can carry an ISIN as its ticker without duplicating it in stocks.isin. */
function extractIsinFromTicker(ticker: string): string | null {
  const match = normalise(ticker).match(/^([A-Z]{2}[A-Z0-9]{9}\d)(?:\.[A-Z0-9]+)?$/);
  return match?.[1] ?? null;
}

/**
 * Returns a secondary source only after its identity and currency contract has
 * been checked. This protects the risk engine against inadvertently treating a
 * USD ADR or EUR proxy as the native asset.
 */
export function resolveVerifiedNativeRiskSource(input: {
  ticker: string;
  nativeCurrency: string;
  isin: string | null | undefined;
}): VerifiedNativeRiskSource | null {
  const ticker = normalise(input.ticker);
  const nativeCurrency = normalise(input.nativeCurrency);
  const source = VERIFIED_NATIVE_RISK_SOURCES[ticker];
  if (!source) return null;

  if (source.identity === "same_listing") {
    return source.sourceCurrency === nativeCurrency ? source : null;
  }

  const isin = normalise(input.isin) || extractIsinFromTicker(ticker) || "";
  return source.expectedIsin === isin && source.conversionRatio === 1
    ? source
    : null;
}

export type RiskHistorySelection = {
  source: "eodhd_primary" | "yahoo_native" | "yahoo_primary_equivalent" | "unavailable";
  currency: string | null;
  sourceSymbol: string | null;
  sourceLabel: string | null;
  identity: "same_listing" | "same_isin_primary_listing" | null;
  conversionRatio: number | null;
  rows: NativeRiskPriceRow[];
  reason?: "no_qualified_history" | "unverified_instrument_identity";
};

function normaliseRows(rows: NativeRiskPriceRow[]): NativeRiskPriceRow[] {
  const byDate = new Map<string, NativeRiskPriceRow>();
  for (const row of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !Number.isFinite(row.close) || row.close <= 0) continue;
    byDate.set(row.date, { date: row.date, close: row.close });
  }
  return Array.from(byDate.values()).sort((left, right) => left.date.localeCompare(right.date));
}

/**
 * Selects exactly one homogeneous risk series. EODHD remains preferred when it
 * represents the native currency. For known EODHD coverage gaps, a validated
 * native secondary series replaces the entire provider series, not individual
 * missing days. It does not use a secondary source without a verified identity.
 */
export function selectRiskHistorySeries(input: {
  ticker: string;
  nativeCurrency: string;
  isin: string | null | undefined;
  eodhdRows: NativeRiskPriceRow[];
  secondaryRows: NativeRiskPriceRow[];
}): RiskHistorySelection {
  const ticker = normalise(input.ticker);
  const nativeCurrency = normalise(input.nativeCurrency);
  const eodhdRows = normaliseRows(input.eodhdRows);

  if (isHistoricalPriceSeriesCompatible(ticker, nativeCurrency) && eodhdRows.length > 0) {
    return {
      source: "eodhd_primary",
      // The economic currency of a London line is GBP, but its EOD price is
      // quoted in GBp.  Preserve the quote unit so downstream CHF conversion
      // applies GBPCHF / 100 rather than treating a pence price as a pound.
      currency: getHistoricalPriceCurrency(ticker, nativeCurrency),
      sourceSymbol: ticker,
      sourceLabel: "EODHD native listing",
      identity: "same_listing",
      conversionRatio: 1,
      rows: eodhdRows,
    };
  }

  const secondary = resolveVerifiedNativeRiskSource({ ticker, nativeCurrency, isin: input.isin });
  const secondaryRows = normaliseRows(input.secondaryRows);
  if (secondary && secondaryRows.length > 0) {
    return {
      source: secondary.source,
      currency: secondary.sourceCurrency,
      sourceSymbol: secondary.sourceSymbol,
      sourceLabel: secondary.sourceLabel,
      identity: secondary.identity,
      conversionRatio: secondary.conversionRatio ?? 1,
      rows: secondaryRows,
    };
  }

  return {
    source: "unavailable",
    currency: null,
    sourceSymbol: null,
    sourceLabel: null,
    identity: null,
    conversionRatio: null,
    rows: [],
    reason: !isHistoricalPriceSeriesCompatible(ticker, nativeCurrency) && !secondary
      ? "unverified_instrument_identity"
      : "no_qualified_history",
  };
}
