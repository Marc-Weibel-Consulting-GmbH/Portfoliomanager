import type { Request, Response } from "express";
import { and, eq, lte, or, isNull } from "drizzle-orm";
import { scheduledTaskBindings } from "../../drizzle/schema";
import { getDb } from "../db";
import { sdk } from "../_core/sdk";

export async function acquireScheduledTask(
  req: Request,
  res: Response,
  handlerKey: string,
): Promise<{ acquired: true; taskUid: string } | { acquired: false }> {
  let user: any;
  try {
    user = await sdk.authenticateRequest(req);
  } catch {
    res.status(403).json({ error: "cron-only" });
    return { acquired: false };
  }
  if (!user?.isCron || !user.taskUid) {
    res.status(403).json({ error: "cron-only" });
    return { acquired: false };
  }

  const db = await getDb();
  if (!db) {
    res.status(500).json({ error: "Database not available" });
    return { acquired: false };
  }
  const binding = (await db.select().from(scheduledTaskBindings).where(and(
    eq(scheduledTaskBindings.handlerKey, handlerKey),
    eq(scheduledTaskBindings.scheduleCronTaskUid, user.taskUid),
    eq(scheduledTaskBindings.isActive, 1),
  )).limit(1))[0];
  if (!binding) {
    res.json({ ok: true, skipped: "orphan" });
    return { acquired: false };
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - binding.minIntervalMinutes * 60_000);
  const updated = await db.update(scheduledTaskBindings).set({ lastStartedAt: now, lastStatus: "running", lastError: null })
    .where(and(
      eq(scheduledTaskBindings.id, binding.id),
      or(isNull(scheduledTaskBindings.lastStartedAt), lte(scheduledTaskBindings.lastStartedAt, cutoff)),
    ));
  const result: any = Array.isArray(updated) ? updated[0] : updated;
  if (Number(result?.affectedRows ?? 0) !== 1) {
    res.json({ ok: true, skipped: "recent" });
    return { acquired: false };
  }
  return { acquired: true, taskUid: user.taskUid };
}

export async function finishScheduledTask(taskUid: string, handlerKey: string, error?: unknown): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const isFailure = error !== undefined;
  await db.update(scheduledTaskBindings).set({
    lastCompletedAt: new Date(),
    lastStatus: isFailure ? "failed" : "completed",
    lastError: isFailure ? String(error).slice(0, 2000) : null,
  }).where(and(
    eq(scheduledTaskBindings.handlerKey, handlerKey),
    eq(scheduledTaskBindings.scheduleCronTaskUid, taskUid),
  ));
}
