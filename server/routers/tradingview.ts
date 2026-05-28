/**
 * TradingView MCP Router
 *
 * Calls the TradingView MCP Server directly via the MCP streamable-http protocol.
 * No FastAPI bridge needed — the MCP server is deployed directly on Railway.
 *
 * Environment variable required:
 *   TRADINGVIEW_MCP_URL  — Railway URL of the MCP server
 *                          e.g. https://tradingview-mcp-production.up.railway.app
 *
 * Protocol (3-step):
 *   1. POST /mcp  { method: "initialize" }  → get Mcp-Session-Id header
 *   2. POST /mcp  { method: "notifications/initialized" }  (202, no body)
 *   3. POST /mcp  { method: "tools/call", params: { name, arguments } }  → SSE result
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import YahooFinanceClass from 'yahoo-finance2';
import { calculateQualityScore, calculateMomentumScore, extractQualityFromYahoo } from '../analytics/qualityMomentumEngine';
import { detectBubble } from '../analytics/lpplsEngine';
// yahoo-finance2 v3: default export is a constructor class
const yahooFinance = new (YahooFinanceClass as any)();

const MCP_BASE = process.env.TRADINGVIEW_MCP_URL?.replace(/\/$/, "") ?? "";

// ── Exchange mapping: Yahoo suffix → TradingView exchange name ─────────────────
const EXCHANGE_MAP: Record<string, { exchange: string; screener: string }> = {
  ".SW": { exchange: "SIX",      screener: "europe"  },
  ".DE": { exchange: "XETRA",    screener: "europe"  },
  ".PA": { exchange: "EURONEXT", screener: "europe"  },
  ".L":  { exchange: "LSE",      screener: "europe"  },
  ".T":  { exchange: "TSE",      screener: "japan"   },
  ".HK": { exchange: "HKEX",     screener: "hongkong"},
};

function inferExchangeInfo(symbol: string): { exchange: string; screener: string; tvSymbol: string } {
  for (const [suffix, info] of Object.entries(EXCHANGE_MAP)) {
    if (symbol.toUpperCase().endsWith(suffix.toUpperCase())) {
      return { ...info, tvSymbol: symbol.slice(0, -suffix.length).toUpperCase() };
    }
  }
  return { exchange: "NASDAQ", screener: "america", tvSymbol: symbol.toUpperCase() };
}

// ── MCP Protocol Helpers ───────────────────────────────────────────────────────

async function mcpInit(): Promise<string> {
  if (!MCP_BASE) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "TRADINGVIEW_MCP_URL is not configured. Deploy mcp-servers/tradingview to Railway and set the env var.",
    });
  }

  const res = await fetch(`${MCP_BASE}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "portfolio-app", version: "1.0" },
      },
    }),
  });

  // HTTP/2 headers are lowercase; Node.js fetch normalises them, but try both variants
  const sessionId = res.headers.get("mcp-session-id") ?? res.headers.get("Mcp-Session-Id");
  if (!sessionId) {
    const hdrs: Record<string, string> = {};
    res.headers.forEach((v, k) => { hdrs[k] = v; });
    console.error("[TradingView MCP] No session ID. Status:", res.status, "Headers:", JSON.stringify(hdrs));
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "MCP server returned no session ID" });
  }

  // Fire-and-forget initialized notification
  fetch(`${MCP_BASE}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "Mcp-Session-Id": sessionId,
    },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }),
  }).catch(() => {});

  return sessionId;
}

async function mcpCallTool<T = unknown>(
  sessionId: string,
  toolName: string,
  args: Record<string, unknown>,
  timeoutMs = 60_000
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${MCP_BASE}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "Mcp-Session-Id": sessionId,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: { name: toolName, arguments: args },
      }),
      signal: controller.signal,
    });

    const text = await res.text();

    // Parse SSE stream — find "data: {...}" line
    for (const line of text.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const json = JSON.parse(line.slice(6));
      if (json.error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `MCP tool "${toolName}" error: ${JSON.stringify(json.error)}`,
        });
      }
      const raw = json.result?.content?.[0]?.text;
      if (raw === undefined) continue;
      try { return JSON.parse(raw) as T; } catch { return raw as unknown as T; }
    }
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No result in MCP response" });
  } catch (err) {
    if (err instanceof TRPCError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `MCP call failed: ${msg}` });
  } finally {
    clearTimeout(timer);
  }
}

/** One-shot helper: init session + call tool */
async function mcp<T = unknown>(
  toolName: string,
  args: Record<string, unknown>,
  timeoutMs = 60_000
): Promise<T> {
  const sessionId = await mcpInit();
  return mcpCallTool<T>(sessionId, toolName, args, timeoutMs);
}

// ── tRPC Router ────────────────────────────────────────────────────────────────

export const tradingviewRouter = router({

  /** Check if the MCP server is configured and reachable */
  status: publicProcedure.query(async () => {
    if (!MCP_BASE) return { configured: false, reachable: false, url: null };
    try {
      const sessionId = await mcpInit();
      return { configured: true, reachable: !!sessionId, url: MCP_BASE };
    } catch (err) {
      return { configured: true, reachable: false, url: MCP_BASE, error: String(err) };
    }
  }),

  /** Live price from Yahoo Finance */
  price: publicProcedure
    .input(z.object({ symbol: z.string().min(1) }))
    .query(async ({ input }) => {
      return mcp("yahoo_price", { symbol: input.symbol });
    }),

  /** Multi-timeframe technical analysis (1h / 4h / 1d) */
  analysis: publicProcedure
    .input(z.object({
      symbol: z.string().min(1),
      exchange: z.string().optional(),
      screener: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const { exchange, screener, tvSymbol } = inferExchangeInfo(input.symbol);
      return mcp("multi_timeframe_analysis", {
        symbol: tvSymbol,
        exchange: input.exchange ?? exchange,
        screener: input.screener ?? screener,
      }, 60_000);
    }),

  /** Combined TA signals (summary + oscillators + MAs) */
  signals: publicProcedure
    .input(z.object({
      symbol: z.string().min(1),
      exchange: z.string().optional(),
      screener: z.string().optional(),
      interval: z.string().default("1d"),
    }))
    .query(async ({ input }) => {
      const { exchange, screener, tvSymbol } = inferExchangeInfo(input.symbol);
      return mcp("combined_analysis", {
        symbol: tvSymbol,
        exchange: input.exchange ?? exchange,
        screener: input.screener ?? screener,
        interval: input.interval,
      }, 45_000);
    }),

  /** Backtest a single strategy */
  backtest: publicProcedure
    .input(z.object({
      symbol: z.string().min(1),
      strategy: z.enum([
        "rsi_oversold", "macd_crossover", "bollinger_breakout",
        "ema_crossover", "sma_crossover", "rsi_divergence",
        "volume_breakout", "supertrend", "ichimoku",
      ]).default("macd_crossover"),
      period: z.string().default("1y"),
      interval: z.string().default("1d"),
    }))
    .query(async ({ input }) => {
      return mcp("backtest_strategy", {
        symbol: input.symbol,
        strategy: input.strategy,
        period: input.period,
        interval: input.interval,
      }, 120_000);
    }),

  /** Compare all strategies on a symbol */
  compareStrategies: publicProcedure
    .input(z.object({
      symbol: z.string().min(1),
      period: z.string().default("1y"),
      interval: z.string().default("1d"),
    }))
    .query(async ({ input }) => {
      return mcp("compare_strategies", {
        symbol: input.symbol,
        period: input.period,
        interval: input.interval,
      }, 180_000);
    }),

  /** Walk-forward backtest */
  walkForwardBacktest: publicProcedure
    .input(z.object({
      symbol: z.string().min(1),
      strategy: z.string().default("macd_crossover"),
      total_period: z.string().default("2y"),
      interval: z.string().default("1d"),
      n_splits: z.number().default(5),
    }))
    .query(async ({ input }) => {
      return mcp("walk_forward_backtest_strategy", {
        symbol: input.symbol,
        strategy: input.strategy,
        total_period: input.total_period,
        interval: input.interval,
        n_splits: input.n_splits,
      }, 180_000);
    }),

  /** Market snapshot (top gainers/losers) */
  marketSnapshot: publicProcedure
    .input(z.object({ market: z.string().default("america") }))
    .query(async ({ input }) => {
      return mcp("get_market_snapshot", { market: input.market }, 20_000);
    }),

  /** Financial news for a symbol */
  news: publicProcedure
    .input(z.object({
      symbol: z.string().min(1),
      limit: z.number().default(10),
    }))
    .query(async ({ input }) => {
      return mcp("financial_news", { symbol: input.symbol, limit: input.limit }, 20_000);
    }),

  /** Social sentiment */
  sentiment: publicProcedure
    .input(z.object({ symbol: z.string().min(1) }))
    .query(async ({ input }) => {
      return mcp("market_sentiment", { symbol: input.symbol }, 20_000);
    }),

  /** Volume breakout scanner */
  volumeBreakout: publicProcedure
    .input(z.object({
      exchange: z.string().default("NASDAQ"),
      screener: z.string().default("america"),
      min_volume_ratio: z.number().default(2.0),
      limit: z.number().default(20),
    }))
    .query(async ({ input }) => {
      return mcp("volume_breakout_scanner", {
        exchange: input.exchange,
        screener: input.screener,
        min_volume_ratio: input.min_volume_ratio,
        limit: input.limit,
      }, 30_000);
    }),

  /** Top gainers */
  topGainers: publicProcedure
    .input(z.object({
      exchange: z.string().default("NASDAQ"),
      screener: z.string().default("america"),
      limit: z.number().default(20),
    }))
    .query(async ({ input }) => {
      return mcp("top_gainers", {
        exchange: input.exchange,
        screener: input.screener,
        limit: input.limit,
      }, 30_000);
    }),

  /** Top losers */
  topLosers: publicProcedure
    .input(z.object({
      exchange: z.string().default("NASDAQ"),
      screener: z.string().default("america"),
      limit: z.number().default(20),
    }))
    .query(async ({ input }) => {
      return mcp("top_losers", {
        exchange: input.exchange,
        screener: input.screener,
        limit: input.limit,
      }, 30_000);
    }),

  /** Bollinger Band scanner */
  bollingerScan: publicProcedure
    .input(z.object({
      exchange: z.string().default("NASDAQ"),
      screener: z.string().default("america"),
      limit: z.number().default(20),
    }))
    .query(async ({ input }) => {
      return mcp("bollinger_band_scanner", {
        exchange: input.exchange,
        screener: input.screener,
        limit: input.limit,
      }, 30_000);
    }),

  /** Multi-agent analysis (Technical + Sentiment + Risk) */
  multiAgentAnalysis: publicProcedure
    .input(z.object({
      symbol: z.string().min(1),
      interval: z.string().default("1d"),
    }))
    .query(async ({ input }) => {
      const { exchange, screener, tvSymbol } = inferExchangeInfo(input.symbol);
      return mcp("multi_agent_analysis", {
        symbol: tvSymbol,
        exchange,
        screener,
        interval: input.interval,
      }, 120_000);
    }),

  /** Combined Momentum + Quality + LPPL Scoring */
  stockScoring: publicProcedure
    .input(z.object({ symbol: z.string().min(1) }))
    .query(async ({ input }) => {
      const ticker = input.symbol.toUpperCase();
      try {
        // 1. Historical prices (12 months)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        const chartResult: any = await yahooFinance.chart(ticker, {
          period1: startDate.toISOString().split('T')[0],
          period2: endDate.toISOString().split('T')[0],
          interval: '1d',
        });
        const quotes = (chartResult?.quotes ?? []).filter((q: any) => q.close != null);
        const prices: number[] = quotes.map((q: any) => q.close as number);

        // 2. Fundamentals
        let qualityMetrics: any = {};
        try {
          const summary: any = await yahooFinance.quoteSummary(ticker, {
            modules: ['financialData', 'defaultKeyStatistics', 'summaryDetail'],
          });
          qualityMetrics = extractQualityFromYahoo(summary);
        } catch (_) {}

        // 3. Momentum Score
        let momentumResult: any = { score: 0, grade: 'C', trend: 'neutral', components: {} };
        if (prices.length >= 60) {
          try { momentumResult = calculateMomentumScore({ prices }); } catch (_) {}
        }

        // 4. Quality Score
        let qualityResult: any = { score: 0, grade: 'C', components: {} };
        try { qualityResult = calculateQualityScore(qualityMetrics); } catch (_) {}

        // 5. LPPL Bubble Score
        let bubbleScore = 0;
        let bubbleRegime = 'normal';
        if (prices.length >= 60) {
          try {
            const bubble = detectBubble({ prices });
            bubbleScore = bubble.bubbleScore ?? 0;
            bubbleRegime = bubble.regime ?? 'normal';
          } catch (_) {}
        }

        // 6. Combined Score: 40% Momentum + 40% Quality + 20% LPPL penalty
        const mNorm = (momentumResult.score + 1) / 2; // -1..1 → 0..1
        const qNorm = (qualityResult.score + 1) / 2;  // -1..1 → 0..1
        const lpplPenalty = bubbleRegime === 'bubble' ? bubbleScore * 0.5 : 0;
        const combined = Math.max(0, Math.min(1, 0.4 * mNorm + 0.4 * qNorm - lpplPenalty));

        const overallGrade = combined >= 0.75 ? 'A' : combined >= 0.60 ? 'B' : combined >= 0.45 ? 'C' : combined >= 0.30 ? 'D' : 'F';
        const signal = combined >= 0.70 ? 'STRONG BUY' : combined >= 0.55 ? 'BUY' : combined >= 0.45 ? 'HOLD' : combined >= 0.30 ? 'SELL' : 'STRONG SELL';

        return {
          ticker,
          combinedScore: parseFloat((combined * 100).toFixed(1)),
          overallGrade,
          signal,
          momentum: { score: parseFloat((momentumResult.score ?? 0).toFixed(3)), grade: momentumResult.grade, trend: momentumResult.trend },
          quality: { score: parseFloat((qualityResult.score ?? 0).toFixed(3)), grade: qualityResult.grade },
          lppl: { bubbleScore: parseFloat((bubbleScore ?? 0).toFixed(3)), regime: bubbleRegime, penalty: parseFloat((lpplPenalty * 100).toFixed(1)) },
          priceCount: prices.length,
          analysisDate: new Date().toISOString().split('T')[0],
        };
      } catch (err: any) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Scoring failed for ${ticker}: ${err.message}` });
      }
    }),
});
