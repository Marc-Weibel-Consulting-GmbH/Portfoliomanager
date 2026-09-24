import { normalizeTickerForDb, resolveCanonicalTicker } from "../tickerNormalization";

export type AlternativeStock = {
  ticker: string;
  companyName: string;
  sector: string | null;
  industry: string | null;
  category: string | null;
  currency: string | null;
  currentPrice: number | null;
  dividendYield: number | null;
  sharpeRatio: number | null;
  beta: number | null;
  quality: number | null;
  valuation: number | null;
  timing: number | null;
  signalScore: number | null;
  signalLabel: string | null;
  dataQualityStatus: string | null;
  isActive: boolean;
  isCantonalBank: boolean;
};

export type AlternativeSource = Pick<AlternativeStock,
  "ticker" | "sector" | "industry" | "category" | "currency" | "dividendYield" | "isCantonalBank"
>;

export type RankedAlternative = AlternativeStock & {
  similarity: "same_industry" | "same_sector";
  scoreCoverage: number;
};

export const ALTERNATIVE_DIVIDEND_YIELD_TOLERANCE_PCT = 1;

const normalized = (value: string | null | undefined) => String(value ?? "").trim().toLowerCase();
const finite = (value: number | null | undefined) => value !== null && value !== undefined && Number.isFinite(value);

/**
 * Converts format and known company aliases to one identity. A holding stored
 * as `ABB.SW`, for instance, must exclude the universe entry `ABBN.SW`; an
 * unsuffixed US holding must likewise exclude its `.US` universe entry.
 */
export function canonicalTickerIdentity(ticker: string): string {
  return resolveCanonicalTicker(normalizeTickerForDb(ticker)).trim().toUpperCase();
}

/**
 * Ranks only currently priced, same-currency equity candidates from the same
 * sector. The selected portfolio's own holdings (including known aliases) are
 * always excluded. Candidates must also have a verified dividend yield within
 * +/- one percentage point of the source position. It is a comparison list,
 * not a recommendation or an instruction to trade.
 */
export function selectComparableAlternatives(input: {
  source: AlternativeSource;
  candidates: AlternativeStock[];
  heldTickers: Iterable<string>;
  limit?: number;
}): RankedAlternative[] {
  const sourceTicker = canonicalTickerIdentity(input.source.ticker);
  const sourceSector = normalized(input.source.sector);
  const sourceCurrency = normalized(input.source.currency);
  const sourceIndustry = normalized(input.source.industry);
  const sourceDividendYield = input.source.dividendYield;
  const held = new Set([...input.heldTickers].map(canonicalTickerIdentity));
  const limit = Math.max(1, Math.min(input.limit ?? 5, 5));

  if (!sourceTicker || !sourceSector || !sourceCurrency || !finite(sourceDividendYield)) return [];

  return input.candidates
    .filter((candidate) => {
      const ticker = canonicalTickerIdentity(candidate.ticker);
      if (!ticker || ticker === sourceTicker || held.has(ticker)) return false;
      if (!candidate.isActive) return false;
      if (normalized(candidate.sector) !== sourceSector) return false;
      if (normalized(candidate.currency) !== sourceCurrency) return false;
      if (!finite(candidate.currentPrice) || candidate.currentPrice! <= 0) return false;
      if (!finite(candidate.dividendYield)) return false;
      if (Math.abs(candidate.dividendYield! - sourceDividendYield!) > ALTERNATIVE_DIVIDEND_YIELD_TOLERANCE_PCT) return false;
      if (normalized(candidate.category) === "etf") return false;
      if (normalized(candidate.dataQualityStatus) === "data_gap") return false;
      return true;
    })
    .map((candidate) => {
      const scoreCoverage = [candidate.quality, candidate.valuation, candidate.timing]
        .filter((score) => finite(score)).length;
      const similarity: RankedAlternative["similarity"] = sourceIndustry
        && normalized(candidate.industry) === sourceIndustry
        ? "same_industry"
        : "same_sector";
      return { ...candidate, similarity, scoreCoverage };
    })
    .sort((a, b) => {
      // For a Kantonalbank, first fill the list with genuine cantonal peers.
      // Other financial-services names remain valid backfills when fewer than
      // five data-complete cantonal peers meet the same dividend-yield band.
      if (input.source.isCantonalBank) {
        const cantonalBankOrder = Number(b.isCantonalBank) - Number(a.isCantonalBank);
        if (cantonalBankOrder !== 0) return cantonalBankOrder;
      }
      const industryOrder = Number(b.similarity === "same_industry") - Number(a.similarity === "same_industry");
      if (industryOrder !== 0) return industryOrder;
      if (b.scoreCoverage !== a.scoreCoverage) return b.scoreCoverage - a.scoreCoverage;
      const signalOrder = (b.signalScore ?? -1) - (a.signalScore ?? -1);
      if (signalOrder !== 0) return signalOrder;
      const sharpeOrder = (b.sharpeRatio ?? Number.NEGATIVE_INFINITY) - (a.sharpeRatio ?? Number.NEGATIVE_INFINITY);
      if (sharpeOrder !== 0) return sharpeOrder;
      return a.ticker.localeCompare(b.ticker);
    })
    .slice(0, limit);
}

/**
 * Determines the fractional quantity that preserves the source position's CHF
 * market value at the supplied target quote. Rounding is explicit so any small
 * CHF residual can be booked transparently to the demo cash reserve.
 */
export function calculateEquivalentValueSwap(input: {
  sourceShares: number;
  sourcePriceLocal: number;
  sourceExchangeRateToChf: number;
  targetPriceLocal: number;
  targetExchangeRateToChf: number;
  precision?: number;
}): {
  sourceValueChf: number;
  targetShares: number;
  targetValueChf: number;
  cashResidualChf: number;
} {
  const numbers = [
    input.sourceShares,
    input.sourcePriceLocal,
    input.sourceExchangeRateToChf,
    input.targetPriceLocal,
    input.targetExchangeRateToChf,
  ];
  if (numbers.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error("Für den Tausch sind gültige Stück-, Kurs- und CHF-Wechselkursdaten nötig.");
  }
  const precision = Math.max(0, Math.min(input.precision ?? 6, 8));
  const factor = 10 ** precision;
  const sourceValueChf = input.sourceShares * input.sourcePriceLocal * input.sourceExchangeRateToChf;
  const targetShares = Math.round((sourceValueChf / (input.targetPriceLocal * input.targetExchangeRateToChf)) * factor) / factor;
  const targetValueChf = targetShares * input.targetPriceLocal * input.targetExchangeRateToChf;
  return {
    sourceValueChf,
    targetShares,
    targetValueChf,
    cashResidualChf: sourceValueChf - targetValueChf,
  };
}
