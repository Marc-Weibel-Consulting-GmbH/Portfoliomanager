/**
 * Copilot Scheduled Handlers
 * ==========================
 * Heartbeat-triggered endpoints for:
 * 1. Weekly Walk-Forward Validation on Watchlist universe
 * 2. Daily LPPL Bubble Monitoring on all portfolio positions
 * 3. Daily evaluation of past copilot recommendations (30/60/90 day check)
 */

import { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { notifyOwner } from "../_core/notification";
import { getDb } from "../db";
import { savedPortfolios, watchlistStocks } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { runWalkForwardValidation, getWatchlistTickers } from "../analytics/walkForwardEngine";
import { evaluateRecommendations } from "../analytics/copilotHistory";

// ============ WALK-FORWARD WEEKLY JOB ============

export async function handleWalkForwardWeekly(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!(user as any).isCron || !(user as any).taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    console.log("[Scheduled] Walk-Forward weekly job started");

    // Get all watchlist tickers
    const tickers = await getWatchlistTickers();
    if (tickers.length === 0) {
      return res.json({ ok: true, skipped: "no watchlist tickers" });
    }

    // Run walk-forward validation on watchlist universe
    const results = await runWalkForwardValidation({
      tickers: tickers.slice(0, 100), // Max 100 tickers
      trainMonths: 6,
      testMonths: 1,
      windows: 6,
      source: 'watchlist',
    });

    // Find top performers (consistent top quartile)
    const topPerformers = results.topPerformers
      .filter((t: any) => t.avgOosReturn > 0 && t.consistencyScore > 0.55)
      .sort((a: any, b: any) => b.avgOosReturn - a.avgOosReturn)
      .slice(0, 10);

    // Notify owner if there are strong signals
    if (topPerformers.length > 0) {
      const topList = topPerformers
        .map((t: any) => `• ${t.ticker}: OOS-Return ${(t.avgOosReturn * 100).toFixed(1)}%, Konsistenz ${(t.consistencyScore * 100).toFixed(0)}%`)
        .join('\n');

      await notifyOwner({
        title: "🎯 Walk-Forward: Top-Titel der Woche",
        content: `Walk-Forward Validation auf ${tickers.length} Watchlist-Titeln abgeschlossen.\n\n` +
          `**Gesamt-OOS-Alpha:** ${(results.oosAlpha * 100).toFixed(2)}%\n` +
          `**OOS Hit Rate:** ${(results.oosHitRate * 100).toFixed(0)}%\n` +
          `**Overfit Ratio:** ${results.overfitRatio.toFixed(2)}\n\n` +
          `**Top ${topPerformers.length} Titel:**\n${topList}`,
      });
    }

    console.log(`[Scheduled] Walk-Forward completed: ${results.topPerformers.length} tickers analyzed`);
    res.json({
      ok: true,
      tickersAnalyzed: results.tickerCount,
      topPerformers: topPerformers.length,
      oosAlpha: results.oosAlpha,
      oosHitRate: results.oosHitRate,
    });
  } catch (error: any) {
    console.error("[Scheduled] Walk-Forward error:", error);
    res.status(500).json({
      error: error.message,
      stack: error.stack,
      context: { url: req.url, taskUid: (req as any).taskUid },
      timestamp: new Date().toISOString(),
    });
  }
}

// ============ LPPL MONITORING DAILY JOB ============

export async function handleLPPLMonitoring(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!(user as any).isCron || !(user as any).taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    console.log("[Scheduled] LPPL Monitoring daily job started");

    const db = await getDb();
    if (!db) {
      return res.json({ ok: true, skipped: "no database" });
    }

    // Get all portfolio tickers across all user portfolios
    const portfolios = await db.select().from(savedPortfolios);
    const allTickers = new Set<string>();

    for (const p of portfolios) {
      try {
        const data = JSON.parse(p.portfolioData || '{}');
        const stocks = Array.isArray(data) ? data : (data.stocks || []);
        stocks.forEach((s: any) => {
          if (s.ticker) allTickers.add(s.ticker);
        });
      } catch (e) { /* skip */ }
    }

    if (allTickers.size === 0) {
      return res.json({ ok: true, skipped: "no portfolio tickers" });
    }

    // Import LPPL engine
    const { detectBubble } = await import("../analytics/lpplsEngine");

    // Check each ticker for bubble signals
    const warnings: { ticker: string; confidence: number; criticalTime: string }[] = [];
    const YahooFinanceClass = (await import("yahoo-finance2")).default;
    const yf: any = new (YahooFinanceClass as any)();

    for (const ticker of allTickers) {
      try {
        const yahooTicker = ticker.endsWith('.US') ? ticker.slice(0, -3) : ticker;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 2);

        const history = await yf.chart(yahooTicker, {
          period1: startDate.toISOString().split('T')[0],
          period2: endDate.toISOString().split('T')[0],
          interval: '1d',
        });

        if (!history?.quotes || history.quotes.length < 100) continue;

        const prices = history.quotes
          .filter((q: any) => q.close != null)
          .map((q: any) => q.close);

        // Run LPPL detection (use last 120 prices for analysis)
        const analysisWindow = prices.slice(-120);
        const result = detectBubble({
          prices: analysisWindow,
        });

        if (result && result.bubbleConfidence > 0.7) {
          warnings.push({
            ticker,
            confidence: result.bubbleConfidence,
            criticalTime: result.criticalTime ? new Date(result.criticalTime).toISOString().split('T')[0] : 'unknown',
          });
        }

        // Rate limiting
        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        // Skip individual ticker errors
        continue;
      }
    }

    // Notify owner if bubble warnings detected
    if (warnings.length > 0) {
      const warningList = warnings
        .sort((a, b) => b.confidence - a.confidence)
        .map(w => `⚠️ **${w.ticker}**: Confidence ${(w.confidence * 100).toFixed(0)}%, Critical Time: ${w.criticalTime}`)
        .join('\n');

      await notifyOwner({
        title: "🫧 LPPL Bubble-Warnung: Aktive Signale erkannt!",
        content: `LPPL-Monitoring hat ${warnings.length} potentielle Bubble-Signale in deinen Portfolio-Positionen erkannt:\n\n${warningList}\n\n` +
          `Empfehlung: Überprüfe diese Positionen und erwäge Stop-Loss oder Gewinnmitnahme.`,
      });
    }

    console.log(`[Scheduled] LPPL Monitoring completed: ${allTickers.size} tickers checked, ${warnings.length} warnings`);
    res.json({
      ok: true,
      tickersChecked: allTickers.size,
      warnings: warnings.length,
      warningTickers: warnings.map(w => w.ticker),
    });
  } catch (error: any) {
    console.error("[Scheduled] LPPL Monitoring error:", error);
    res.status(500).json({
      error: error.message,
      stack: error.stack,
      context: { url: req.url, taskUid: (req as any).taskUid },
      timestamp: new Date().toISOString(),
    });
  }
}

// ============ EVALUATE RECOMMENDATIONS DAILY JOB ============

export async function handleEvaluateRecommendations(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!(user as any).isCron || !(user as any).taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    console.log("[Scheduled] Evaluate recommendations daily job started");

        // Evaluate all pending recommendations
    const evalResult = await evaluateRecommendations();
    if (evalResult.evaluated > 0) {
      console.log(`[Scheduled] Evaluated ${evalResult.evaluated} past recommendations`);
    }
    res.json({ ok: true, evaluated: evalResult.evaluated, errors: evalResult.errors });
  } catch (error: any) {
    console.error("[Scheduled] Evaluate recommendations error:", error);
    res.status(500).json({
      error: error.message,
      stack: error.stack,
      context: { url: req.url, taskUid: (req as any).taskUid },
      timestamp: new Date().toISOString(),
    });
  }
}
