/**
 * Daily YTD / 52-week market-metric refresh.
 *
 * Route: POST /api/scheduled/ytdRecalc
 *
 * The name remains stable for the existing scheduler. The implementation now
 * recalculates all point metrics from a single split-adjusted price-return
 * series and therefore cannot combine a post-split quote with a pre-split
 * Dec-31 baseline or 52-week range.
 */
import type { Request, Response } from "express";
import { refreshSplitAdjustedMarketMetrics } from "../lib/refreshSplitAdjustedMarketMetrics";

export async function handleYtdRecalc(req: Request, res: Response) {
  const startTime = Date.now();
  try {
    const result = await refreshSplitAdjustedMarketMetrics({
      // Leave headroom for the scheduler's request timeout while making every
      // changed row auditable. A later heartbeat finishes any remaining rows.
      timeLimitMs: 100_000,
    });
    const elapsedSeconds = Number(((Date.now() - startTime) / 1000).toFixed(1));
    console.log(
      `[ytdRecalc] Splitbasis-Refresh: updated=${result.updated}, ` +
      `blocked=${result.blocked}, skipped=${result.skipped}, ${elapsedSeconds}s`,
    );
    return res.json({
      ok: true,
      updated: result.updated,
      blocked: result.blocked,
      skipped: result.skipped,
      elapsedSeconds,
    });
  } catch (err: any) {
    console.error("[ytdRecalc] Fatal error:", err);
    return res.status(500).json({ ok: false, error: err?.message ?? "Unknown error" });
  }
}
