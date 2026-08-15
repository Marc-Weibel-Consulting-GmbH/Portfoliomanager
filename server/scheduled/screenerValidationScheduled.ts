import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import { screenerValidationConfig } from "../../drizzle/schema";
import {
  runWeeklyScreenerValidation,
  SCREENER_VALIDATION_JOB_NAME,
  SCREENER_VALIDATION_MIN_INTERVAL_MINUTES,
} from "../jobs/screenerValidation";
import { runIfNotRecent } from "../lib/jobLock";

export async function handleScreenerValidation(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    const cronUser = user as { isCron?: boolean; taskUid?: string };
    if (!cronUser.isCron || !cronUser.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Datenbank nicht verfügbar" });
    const config = (await db.select().from(screenerValidationConfig)
      .where(eq(screenerValidationConfig.scheduleCronTaskUid, cronUser.taskUid)).limit(1))[0];
    if (!config || !config.isActive) {
      return res.json({ ok: true, skipped: "orphan-or-inactive" });
    }

    const run = await runIfNotRecent(
      SCREENER_VALIDATION_JOB_NAME,
      SCREENER_VALIDATION_MIN_INTERVAL_MINUTES,
      () => runWeeklyScreenerValidation()
    );
    if (!run.ran) return res.json({ ok: true, skipped: true, reason: run.reason });

    const result = run.result!;
    await db.update(screenerValidationConfig).set({
      lastRunAt: new Date(),
      lastRunStatus: result.status,
    }).where(eq(screenerValidationConfig.id, config.id));
    return res.status(result.status === "failed" ? 500 : 200).json({ ok: result.status !== "failed", ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Scheduled] Screener validation failed:", message);
    return res.status(500).json({ ok: false, error: message, timestamp: new Date().toISOString() });
  }
}
