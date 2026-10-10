import type { Request, Response } from "express";
import { runMonthlyCorporateActionAudit, CORPORATE_ACTION_AUDIT_HANDLER_KEY } from "../jobs/corporateActionAudit";
import { acquireScheduledTask, finishScheduledTask } from "../lib/scheduledTaskGuard";

/**
 * Cron-only entry point. The project-level Heartbeat task is bound by its task UID
 * in `scheduled_task_bindings`; body content is deliberately ignored.
 */
export async function handleCorporateActionAudit(req: Request, res: Response) {
  const acquired = await acquireScheduledTask(req, res, CORPORATE_ACTION_AUDIT_HANDLER_KEY);
  if (!acquired.acquired) return;

  try {
    const result = await runMonthlyCorporateActionAudit();
    if (result.status === "failed") {
      const error = result.reason ?? "Corporate-Action-Audit fehlgeschlagen";
      await finishScheduledTask(acquired.taskUid, CORPORATE_ACTION_AUDIT_HANDLER_KEY, error);
      return res.status(500).json({ ok: false, ...result });
    }
    await finishScheduledTask(acquired.taskUid, CORPORATE_ACTION_AUDIT_HANDLER_KEY);
    return res.json({ ok: true, ...result });
  } catch (error) {
    await finishScheduledTask(acquired.taskUid, CORPORATE_ACTION_AUDIT_HANDLER_KEY, error);
    const message = error instanceof Error ? error.message : String(error);
    console.error("[CorporateActionAudit] Handler-Fehler:", message);
    return res.status(500).json({
      ok: false,
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
      context: { url: req.url, taskUid: acquired.taskUid },
      timestamp: new Date().toISOString(),
    });
  }
}
