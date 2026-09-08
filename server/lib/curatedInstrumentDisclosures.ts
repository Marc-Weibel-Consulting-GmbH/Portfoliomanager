/**
 * Curated, source-bound instrument disclosures for exceptional portfolio
 * instruments. This deliberately supplements (and never overwrites) the
 * incomplete vendor master data. Detailed ETF constituent weights are not
 * represented here: they require a licensed, refreshable redistribution path.
 */
export type FundTransparency = {
  kind: "limited_fund_disclosure";
  holdingsCount: number;
  asOf: string;
  directWeightOnly: true;
  marketFocus: string;
  methodology: string;
  constituents?: never;
};

export type CuratedInstrumentDisclosure = {
  identityStatus: "verified" | "incomplete";
  isin: string | null;
  exchange: string | null;
  mic: string | null;
  tradingCurrency: string;
  sourceLabel: string | null;
  sourceUrl: string | null;
  asOf: string | null;
  fundTransparency: FundTransparency | null;
};

type IdentityInput = {
  currency?: string | null;
};

const DISCLOSURES: Record<string, CuratedInstrumentDisclosure> = {
  "CHDVD.SW": {
    identityStatus: "verified",
    isin: "CH0237935637",
    exchange: "SIX Swiss Exchange",
    mic: "XSWX",
    tradingCurrency: "CHF",
    sourceLabel: "iShares Swiss Dividend ETF (CH) — offizielle Fondsseite",
    sourceUrl: "https://www.ishares.com/ch/individual/en/products/264108/ishares-swiss-dividend-ch-fund",
    asOf: "2026-09-07",
    fundTransparency: {
      kind: "limited_fund_disclosure",
      holdingsCount: 20,
      asOf: "2026-09-07",
      directWeightOnly: true,
      marketFocus: "Schweiz · dividendenorientierte Aktien",
      methodology: "Repliziert den SPI Select Dividend 20 Total Return Index.",
    },
  },
  "ZGLD.SW": {
    identityStatus: "verified",
    isin: "CH0139101593",
    exchange: "SIX Swiss Exchange",
    mic: "XSWX",
    tradingCurrency: "CHF",
    sourceLabel: "SIX Structured Products / BX Swiss — ZGLD",
    sourceUrl: "https://www.six-structured-products.com/en/underlying/zkb-gold-etf-chf-CH0139101593",
    asOf: "2026-09-08",
    fundTransparency: null,
  },
  "ABTC.SW": {
    identityStatus: "verified",
    isin: "CH0454664001",
    exchange: "SIX Swiss Exchange",
    mic: "XSWX",
    tradingCurrency: "CHF",
    sourceLabel: "21Shares Bitcoin ETP — offizielle Produktseite",
    sourceUrl: "https://www.21shares.com/en-eu/product/abtc",
    asOf: "2026-09-08",
    fundTransparency: null,
  },
};

/**
 * Return only verified, dated disclosures. Unknown symbols retain their actual
 * market-data currency but never receive guessed ISIN, exchange, or MIC data.
 */
export function getCuratedInstrumentDisclosure(
  ticker: string,
  input: IdentityInput = {},
): CuratedInstrumentDisclosure {
  const disclosure = DISCLOSURES[ticker];
  if (disclosure) return disclosure;

  return {
    identityStatus: "incomplete",
    isin: null,
    exchange: null,
    mic: null,
    tradingCurrency: input.currency || "CHF",
    sourceLabel: null,
    sourceUrl: null,
    asOf: null,
    fundTransparency: null,
  };
}
