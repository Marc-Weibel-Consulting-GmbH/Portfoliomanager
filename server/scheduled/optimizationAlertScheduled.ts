/**
 * Optimization Alert Scheduled Handler
 *
 * Triggered weekly via Heartbeat cron (per user subscription).
 * Checks if portfolio weights have drifted more than the configured threshold
 * from the last-known optimal weights, and sends a notification.
 *
 * Route: POST /api/scheduled/optimizationAlert
 */
import type { Request, Response } from "express";

export async function handleOptimizationAlert(req: Request, res: Response) {
  try {
    const { sdk } = await import("../_core/sdk");
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const { getDb } = await import("../db");
    const { optimizationSubscriptions, savedPortfolios, stockSignalCache } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const { notifyOwner } = await import("../_core/notification");
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Database not available" });

    // Look up subscription by taskUid
    const subs = await db
      .select()
      .from(optimizationSubscriptions)
      .where(eq(optimizationSubscriptions.scheduleCronTaskUid, user.taskUid))
      .limit(1);

    if (subs.length === 0) {
      return res.status(404).json({ error: "Subscription not found for taskUid" });
    }
    const sub = subs[0];

    // Load portfolio
    const portfolios = await db
      .select()
      .from(savedPortfolios)
      .where(eq(savedPortfolios.id, sub.portfolioId))
      .limit(1);

    if (portfolios.length === 0) {
      return res.json({ ok: true, message: "Portfolio not found — skipping" });
    }
    const portfolio = portfolios[0];

    let portfolioData: { stocks?: any[] } = {};
    try {
      portfolioData = JSON.parse(portfolio.portfolioData || "{}");
    } catch {}

    const stocks = (portfolioData.stocks || []).filter((s: any) => s.ticker && s.ticker !== "CASH");
    if (stocks.length === 0) {
      return res.json({ ok: true, message: "No stocks in portfolio — skipping" });
    }

    // Check signal scores for all tickers
    const tickers = stocks.map((s: any) => s.ticker);
    const { inArray } = await import("drizzle-orm");
    const signals = await db
      .select()
      .from(stockSignalCache)
      .where(inArray(stockSignalCache.ticker, tickers));

    const signalMap = new Map(signals.map((s) => [s.ticker, s]));

    // Find positions with weak scores (below 50)
    const weakPositions = stocks.filter((s: any) => {
      const sig = signalMap.get(s.ticker);
      const score = sig?.combinedScore ?? sig?.qualityScore ?? null;
      return score !== null && Number(score) < 50;
    });

    const driftThreshold = sub.driftThresholdPp;

    if (weakPositions.length === 0) {
      // Update lastRunAt
      await db
        .update(optimizationSubscriptions)
        .set({ lastRunAt: new Date() })
        .where(eq(optimizationSubscriptions.id, sub.id));
      return res.json({ ok: true, message: "No weak positions — portfolio looks healthy" });
    }

    // Send notification
    const weakList = weakPositions
      .map((s: any) => {
        const sig = signalMap.get(s.ticker);
        const score = sig?.combinedScore ?? sig?.qualityScore ?? "–";
        return `${s.ticker} (Score: ${score}, Gewicht: ${parseFloat(s.weight || "0").toFixed(1)}%)`;
      })
      .join("\n• ");

    await notifyOwner({
      title: `📊 Optimierungs-Check: ${portfolio.name} — ${weakPositions.length} schwache Position${weakPositions.length !== 1 ? "en" : ""}`,
      content: `Das Portfolio «${portfolio.name}» hat ${weakPositions.length} Position${weakPositions.length !== 1 ? "en" : ""} mit Score < 50:\n\n• ${weakList}\n\nBitte prüfen Sie den Optimierungs-Tab für Empfehlungen.`,
    });

    // Update lastRunAt
    await db
      .update(optimizationSubscriptions)
      .set({ lastRunAt: new Date() })
      .where(eq(optimizationSubscriptions.id, sub.id));

    return res.json({ ok: true, weakPositions: weakPositions.length, notified: true });
  } catch (err: any) {
    console.error("[handleOptimizationAlert] Error:", err);
    return res.status(500).json({ error: err.message, stack: err.stack, timestamp: new Date().toISOString() });
  }
}
