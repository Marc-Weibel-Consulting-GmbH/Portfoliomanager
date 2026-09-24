import { ENV } from "../_core/env";
import { apiCache, CACHE_TTL } from "../_core/apiCache";
import { fetchEODHDFundamentals, fetchEODHDRealTime } from "../_core/eodhdApi";
import { retryFetch } from "../_core/retryUtil";
import { ERLAUBTE_EXCHANGE_CODES, SCREENER_BOERSEN } from "./screenerLauf";
import { canonicalTickerIdentity, type AlternativeStock } from "./portfolioAlternatives";
import { tickerAusScreenerCode } from "./universeExpansion";

const EODHD_BASE_URL = "https://eodhd.com/api";
const MIN_MARKET_CAP = 1_000_000_000;
const MAX_RAW_PER_EXCHANGE = 30;
const MAX_QUOTED_CANDIDATES = 8;
const ADR_OR_CERTIFICATE_PATTERN = /\b(adr|gdr|c?dr|cedear|depositary|sponsored)\b/i;

export type ScreenerIndustryPeer = {
  code: string;
  exchange: string;
  name: string;
  sector: string | null;
  industry: string | null;
  currency: string | null;
  dividendYield: number | null;
  marketCap: number | null;
};

const normalized = (value: unknown) => String(value ?? "").trim().toLowerCase();
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const fxCurrency = (currency: string) => currency.toUpperCase() === "GBP" ? "GBP" : currency.toUpperCase();

/**
 * Screener listings spell the same issuer differently (e.g. "Kuehne & Nagel"
 * vs. "Kuehne + Nagel International AG"). This identity is deliberately only
 * a conservative duplicate guard; ticker and exchange remain the tradeable
 * identifiers elsewhere.
 */
export function canonicalCompanyIdentity(value: unknown): string {
  return normalized(value)
    .replace(/[&+]/g, " ")
    .replace(/\b(international|ag|incorporated|inc|corp|corporation|plc|ltd|limited|sa|nv|se|spa|s\.a\.|a\/s)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Returns a current, source-backed CHF FX quote without using a stale DB fallback. */
async function currentFxToChf(currency: string): Promise<number | null> {
  const base = fxCurrency(currency);
  if (base === "CHF") return 1;
  const quote = await fetchEODHDRealTime(`${base}CHF.FOREX`);
  return finite(quote.close) && quote.close > 0 ? quote.close : null;
}

/**
 * Pure provider-boundary filter. EODHD's screener can include other listings
 * even when an exchange is supplied, so the response is defensively constrained
 * again before it ever reaches the portfolio comparison.
 */
export function filterExactIndustryScreenerPeers(input: {
  items: ScreenerIndustryPeer[];
  requestedExchange: string;
  industry: string;
  knownTickerIdentities: Iterable<string>;
  knownCompanyNames?: Iterable<string>;
}): ScreenerIndustryPeer[] {
  const allowedExchanges = ERLAUBTE_EXCHANGE_CODES[input.requestedExchange] ?? [input.requestedExchange.toUpperCase()];
  const seenIdentities = new Set([...input.knownTickerIdentities].map(canonicalTickerIdentity));
  const seenNames = new Set([...input.knownCompanyNames ?? []].map(canonicalCompanyIdentity));
  const expectedIndustry = normalized(input.industry);

  return input.items.filter((item) => {
    const exchange = String(item.exchange ?? "").toUpperCase();
    if (!allowedExchanges.includes(exchange)) return false;
    if (normalized(item.industry) !== expectedIndustry) return false;
    if (!item.code || !item.name || ADR_OR_CERTIFICATE_PATTERN.test(item.name)) return false;
    const code = String(item.code ?? "").trim().toUpperCase();
    if (input.requestedExchange === "lse" && code.startsWith("0")) return false;
    if (input.requestedExchange === "us" && /-P[A-Z]?$/.test(code)) return false;
    if (!finite(item.marketCap) || item.marketCap < MIN_MARKET_CAP) return false;
    if (!finite(item.dividendYield) || item.dividendYield <= 0) return false;
    const ticker = tickerAusScreenerCode(item.code, item.exchange);
    const identity = canonicalTickerIdentity(ticker);
    const companyName = canonicalCompanyIdentity(item.name);
    if (!identity || seenIdentities.has(identity) || seenNames.has(companyName)) return false;
    return true;
  });
}

async function fetchExactIndustryScreen(exchange: string, industry: string): Promise<ScreenerIndustryPeer[]> {
  const apiKey = ENV.eodhdApiKey;
  if (!apiKey) return [];
  const cacheKey = `position-alternatives:industry:${exchange}:${industry}`;
  const cached = apiCache.get<ScreenerIndustryPeer[]>(cacheKey);
  if (cached) return cached;

  // Match the proven Watchlist-Screener request shape: exchange belongs in the
  // `filters` triplets, never merely in an URL parameter.
  const filters = [
    ["market_capitalization", ">=", MIN_MARKET_CAP],
    ["exchange", "=", exchange],
    ["industry", "=", industry],
  ];
  const url = `${EODHD_BASE_URL}/screener?api_token=${encodeURIComponent(apiKey)}`
    + `&sort=market_capitalization.desc&limit=${MAX_RAW_PER_EXCHANGE}&offset=0`
    + `&filters=${encodeURIComponent(JSON.stringify(filters))}`;

  try {
    const response = await retryFetch(url, {}, { maxRetries: 2, baseDelay: 500 });
    if (!response.ok) return [];
    const data: unknown = await response.json();
    const rawItems = Array.isArray((data as { data?: unknown })?.data)
      ? (data as { data: unknown[] }).data
      : Array.isArray(data) ? data : [];
    const items: ScreenerIndustryPeer[] = rawItems.map((item: any) => ({
      code: String(item?.code ?? ""),
      exchange: String(item?.exchange ?? ""),
      name: String(item?.name ?? ""),
      sector: typeof item?.sector === "string" ? item.sector : null,
      industry: typeof item?.industry === "string" ? item.industry : null,
      currency: typeof item?.currency === "string" ? item.currency.toUpperCase() : null,
      // EODHD screener yields are decimal fractions. Convert precisely once at
      // this provider boundary; all internal alternatives use percentage units.
      dividendYield: finite(Number(item?.dividend_yield)) ? Number(item.dividend_yield) * 100 : null,
      marketCap: finite(Number(item?.market_capitalization)) ? Number(item.market_capitalization) : null,
    }));
    apiCache.set(cacheKey, items, CACHE_TTL.FUNDAMENTALS);
    return items;
  } catch (error) {
    console.warn(`[PositionAlternatives] EODHD industry screen failed for ${exchange}/${industry}:`, error);
    return [];
  }
}

/**
 * Uses the same global EODHD exchange universe as the Watchlist-Screener when
 * the local stocks table does not contain enough exact-industry peers. It is
 * read-only: no candidate is added to a watchlist or the portfolio during
 * preview. A candidate becomes a local stock record only after the existing
 * explicit Demo-Tausch confirmation succeeds.
 */
export async function findGlobalExactIndustryPeers(input: {
  industry: string;
  excludedTickers: Iterable<string>;
  knownCompanyNames: Iterable<string>;
  /** Source yield in percentage units; screens the provider pool before detail calls. */
  sourceDividendYieldPct?: number | null;
  maxCandidates?: number;
}): Promise<AlternativeStock[]> {
  const industry = String(input.industry ?? "").trim();
  if (!industry) return [];
  // Fetch a wider exact-industry pool first. The final selection applies the
  // source-specific dividend band, so fetching only five raw peers could leave
  // an avoidable gap after that honest filter is applied.
  const maxCandidates = Math.max(1, Math.min(input.maxCandidates ?? MAX_QUOTED_CANDIDATES, MAX_QUOTED_CANDIDATES));
  const rawByExchange = await Promise.all(
    SCREENER_BOERSEN.map(async (exchange) => ({ exchange, items: await fetchExactIndustryScreen(exchange, industry) })),
  );

  const knownTickerIdentities = new Set([...input.excludedTickers].map(canonicalTickerIdentity));
  const knownCompanyNames = new Set([...input.knownCompanyNames].map(canonicalCompanyIdentity));
  const minDividendYield = finite(input.sourceDividendYieldPct)
    ? Math.max(0, input.sourceDividendYieldPct - 1)
    : null;
  const maxDividendYield = finite(input.sourceDividendYieldPct)
    ? input.sourceDividendYieldPct + 1
    : null;
  const screened: ScreenerIndustryPeer[] = [];
  for (const { exchange, items } of rawByExchange) {
    const valid = filterExactIndustryScreenerPeers({
      items,
      requestedExchange: exchange,
      industry,
      knownTickerIdentities,
      knownCompanyNames,
    });
    screened.push(...valid);
  }

  const seenCompanies = new Set(knownCompanyNames);
  const seenTickerIdentities = new Set([...input.excludedTickers].map(canonicalTickerIdentity));
  const candidates = screened
    .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
    .filter((candidate) => {
      const companyIdentity = canonicalCompanyIdentity(candidate.name);
      const tickerIdentity = canonicalTickerIdentity(tickerAusScreenerCode(candidate.code, candidate.exchange));
      if (!companyIdentity || !tickerIdentity || seenCompanies.has(companyIdentity) || seenTickerIdentities.has(tickerIdentity)) {
        return false;
      }
      if (minDividendYield !== null && maxDividendYield !== null
        && (!finite(candidate.dividendYield) || candidate.dividendYield < minDividendYield || candidate.dividendYield > maxDividendYield)) {
        return false;
      }
      seenCompanies.add(companyIdentity);
      seenTickerIdentities.add(tickerIdentity);
      return true;
    })
    // Do not enrich more remote quotes than the caller needs. The shortlist is
    // rebuilt on every preview and must remain responsive; all unvalidated
    // screener rows are intentionally kept out of the result.
    .slice(0, maxCandidates);
  const fxQuoteByCurrency = new Map<string, Promise<number | null>>();
  const getCurrentFx = (currency: string) => {
    const key = fxCurrency(currency);
    let pending = fxQuoteByCurrency.get(key);
    if (!pending) {
      pending = currentFxToChf(key);
      fxQuoteByCurrency.set(key, pending);
    }
    return pending;
  };
  const verified = await Promise.all(candidates.map(async (candidate) => {
    const ticker = tickerAusScreenerCode(candidate.code, candidate.exchange);
    const [quote, fundamentals] = await Promise.all([
      fetchEODHDRealTime(ticker),
      fetchEODHDFundamentals(ticker),
    ]);
    const exchangeRateToChf = fundamentals.currency ? await getCurrentFx(fundamentals.currency) : null;
    return { candidate, ticker, quote, fundamentals, exchangeRateToChf };
  }));

  return verified
    // The screener response does not consistently contain currency. Confirm
    // industry, currency and dividend yield using its own validated per-ticker
    // fundamentals endpoint before a candidate can be displayed or swapped.
    .filter(({ quote, fundamentals, exchangeRateToChf }) => finite(quote.close) && quote.close > 0
      && normalized(fundamentals.industry) === normalized(industry)
      && Boolean(fundamentals.currency ?? false)
      && finite(exchangeRateToChf) && exchangeRateToChf > 0
      && finite(fundamentals.dividendYield) && fundamentals.dividendYield > 0)
    .map(({ candidate, ticker, quote, fundamentals, exchangeRateToChf }) => ({
      ticker,
      companyName: fundamentals.companyName ?? candidate.name,
      sector: fundamentals.sector ?? candidate.sector,
      industry: fundamentals.industry ?? candidate.industry,
      category: "Globaler Branchenpeer",
      currency: fundamentals.currency,
      currentPrice: quote.close,
      exchangeRateToChf,
      dividendYield: fundamentals.dividendYield,
      sharpeRatio: null,
      beta: null,
      quality: null,
      valuation: null,
      timing: null,
      signalScore: null,
      signalLabel: null,
      dataQualityStatus: "global_exact_industry",
      isActive: true,
      isCantonalBank: false,
      origin: "global" as const,
    }))
    .slice(0, maxCandidates);
}
