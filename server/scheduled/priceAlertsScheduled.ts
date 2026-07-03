/**
 * Price Alerts Scheduled Handler
 * ==============================
 * Heartbeat-triggered endpoint that checks all active price alerts
 * against current stock prices and sends notifications (email/WhatsApp).
 *
 * Runs every 5 minutes during market hours (Mon-Fri, 08:00-22:00 UTC).
 *
 * D-03: the alert-check body is shared with cron/priceAlertsCron.ts
 * (see lib/priceAlertsCheck.ts). Both entry points are guarded by the same
 * job lock, so runs closer than PRICE_ALERTS_MIN_INTERVAL_MINUTES apart are
 * skipped (returns { ok: true, skipped: true }).
 */
import { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { runIfNotRecent } from "../lib/jobLock";
import { runPriceAlertsCheck, PRICE_ALERTS_JOB_NAME, PRICE_ALERTS_MIN_INTERVAL_MINUTES } from "../lib/priceAlertsCheck";

export async function handlePriceAlertsCheck(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!(user as any).isCron || !(user as any).taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    console.log("[Scheduled] Price alerts check started");

    const run = await runIfNotRecent(PRICE_ALERTS_JOB_NAME, PRICE_ALERTS_MIN_INTERVAL_MINUTES, runPriceAlertsCheck);
    if (!run.ran) {
      return res.json({ ok: true, skipped: true, reason: run.reason });
    }
    const { triggered, total, messages } = run.result!;

    console.log(`[Scheduled] Price alerts check complete: ${triggered}/${total} triggered`);

    // Notify owner if any alerts triggered
    if (triggered > 0) {
      try {
        const { notifyOwner } = await import("../_core/notification");
        await notifyOwner({
          title: `🔔 ${triggered} Preis-Alert${triggered > 1 ? 's' : ''} ausgelöst`,
          content: messages.join('\n'),
        });
      } catch (e) {
        console.error("[PriceAlerts] Owner notification failed:", e);
      }
    }

    return res.json({ ok: true, triggered, total });
  } catch (error: any) {
    console.error("[Scheduled] Price alerts check failed:", error);
    return res.status(500).json({
      error: error.message,
      stack: error.stack,
      context: { url: req.url, taskUid: (req as any).taskUid },
      timestamp: new Date().toISOString(),
    });
  }
}
