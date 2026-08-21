import type { Request, Response } from "express";
import { acquireScheduledTask, finishScheduledTask } from "../lib/scheduledTaskGuard";
import { runResearchDeskShadow } from "../lib/researchDeskService";

/**
 * Tageshandler des Research Desk Lite. Der Task-Guard bindet den Aufruf an die
 * registrierte Heartbeat-UID; der Service persistiert ausschliesslich Shadow-
 * Evidenz. Weder Scores noch Empfehlungen oder Transaktionen werden berührt.
 */
export async function handleResearchDeskShadow(req: Request, res: Response) {
  const acquired = await acquireScheduledTask(req, res, "researchDeskShadow");
  if (!acquired.acquired) return;
  let failure: unknown;
  try {
    const result = await runResearchDeskShadow();
    return res.json({ ok: true, ...result });
  } catch (error) {
    failure = error;
    const message = error instanceof Error ? error.message : String(error);
    console.error("[researchDeskShadow] Fehler:", message);
    return res.status(500).json({
      error: message,
      context: { url: req.url, taskUid: acquired.taskUid },
      timestamp: new Date().toISOString(),
    });
  } finally {
    await finishScheduledTask(acquired.taskUid, "researchDeskShadow", failure);
  }
}
