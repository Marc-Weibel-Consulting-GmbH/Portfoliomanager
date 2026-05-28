/**
 * TradingView Analytics Router
 * Proxies requests to the TradingView Analytics Bridge (FastAPI on Railway).
 *
 * Environment variables required:
 *   TRADINGVIEW_BRIDGE_URL     — Railway service URL (e.g. https://tv-bridge.up.railway.app)
 *   TRADINGVIEW_BRIDGE_API_KEY — Optional API key to secure the bridge
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

const BRIDGE_URL = process.env.TRADINGVIEW_BRIDGE_URL?.replace(/\/$/, "") ?? "";
const BRIDGE_KEY = process.env.TRADINGVIEW_BRIDGE_API_KEY ?? "";

/** Build URL with optional API key query param */
function bridgeUrl(path: string, params: Record<string, string | number | boolean> = {}): string {
  if (!BRIDGE_URL) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "TRADINGVIEW_BRIDGE_URL is not configured. Deploy the tradingview-service to Railway first.",
    });
  }
  const url = new URL(`${BRIDGE_URL}${path}`);
  if (BRIDGE_KEY) url.searchParams.set("api_key", BRIDGE_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}

/** Fetch helper with timeout and error handling */
async function bridgeFetch<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30_000
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Bridge error ${res.status}: ${text.slice(0, 200)}`,
      });
    }
    return res.json() as Promise<T>;
  } catch (err: unknown) {
    if (err instanceof TRPCError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Bridge fetch failed: ${msg}` });
  } finally {
    clearTimeout(timer);
  }
}

// ── Exchange mapping: map Yahoo-style suffixes to TradingView exchange names ──
const EXCHANGE_MAP: Record<string, string> = {
  ".SW": "SIX",
  ".DE": "XETRA",
  ".PA": "EURONEXT",
  ".L": "LSE",
  ".T": "TSE",
  ".HK": "HKEX",
  // US stocks have no suffix → NASDAQ or NYSE
};

function inferExchange(symbol: string): string {
  for (const [suffix, exchange] of Object.entries(EXCHANGE_MAP)) {
    if (symbol.toUpperCase().endsWith(suffix.toUpperCase())) return exchange;
  }
  return "NASDAQ"; // default for US stocks
}

function stripExchangeSuffix(symbol: string): string {
  for (const suffix of Object.keys(EXCHANGE_MAP)) {
    if (symbol.toUpperCase().endsWith(suffix.toUpperCase())) {
      return symbol.slice(0, -suffix.length);
    }
  }
  return symbol;
}

// ── Router ────────────────────────────────────────────────────────────────────
export const tradingviewRouter = router({

  /** Check if the bridge is reachable */
  health: publicProcedure.query(async () => {
    if (!BRIDGE_URL) return { status: "not_configured", message: "TRADINGVIEW_BRIDGE_URL not set" };
    try {
      const url = bridgeUrl("/health");
      const data = await bridgeFetch<{ status: string }>(url, {}, 5_000);
      return { status: data.status, bridgeUrl: BRIDGE_URL };
    } catch {
      return { status: "unreachable", bridgeUrl: BRIDGE_URL };
    }
  }),

  /** Real-time price for a symbol */
  price: publicProcedure
    .input(z.object({ symbol: z.string().min(1) }))
    .query(async ({ input }) => {
      const url = bridgeUrl(`/price/${encodeURIComponent(input.symbol)}`);
      return bridgeFetch(url);
    }),

  /** Multi-timeframe technical analysis */
  analysis: publicProcedure
    .input(z.object({
      symbol: z.string().min(1),
      exchange: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const exchange = input.exchange ?? inferExchange(input.symbol);
      const tvSymbol = stripExchangeSuffix(input.symbol);
      const url = bridgeUrl(`/analysis/${encodeURIComponent(tvSymbol)}`, { exchange });
      return bridgeFetch(url, {}, 45_000);
    }),

  /** Bollinger Band + indicator signals for a stock */
  signals: publicProcedure
    .input(z.object({
      symbol: z.string().min(1),
      exchange: z.string().optional(),
      timeframe: z.string().default("1d"),
    }))
    .query(async ({ input }) => {
      const exchange = input.exchange ?? inferExchange(input.symbol);
      const tvSymbol = stripExchangeSuffix(input.symbol);
      const url = bridgeUrl(`/signals/${encodeURIComponent(tvSymbol)}`, {
        exchange,
        timeframe: input.timeframe,
      });
      return bridgeFetch(url, {}, 45_000);
    }),

  /** Global market snapshot */
  marketSnapshot: publicProcedure.query(async () => {
    const url = bridgeUrl("/market-snapshot");
    return bridgeFetch(url, {}, 20_000);
  }),

  /** Financial news */
  news: publicProcedure
    .input(z.object({
      query: z.string().default("market"),
      count: z.number().min(1).max(50).default(10),
    }))
    .query(async ({ input }) => {
      const url = bridgeUrl("/news", { query: input.query, count: input.count });
      return bridgeFetch(url, {}, 20_000);
    }),

  /** Reddit sentiment for a symbol */
  sentiment: publicProcedure
    .input(z.object({ symbol: z.string().min(1) }))
    .query(async ({ input }) => {
      const url = bridgeUrl(`/sentiment/${encodeURIComponent(input.symbol)}`);
      return bridgeFetch(url, {}, 20_000);
    }),

  /** Backtest a single strategy */
  backtest: publicProcedure
    .input(z.object({
      symbol: z.string().min(1),
      exchange: z.string().optional(),
      strategy: z.enum(["rsi", "bollinger", "macd", "ema_cross", "supertrend", "donchian", "rsi_pullback", "keltner", "triple_ema"]).default("rsi"),
      timeframe: z.string().default("1d"),
      initialCapital: z.number().default(10000),
      includeTradeLog: z.boolean().default(false),
      includeEquityCurve: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const exchange = input.exchange ?? inferExchange(input.symbol);
      const tvSymbol = stripExchangeSuffix(input.symbol);
      const url = bridgeUrl("/backtest");
      return bridgeFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: tvSymbol,
          exchange,
          strategy: input.strategy,
          timeframe: input.timeframe,
          initial_capital: input.initialCapital,
          include_trade_log: input.includeTradeLog,
          include_equity_curve: input.includeEquityCurve,
        }),
      }, 120_000);
    }),

  /** Compare all 9 strategies */
  compareStrategies: publicProcedure
    .input(z.object({
      symbol: z.string().min(1),
      exchange: z.string().optional(),
      timeframe: z.string().default("1d"),
      initialCapital: z.number().default(10000),
    }))
    .mutation(async ({ input }) => {
      const exchange = input.exchange ?? inferExchange(input.symbol);
      const tvSymbol = stripExchangeSuffix(input.symbol);
      const url = bridgeUrl("/compare-strategies");
      return bridgeFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: tvSymbol,
          exchange,
          timeframe: input.timeframe,
          initial_capital: input.initialCapital,
        }),
      }, 180_000);
    }),

  /** Top gainers for an exchange */
  topGainers: publicProcedure
    .input(z.object({
      exchange: z.string().default("NASDAQ"),
      timeframe: z.string().default("1d"),
      limit: z.number().min(5).max(100).default(20),
    }))
    .query(async ({ input }) => {
      const url = bridgeUrl("/top-gainers", input);
      return bridgeFetch(url, {}, 30_000);
    }),

  /** Top losers for an exchange */
  topLosers: publicProcedure
    .input(z.object({
      exchange: z.string().default("NASDAQ"),
      timeframe: z.string().default("1d"),
      limit: z.number().min(5).max(100).default(20),
    }))
    .query(async ({ input }) => {
      const url = bridgeUrl("/top-losers", input);
      return bridgeFetch(url, {}, 30_000);
    }),
});
