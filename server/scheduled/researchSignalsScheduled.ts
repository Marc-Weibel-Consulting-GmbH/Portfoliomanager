/**
 * Research Signals Scheduled Handler
 *
 * Triggered daily via Heartbeat cron (05:30 UTC = 07:30 CET).
 * Fetches fresh research signals from n8n and upserts them into research_signals.
 * No-op when N8N_SIGNALS_URL is not set.
 */
import type { Request, Response } from "express";
import { acquireScheduledTask, finishScheduledTask } from "../lib/scheduledTaskGuard";

export async function handleResearchSignalsRefresh(req: Request, res: Response) {
  const acquired = await acquireScheduledTask(req, res, "researchSignalsRefresh");
  if (!acquired.acquired) return;
  let failure: unknown;
  try {
    const { refreshResearchSignals } = await import("../_core/researchSignals");
    const upserted = await refreshResearchSignals({ force: true });
    console.log(`[researchSignalsScheduled] ${upserted} Signale aktualisiert`);
    return res.json({ ok: true, upserted });
  } catch (e) {
    failure = e;
    if (e instanceof Error && /auth|session|credential/i.test(e.message)) {
      return res.status(403).json({ error: "cron-only" });
    }
    const msg = (e as Error).message ?? String(e);
    console.error("[researchSignalsScheduled] Fehler:", msg);
    return res.status(500).json({ error: msg, timestamp: new Date().toISOString() });
  } finally {
    await finishScheduledTask(acquired.taskUid, "researchSignalsRefresh", failure);
  }
}
