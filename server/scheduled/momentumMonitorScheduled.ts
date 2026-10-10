import type { Request, Response } from "express";
import { MOMENTUM_MONITOR_HANDLER_KEY, runDailyMomentumMonitor } from "../jobs/momentumMonitor";
import { acquireScheduledTask, finishScheduledTask } from "../lib/scheduledTaskGuard";

/** Cron-only endpoint; all request-body fields are deliberately ignored. */
export async function handleMomentumMonitor(req: Request, res: Response) {
  const acquired = await acquireScheduledTask(req, res, MOMENTUM_MONITOR_HANDLER_KEY);
  if (!acquired.acquired) return;

  try {
    const result = await runDailyMomentumMonitor();
    if (result.status === "failed") {
      const error = result.reason ?? "Momentum-Monitor fehlgeschlagen";
      await finishScheduledTask(acquired.taskUid, MOMENTUM_MONITOR_HANDLER_KEY, error);
      return res.status(500).json({ ok: false, ...result });
    }
    await finishScheduledTask(acquired.taskUid, MOMENTUM_MONITOR_HANDLER_KEY);
    return res.json({ ok: true, ...result });
  } catch (error) {
    await finishScheduledTask(acquired.taskUid, MOMENTUM_MONITOR_HANDLER_KEY, error);
    const message = error instanceof Error ? error.message : String(error);
    console.error("[MomentumMonitor] Handler-Fehler:", message);
    return res.status(500).json({
      ok: false,
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
      context: { url: req.url, taskUid: acquired.taskUid },
      timestamp: new Date().toISOString(),
    });
  }
}
