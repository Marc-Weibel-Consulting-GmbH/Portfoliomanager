/**
 * Score Snapshot Scheduled Handler
 *
 * Triggered daily via Heartbeat cron.
 * Reads all tickers from stock_signal_cache and saves a daily snapshot
 * of qualityScore, momentumScore, combinedScore, signalType into stock_score_snapshot.
 * Skips tickers that already have a snapshot for today.
 */
import type { Request, Response } from "express";

export async function handleScoreSnapshot(req: Request, res: Response) {
  try {
    const { getDb } = await import("../db");
    const { stockSignalCache, stockScoreSnapshot } = await import("../../drizzle/schema");
    const { and, eq, sql } = await import("drizzle-orm");

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Get all cached signals
    const signals = await db.select().from(stockSignalCache);
    if (signals.length === 0) {
      return res.json({ ok: true, saved: 0, skipped: 0, message: "No signals in cache" });
    }

    // Get tickers that already have a snapshot for today
    const existingToday = await db
      .select({ ticker: stockScoreSnapshot.ticker })
      .from(stockScoreSnapshot)
      .where(eq(stockScoreSnapshot.snapshotDate, today));
    const existingSet = new Set(existingToday.map((r) => r.ticker));

    const startTime = Date.now();
    const TIME_LIMIT_MS = 100_000; // 100s — Heartbeat-Limit ist 120s
    let saved = 0;
    let skipped = 0;
    let timedOut = false;

    for (const signal of signals) {
      // Time-guard: stop before Heartbeat timeout
      if (Date.now() - startTime > TIME_LIMIT_MS) {
        timedOut = true;
        console.warn(`[scoreSnapshotCron] Time limit reached after ${saved} saves. Remaining will be picked up next run.`);
        break;
      }
      if (existingSet.has(signal.ticker)) {
        skipped++;
        continue;
      }
      const combinedNum = signal.combinedScore ? parseInt(signal.combinedScore, 10) : null;
      await db.insert(stockScoreSnapshot).values({
        ticker: signal.ticker,
        snapshotDate: today,
        qualityScore: signal.qualityScore ?? null,
        momentumScore: signal.momentumScore ?? null,
        combinedScore: isNaN(combinedNum as number) ? null : combinedNum,
        signalType: signal.signalType ?? "hold",
        signalStrength: signal.signalStrength ?? "weak",
        overallGrade: signal.overallGrade ?? null,
        currentPrice: signal.currentPrice ?? null,
      });
      saved++;
    }

    console.log(`[scoreSnapshotCron] Saved ${saved} snapshots, skipped ${skipped} (already exist) for ${today}${timedOut ? ' [partial — time limit reached]' : ''}`);
    return res.json({ ok: true, saved, skipped, date: today, timedOut });
  } catch (err: any) {
    console.error("[scoreSnapshotCron] Error:", err);
    return res.status(500).json({ error: err?.message ?? "Unknown error", stack: err?.stack });
  }
}
