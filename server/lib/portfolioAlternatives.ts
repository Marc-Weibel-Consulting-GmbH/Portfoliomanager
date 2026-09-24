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
};

export type AlternativeSource = Pick<AlternativeStock, "ticker" | "sector" | "industry" | "category" | "currency">;

export type RankedAlternative = AlternativeStock & {
  similarity: "same_industry" | "same_sector";
  scoreCoverage: number;
};

const normalized = (value: string | null | undefined) => String(value ?? "").trim().toLowerCase();
const finite = (value: number | null | undefined) => value !== null && value !== undefined && Number.isFinite(value);

/**
 * Ranks only currently priced, same-currency equity candidates from the same
 * sector. The selected portfolio's own holdings are always excluded. It is a
 * research list, not a recommendation or an instruction to trade.
 */
export function selectComparableAlternatives(input: {
  source: AlternativeSource;
  candidates: AlternativeStock[];
  heldTickers: Iterable<string>;
  limit?: number;
}): RankedAlternative[] {
  const sourceTicker = input.source.ticker.trim().toUpperCase();
  const sourceSector = normalized(input.source.sector);
  const sourceCurrency = normalized(input.source.currency);
  const sourceIndustry = normalized(input.source.industry);
  const sourceCategory = normalized(input.source.category);
  const held = new Set([...input.heldTickers].map((ticker) => ticker.trim().toUpperCase()));
  const limit = Math.max(1, Math.min(input.limit ?? 5, 5));

  if (!sourceTicker || !sourceSector || !sourceCurrency) return [];

  return input.candidates
    .filter((candidate) => {
      const ticker = candidate.ticker.trim().toUpperCase();
      if (!ticker || ticker === sourceTicker || held.has(ticker)) return false;
      if (!candidate.isActive) return false;
      if (normalized(candidate.sector) !== sourceSector) return false;
      if (normalized(candidate.currency) !== sourceCurrency) return false;
      if (!finite(candidate.currentPrice) || candidate.currentPrice! <= 0) return false;
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
      // Stricter peer match before model metrics, then data completeness. This
      // prevents a partial score record from looking better merely by omission.
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
