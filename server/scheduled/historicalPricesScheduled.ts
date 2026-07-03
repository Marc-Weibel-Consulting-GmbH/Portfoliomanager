/**
 * Historical Prices Scheduled Handler
 * ====================================
 * Heartbeat-triggered endpoint that fetches the latest historical prices
 * from EODHD API for all tickers in user portfolios.
 * 
 * Runs daily at 02:00 UTC (after US market close).
 */
import { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { importHistoricalPrices, HISTORICAL_PRICES_JOB_NAME, HISTORICAL_PRICES_MIN_INTERVAL_MINUTES } from "../jobs/importHistoricalPrices";
import { runIfNotRecent } from "../lib/jobLock";

export async function handleHistoricalPricesUpdate(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!(user as any).isCron || !(user as any).taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    console.log("[Scheduled] Historical prices update started");

    // Fetch last 7 days to fill any gaps
    const now = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const fromDate = weekAgo.toISOString().split("T")[0];
    const toDate = now.toISOString().split("T")[0];

    console.log(`[Scheduled] Fetching prices from ${fromDate} to ${toDate}`);

    // D-03: shared job lock with cron/historicalPricesCron.ts — skip when the
    // in-process cron (or a previous Heartbeat call) ran within the window.
    const run = await runIfNotRecent(HISTORICAL_PRICES_JOB_NAME, HISTORICAL_PRICES_MIN_INTERVAL_MINUTES, () =>
      importHistoricalPrices(fromDate, toDate, false)
    );
    if (!run.ran) {
      console.log(`[Scheduled] Historical prices update skipped (${run.reason})`);
      return res.json({ ok: true, skipped: true, reason: run.reason });
    }
    const result = run.result!;

    if (result.success) {
      console.log(
        `[Scheduled] Historical prices update completed: ${result.tickersProcessed} tickers, ${result.pricesImported} prices imported`
      );
      return res.json({
        ok: true,
        tickersProcessed: result.tickersProcessed,
        pricesImported: result.pricesImported,
        errors: result.errors.length,
        errorDetails: result.errors.slice(0, 10), // Limit error details
      });
    } else {
      console.error("[Scheduled] Historical prices update failed:", result.errors);
      return res.status(500).json({
        error: "Import failed",
        details: result.errors.slice(0, 10),
      });
    }
  } catch (error) {
    console.error("[Scheduled] Historical prices update error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context: { url: req.url, taskUid: (req as any).taskUid },
      timestamp: new Date().toISOString(),
    });
  }
}
