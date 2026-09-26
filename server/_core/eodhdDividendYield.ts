import { apiCache } from "./apiCache";
import { getEodhdApiKey } from "./env";
import { eodhdDividendResponseSchema } from "./externalSchemas";
import { toEodhdSymbol } from "../lib/eodhdSymbol";
import {
  calculateTrailingTwelveMonthDividendYield,
  type TrailingDividendYieldResult,
} from "../lib/dividendYieldAnnualization";

export type EodhdTrailingDividendYield = TrailingDividendYieldResult & {
  source: "EODHD /api/div";
};

/**
 * Fetches dated EODHD cash events and derives TTM gross yield.  No FX conversion
 * is attempted: cash and price must already be expressed in the same listing
 * currency.  The short cache avoids repeated event calls when the same ticker is
 * rendered in a portfolio, detail view and watchlist during one session.
 */
export async function fetchEodhdTrailingDividendYield(input: {
  ticker: string;
  currentPrice: number | string | null | undefined;
  tradingCurrency: string | null | undefined;
  asOfDate?: string;
}): Promise<EodhdTrailingDividendYield> {
  const asOfDate = input.asOfDate ?? new Date().toISOString().slice(0, 10);
  const priceKey = Number(input.currentPrice);
  const cacheKey = `eodhd:dividend-ttm:${input.ticker}:${asOfDate}:${Number.isFinite(priceKey) ? priceKey.toFixed(4) : "na"}:${String(input.tradingCurrency ?? "").toUpperCase()}`;
  const cached = apiCache.get<EodhdTrailingDividendYield>(cacheKey);
  if (cached) return cached;

  const empty = (status: "price_missing" | "no_qualifying_events" | "currency_mismatch") => ({
    status,
    basis: null,
    dividendYieldPct: null,
    annualDividendPerShare: null,
    currency: String(input.tradingCurrency ?? "").toUpperCase() || null,
    eventCount: 0,
    excludedSpecialEventCount: 0,
    asOfDate,
    source: "EODHD /api/div" as const,
  });

  const apiKey = await getEodhdApiKey();
  if (!apiKey) return empty("no_qualifying_events");

  const start = new Date(`${asOfDate}T12:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return empty("price_missing");
  start.setUTCDate(start.getUTCDate() - 365);

  try {
    const symbol = toEodhdSymbol(input.ticker);
    const url = `https://eodhd.com/api/div/${encodeURIComponent(symbol)}?api_token=${apiKey}&fmt=json&from=${start.toISOString().slice(0, 10)}&to=${asOfDate}`;
    const response = await fetch(url);
    if (!response.ok) return empty("no_qualifying_events");
    const raw: unknown = await response.json();
    const parsed = eodhdDividendResponseSchema.safeParse(raw);
    if (!parsed.success) return empty("no_qualifying_events");

    const result: EodhdTrailingDividendYield = {
      ...calculateTrailingTwelveMonthDividendYield({
        asOfDate,
        currentPrice: input.currentPrice,
        tradingCurrency: input.tradingCurrency,
        events: parsed.data.map((event) => ({
          exDate: event.date,
          // Unadjusted cash is the declared amount per share.  `value` is only
          // used when the provider does not supply it separately.
          amount: event.unadjustedValue ?? event.value,
          currency: event.currency,
          period: event.period,
        })),
      }),
      source: "EODHD /api/div",
    };
    apiCache.set(cacheKey, result, 5 * 60 * 1000);
    return result;
  } catch (error) {
    console.warn(`[EODHD] TTM dividend retrieval failed for ${input.ticker}:`, error instanceof Error ? error.message : error);
    return empty("no_qualifying_events");
  }
}
