import { normalizeTickerForDb, resolveCanonicalTicker } from "../tickerNormalization";

export type AlternativeStock = {
  ticker: string;
  companyName: string;
  sector: string | null;
  industry: string | null;
  category: string | null;
  currency: string | null;
  currentPrice: number | null;
  /** Aktuelle, quellengebundene CHF-Rate für einen globalen Peer. */
  exchangeRateToChf?: number | null;
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
  /** Lokale Stammdaten oder schreibgeschützter globaler Screener-Treffer. */
  origin?: "local" | "global";
};

export type AlternativeSource = Pick<AlternativeStock,
  "ticker" | "sector" | "industry" | "category" | "currency" | "dividendYield" | "isCantonalBank"
> & {
  /** Offizieller Name der Ausgangsposition, wenn für den Emittentenausschluss verfügbar. */
  companyName?: string | null;
};

export type RankedAlternative = AlternativeStock & {
  similarity: "exact_industry";
  scoreCoverage: number;
};

export const ALTERNATIVE_DIVIDEND_YIELD_TOLERANCE_PCT = 1;

const normalized = (value: string | null | undefined) => String(value ?? "").trim().toLowerCase();
const finite = (value: number | null | undefined) => value !== null && value !== undefined && Number.isFinite(value);

/**
 * Normalizes issuer labels for a conservative cross-listing guard. It removes
 * legal forms and only a narrow set of well-known insurance-language variants;
 * symbols remain the primary tradeable identity. This prevents a local primary
 * listing and a global ADR/OTC listing of the same issuer appearing twice.
 */
export function canonicalIssuerIdentity(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[&+]/g, " ")
    .replace(/\bmuenchener\b/g, "munchener")
    .replace(/\b(rueck|ruck)(ver(?:sicherung|sicherungs)?|versicherung|versicherungs)?\b/g, "re")
    .replace(/\breinsurance\b/g, "re")
    // Roche's OTC participation line is sometimes supplied as “Roche Holding
    // AG Participation”. It belongs to the same Roche Holding issuer as the
    // SIX bearer share RO, so it cannot be an independent alternative.
    .replace(/\broche holdings? (?:ag )?participation(?: certificate)?s?\b/g, "roche holding")
    // EODHD lists the US preference/ADR line as “SCOR PK”; it is the same
    // economic issuer as the ordinary “SCOR SE” line and must not be offered
    // twice as independent alternatives.
    .replace(/\bscor pk\b/g, "scor")
    .replace(/\b(international|group|company|co|ges|ag|incorporated|inc|corp|corporation|plc|ltd|limited|sa|nv|se|spa|s\.a\.|a\/s|participation|certificate|certificates|adr)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Identifies the primary regional trading venue from the canonical ticker. */
export function marketRegionForTicker(ticker: string): string {
  const value = canonicalTickerIdentity(ticker);
  const suffix = value.includes(".") ? value.split(".").at(-1) : "US";
  const regions: Record<string, string> = {
    SW: "CH", DE: "DE", XETRA: "DE", F: "DE", US: "US", L: "GB", LSE: "GB",
    PA: "FR", AS: "NL", MI: "IT", TO: "CA", WA: "PL", WAR: "PL", AU: "AU",
  };
  return regions[suffix ?? ""] ?? suffix ?? "UNKNOWN";
}

/**
 * Converts format and known company aliases to one identity. A holding stored
 * as `ABB.SW`, for instance, must exclude the universe entry `ABBN.SW`; an
 * unsuffixed US holding must likewise exclude its `.US` universe entry.
 */
export function canonicalTickerIdentity(ticker: string): string {
  return resolveCanonicalTicker(normalizeTickerForDb(ticker)).trim().toUpperCase();
}

/**
 * Ranks only currently priced equity candidates from the exact same EODHD
 * industry. The selected portfolio's own holdings (including known aliases)
 * are always excluded. Sector matching is intentionally prohibited: it made
 * Kuehne + Nagel appear comparable to sanitaryware and industrial machinery.
 * Candidates must have a verified dividend yield within +/- one percentage
 * point of the source position. It is a comparison list, not a recommendation
 * or an instruction to trade.
 */
export function selectComparableAlternatives(input: {
  source: AlternativeSource;
  candidates: AlternativeStock[];
  heldTickers: Iterable<string>;
  heldCompanyNames?: Iterable<string>;
  limit?: number;
}): RankedAlternative[] {
  const sourceTicker = canonicalTickerIdentity(input.source.ticker);
  const sourceSector = normalized(input.source.sector);
  const sourceCurrency = normalized(input.source.currency);
  const sourceRegion = marketRegionForTicker(input.source.ticker);
  const sourceIndustry = normalized(input.source.industry);
  const sourceDividendYield = input.source.dividendYield;
  const held = new Set([...input.heldTickers].map(canonicalTickerIdentity));
  const heldIssuers = new Set([
    input.source.companyName,
    ...(input.heldCompanyNames ?? []),
  ].map(canonicalIssuerIdentity).filter(Boolean));
  const limit = Math.max(1, Math.min(input.limit ?? 5, 5));

  if (!sourceTicker || !sourceSector || !sourceIndustry || !sourceCurrency || !finite(sourceDividendYield)) return [];

  const ranked = input.candidates
    .filter((candidate) => {
      const ticker = canonicalTickerIdentity(candidate.ticker);
      if (!ticker || ticker === sourceTicker || held.has(ticker)) return false;
      if (!candidate.isActive) return false;
      if (normalized(candidate.sector) !== sourceSector) return false;
      if (normalized(candidate.industry) !== sourceIndustry) return false;
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
      const similarity: RankedAlternative["similarity"] = "exact_industry";
      return { ...candidate, similarity, scoreCoverage };
    })
    .sort((a, b) => {
      const localityRank = (candidate: RankedAlternative) => {
        const sameCurrency = normalized(candidate.currency) === sourceCurrency;
        const sameRegion = marketRegionForTicker(candidate.ticker) === sourceRegion;
        if (sameCurrency && sameRegion) return 0;
        if (sameCurrency) return 1;
        if (sameRegion) return 2;
        return 3;
      };
      const localityOrder = localityRank(a) - localityRank(b);
      if (localityOrder !== 0) return localityOrder;
      // For a Kantonalbank, first fill the list with genuine cantonal peers.
      // Other financial-services names remain valid backfills when fewer than
      // five data-complete cantonal peers meet the same dividend-yield band.
      if (input.source.isCantonalBank) {
        const cantonalBankOrder = Number(b.isCantonalBank) - Number(a.isCantonalBank);
        if (cantonalBankOrder !== 0) return cantonalBankOrder;
      }
      if (b.scoreCoverage !== a.scoreCoverage) return b.scoreCoverage - a.scoreCoverage;
      const originOrder = Number(a.origin === "global") - Number(b.origin === "global");
      if (originOrder !== 0) return originOrder;
      const signalOrder = (b.signalScore ?? -1) - (a.signalScore ?? -1);
      if (signalOrder !== 0) return signalOrder;
      const sharpeOrder = (b.sharpeRatio ?? Number.NEGATIVE_INFINITY) - (a.sharpeRatio ?? Number.NEGATIVE_INFINITY);
      if (sharpeOrder !== 0) return sharpeOrder;
      return a.ticker.localeCompare(b.ticker);
    });

  const selected: RankedAlternative[] = [];
  const seenTickers = new Set<string>();
  const seenIssuers = new Set<string>();
  for (const candidate of ranked) {
    const ticker = canonicalTickerIdentity(candidate.ticker);
    const issuer = canonicalIssuerIdentity(candidate.companyName);
    if (!ticker || seenTickers.has(ticker) || (issuer && (heldIssuers.has(issuer) || seenIssuers.has(issuer)))) continue;
    seenTickers.add(ticker);
    if (issuer) seenIssuers.add(issuer);
    selected.push(candidate);
    if (selected.length === limit) break;
  }
  return selected;
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
