import { eq } from "drizzle-orm";
import { corporateActionAuditRuns } from "../../drizzle/schema";
import { getDb } from "../db";
import { runActiveUniverseSplitMetricInventory } from "../scripts/auditActiveUniverseSplitMetrics";

export const CORPORATE_ACTION_AUDIT_HANDLER_KEY = "corporateActionAudit";
export const CORPORATE_ACTION_AUDIT_MIN_INTERVAL_MINUTES = 60 * 24 * 27;

export type CorporateActionAuditRunResult = {
  runId?: number;
  monthKey: string;
  asOfDate: string;
  status: "completed" | "skipped" | "failed";
  reason?: string;
  activeInstrumentCount: number;
  verifiedActionCount: number;
  candidateCount: number;
  missingSnapshotCount: number;
  ytdBasisMismatchCount: number;
  rangeBasisMismatchCount: number;
};

export function utcMonthKey(now: Date): string {
  return now.toISOString().slice(0, 7);
}

export function utcDateKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Runs the complete split/corporate-action inventory without changing market
 * masters, price rows, portfolios, cash, ledgers, transactions or orders.
 * The unique month key makes repeated Heartbeat deliveries harmless.
 */
export async function runMonthlyCorporateActionAudit(now = new Date()): Promise<CorporateActionAuditRunResult> {
  const db = await getDb();
  const monthKey = utcMonthKey(now);
  const asOfDate = utcDateKey(now);
  if (!db) {
    return {
      monthKey, asOfDate, status: "failed", reason: "Datenbank nicht verfügbar",
      activeInstrumentCount: 0, verifiedActionCount: 0, candidateCount: 0,
      missingSnapshotCount: 0, ytdBasisMismatchCount: 0, rangeBasisMismatchCount: 0,
    };
  }

  const existing = await db.select({ id: corporateActionAuditRuns.id, status: corporateActionAuditRuns.status })
    .from(corporateActionAuditRuns)
    .where(eq(corporateActionAuditRuns.monthKey, monthKey))
    .limit(1);
  if (existing[0]?.status === "completed") {
    return {
      runId: existing[0].id,
      monthKey,
      asOfDate,
      status: "skipped",
      reason: `Monat ${monthKey} bereits mit Status ${existing[0].status} protokolliert`,
      activeInstrumentCount: 0, verifiedActionCount: 0, candidateCount: 0,
      missingSnapshotCount: 0, ytdBasisMismatchCount: 0, rangeBasisMismatchCount: 0,
    };
  }
  if (existing[0]?.status === "running") {
    return {
      runId: existing[0].id,
      monthKey,
      asOfDate,
      status: "skipped",
      reason: `Monat ${monthKey} wird bereits geprüft`,
      activeInstrumentCount: 0, verifiedActionCount: 0, candidateCount: 0,
      missingSnapshotCount: 0, ytdBasisMismatchCount: 0, rangeBasisMismatchCount: 0,
    };
  }

  let runId: number | undefined = existing[0]?.id;
  if (runId) {
    await db.update(corporateActionAuditRuns).set({
      status: "running",
      asOfDate,
      error: null,
      startedAt: new Date(),
      completedAt: null,
    }).where(eq(corporateActionAuditRuns.id, runId));
  } else {
    try {
      const created = await db.insert(corporateActionAuditRuns).values({ monthKey, asOfDate });
      runId = Number(created[0].insertId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("duplicate")) {
        return {
          monthKey,
          asOfDate,
          status: "skipped",
          reason: `Paralleler Monatslauf ${monthKey} erkannt`,
          activeInstrumentCount: 0, verifiedActionCount: 0, candidateCount: 0,
          missingSnapshotCount: 0, ytdBasisMismatchCount: 0, rangeBasisMismatchCount: 0,
        };
      }
      throw error;
    }
  }

  try {
    const audit = await runActiveUniverseSplitMetricInventory({ asOfDate });
    const summary = audit.summary;
    const result: CorporateActionAuditRunResult = {
      runId,
      monthKey,
      asOfDate,
      status: "completed",
      activeInstrumentCount: summary.scope.activeStockRows,
      verifiedActionCount: summary.activeWithVerifiedSplitEvent,
      candidateCount: summary.activeCandidateCount,
      missingSnapshotCount: summary.activeMissingSplitSnapshot,
      ytdBasisMismatchCount: summary.activeYtdBasisMismatch,
      rangeBasisMismatchCount: summary.activeRangeBasisMismatch,
    };
    await db.update(corporateActionAuditRuns).set({
      status: "completed",
      activeInstrumentCount: result.activeInstrumentCount,
      verifiedActionCount: result.verifiedActionCount,
      candidateCount: result.candidateCount,
      missingSnapshotCount: result.missingSnapshotCount,
      ytdBasisMismatchCount: result.ytdBasisMismatchCount,
      rangeBasisMismatchCount: result.rangeBasisMismatchCount,
      summary: audit.summary,
      completedAt: new Date(),
    }).where(eq(corporateActionAuditRuns.id, runId));
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.update(corporateActionAuditRuns).set({ status: "failed", error: message, completedAt: new Date() })
      .where(eq(corporateActionAuditRuns.id, runId));
    return {
      runId,
      monthKey,
      asOfDate,
      status: "failed",
      reason: message,
      activeInstrumentCount: 0,
      verifiedActionCount: 0,
      candidateCount: 0,
      missingSnapshotCount: 0,
      ytdBasisMismatchCount: 0,
      rangeBasisMismatchCount: 0,
    };
  }
}
