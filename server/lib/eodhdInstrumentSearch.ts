import { fetchEODHDFundamentals, fetchEODHDRealTime } from "../_core/eodhdApi";
import { getEodhdApiKey } from "../_core/env";
import { toEodhdSymbol } from "./eodhdSymbol";

export type EodhdSearchRawInstrument = {
  Code?: unknown;
  Exchange?: unknown;
  Name?: unknown;
  Type?: unknown;
  Country?: unknown;
};

export type EodhdSearchInstrument = {
  ticker: string;
  companyName: string;
  exchange: string;
  quoteType: "ETF" | "EQUITY";
  country: string | null;
  source: "EODHD";
};

const EODHD_SEARCH_ENDPOINT = "https://eodhd.com/api/search";

/**
 * EODHD exposes venue names such as NASDAQ/NYSE, while its quote and historical
 * endpoints use the consolidated US exchange code. The remaining venues are
 * already valid EODHD suffixes and remain explicit, e.g. LSE or XETRA.
 */
const EXCHANGE_ALIASES: Record<string, string> = {
  NASDAQ: "US",
  NYSE: "US",
  NYSEARCA: "US",
  NYSEAMERICAN: "US",
  AMEX: "US",
  BATS: "US",
  SIX: "SW",
  SWX: "SW",
};

const GENERIC_SEARCH_TERMS = new Set([
  "msci",
  "yield",
  "ucits",
  "etf",
  "fund",
  "index",
  "trust",
  "class",
]);

function normalizedText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toCanonicalExchange(exchange: string): string {
  const upper = exchange.toUpperCase().replace(/\s+/g, "");
  return EXCHANGE_ALIASES[upper] ?? upper;
}

function toCanonicalTicker(code: string, exchange: string): string {
  const upperCode = code.toUpperCase().trim();
  const upperExchange = exchange.toUpperCase();
  // EODHD normally returns Code without a suffix. Preserve an already-complete
  // symbol so that a provider response cannot accidentally become WQDS.LSE.LSE.
  return upperCode.endsWith(`.${upperExchange}`) ? upperCode : `${upperCode}.${upperExchange}`;
}

export function normalizeEodhdSearchInstrument(raw: EodhdSearchRawInstrument): EodhdSearchInstrument | null {
  const code = normalizedText(raw.Code);
  const exchange = normalizedText(raw.Exchange);
  const companyName = normalizedText(raw.Name);
  if (!code || !exchange || !companyName) return null;

  const canonicalExchange = toCanonicalExchange(exchange);
  const type = normalizedText(raw.Type)?.toUpperCase() ?? "";
  const quoteType = type.includes("ETF") || type.includes("FUND") ? "ETF" : "EQUITY";

  return {
    ticker: toCanonicalTicker(code, canonicalExchange),
    companyName,
    exchange: canonicalExchange,
    quoteType,
    country: normalizedText(raw.Country),
    source: "EODHD",
  };
}

/**
 * Provider fund names are often shorter than the product names surfaced by an
 * optimizer (for example, "Core High Dividend" instead of "MSCI High Dividend
 * Yield"). Preserve the exact search first, then try at most two concise,
 * deterministic fallbacks rather than claiming that an absent instrument exists.
 */
export function buildEodhdSearchQueries(query: string): string[] {
  const original = query.trim().replace(/\s+/g, " ");
  if (!original) return [];

  const terms = original.split(" ");
  const informative = terms.filter((term) => !GENERIC_SEARCH_TERMS.has(term.toLowerCase()));
  const hasIshares = informative.some((term) => term.toLowerCase() === "ishares");
  const descriptor = informative.filter((term) => term.toLowerCase() !== "ishares");

  const candidates = [original];
  if (descriptor.length >= 2) {
    candidates.push([...(hasIshares ? ["iShares"] : []), ...descriptor.slice(0, 2)].join(" "));
    candidates.push(descriptor.slice(0, 2).join(" "));
  }

  return [...new Set(candidates.filter(Boolean))].slice(0, 3);
}

export type EodhdHistoricalChartPoint = {
  date: string;
  close: number | string | null;
  adjustedClose?: number | string | null;
};

export type EodhdHistoricalChartSeries = {
  status: "adjusted_close" | "raw_close" | "incompatible";
  points: Array<{ date: string; close: number }>;
};

function positiveNumber(value: number | string | null | undefined): number | null {
  const result = Number(value);
  return Number.isFinite(result) && result > 0 ? result : null;
}

/**
 * A stock chart needs exactly one homogeneous price basis. If EODHD supplies
 * adjusted close for every date, use it; otherwise a split-like raw-price jump
 * is an explicit data gap rather than a false 70–90% performance event.
 */
export function selectEodhdHistoricalChartSeries(
  rawPoints: EodhdHistoricalChartPoint[],
): EodhdHistoricalChartSeries {
  const pointsByDate = new Map<string, { date: string; close: number; adjustedClose: number | null }>();
  for (const raw of rawPoints) {
    const date = String(raw.date).slice(0, 10);
    const close = positiveNumber(raw.close);
    if (!date || close === null) continue;
    pointsByDate.set(date, {
      date,
      close,
      adjustedClose: positiveNumber(raw.adjustedClose),
    });
  }

  const points = [...pointsByDate.values()].sort((left, right) => left.date.localeCompare(right.date));
  if (points.length === 0) return { status: "incompatible", points: [] };

  if (points.every((point) => point.adjustedClose !== null)) {
    return {
      status: "adjusted_close",
      points: points.map((point) => ({ date: point.date, close: point.adjustedClose as number })),
    };
  }

  for (let index = 1; index < points.length; index += 1) {
    const dailyMove = Math.abs(points[index].close / points[index - 1].close - 1);
    if (dailyMove >= 0.4) return { status: "incompatible", points: [] };
  }

  return {
    status: "raw_close",
    points: points.map((point) => ({ date: point.date, close: point.close })),
  };
}

export async function fetchTransientEodhdHistoricalChartSeries(
  ticker: string,
  from: string,
  to: string,
): Promise<EodhdHistoricalChartSeries> {
  const apiKey = await getEodhdApiKey();
  if (!apiKey) return { status: "incompatible", points: [] };

  try {
    const symbol = toEodhdSymbol(ticker);
    const url = `https://eodhd.com/api/eod/${encodeURIComponent(symbol)}?api_token=${apiKey}&fmt=json&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const response = await fetch(url);
    if (!response.ok) return { status: "incompatible", points: [] };
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) return { status: "incompatible", points: [] };

    return selectEodhdHistoricalChartSeries(payload.map((item) => {
      const row = item as { date?: unknown; close?: unknown; adjusted_close?: unknown };
      return {
        date: String(row.date ?? ""),
        close: typeof row.close === "number" || typeof row.close === "string" ? row.close : null,
        adjustedClose: typeof row.adjusted_close === "number" || typeof row.adjusted_close === "string"
          ? row.adjusted_close
          : null,
      };
    }));
  } catch (error) {
    console.warn(`[EODHD chart] Failed for ${ticker}:`, error instanceof Error ? error.message : error);
    return { status: "incompatible", points: [] };
  }
}

/**
 * EODHD-first instrument discovery for the invest search. This is read-only:
 * it does not add a title to the portfolio, the stock universe or any ledger.
 */
export async function searchEodhdInstruments(query: string, limit = 15): Promise<EodhdSearchInstrument[]> {
  const searchQueries = buildEodhdSearchQueries(query);
  if (searchQueries.length === 0) return [];

  const apiKey = await getEodhdApiKey();
  if (!apiKey) return [];

  try {
    const unique = new Map<string, EodhdSearchInstrument>();
    for (const searchQuery of searchQueries) {
      const url = `${EODHD_SEARCH_ENDPOINT}/${encodeURIComponent(searchQuery)}?api_token=${apiKey}&limit=${Math.max(1, Math.min(limit, 25))}`;
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`[EODHD search] ${response.status} for ${searchQuery}`);
        continue;
      }

      const payload: unknown = await response.json();
      if (!Array.isArray(payload)) continue;
      for (const item of payload) {
        const result = normalizeEodhdSearchInstrument(item as EodhdSearchRawInstrument);
        if (result && !unique.has(result.ticker)) unique.set(result.ticker, result);
      }
      // Exact provider hits always win and avoid additional provider calls.
      if (unique.size > 0 && searchQuery === searchQueries[0]) break;
    }
    return [...unique.values()].slice(0, limit);
  } catch (error) {
    console.warn(`[EODHD search] Failed for ${searchQueries[0]}:`, error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * Read-only fallback used by the stock detail page for a valid external search
 * hit that is not part of the locally curated universe yet. No stock row or
 * price history is persisted merely by opening the detail page.
 */
export async function fetchEodhdInstrumentSnapshot(ticker: string) {
  const normalizedTicker = ticker.trim().toUpperCase();
  if (!normalizedTicker) return undefined;

  const [fundamentals, quote] = await Promise.all([
    fetchEODHDFundamentals(normalizedTicker),
    fetchEODHDRealTime(normalizedTicker),
  ]);

  if (!fundamentals.companyName && !(quote.close && quote.close > 0)) return undefined;

  const asDecimal = (value: number | null, digits = 2) =>
    value == null || !Number.isFinite(value) ? null : value.toFixed(digits);

  return {
    ticker: normalizedTicker,
    companyName: fundamentals.companyName ?? normalizedTicker,
    currentPrice: asDecimal(quote.close, 4),
    currency: fundamentals.currency,
    peRatio: asDecimal(fundamentals.peRatio),
    pegRatio: asDecimal(fundamentals.pegRatio),
    dividendYield: fundamentals.dividendYield == null ? null : asDecimal(fundamentals.dividendYield * 100),
    beta: asDecimal(fundamentals.beta),
    marketCap: fundamentals.marketCap == null ? null : asDecimal(fundamentals.marketCap / 1_000_000_000),
    week52High: null,
    week52Low: null,
    sector: fundamentals.sector,
    industry: fundamentals.industry,
    category: null,
    volatility: null,
    sharpeRatio: null,
    ytdPerformance: null,
    chartData: null,
    score: null,
    dataSource: "EODHD" as const,
  };
}
