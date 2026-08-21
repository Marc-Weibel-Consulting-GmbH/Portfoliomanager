import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { researchDeskEvidence, researchDeskRuns } from "../../drizzle/schema";
import {
  collectSecPilotEvidence,
  SEC_PILOT_UNIVERSE_VERSION,
  SEC_SUBMISSIONS_SOURCE_VERSION,
} from "./researchDeskCollector";
import { buildResearchDeskRunKey } from "./researchDeskShadow";

export interface ResearchDeskShadowRunResult {
  runId: number;
  status: "completed" | "already_completed";
  tickersRequested: number;
  tickersFetched: number;
  evidenceObserved: number;
  evidenceIncomplete: number;
  errors: Array<{ ticker: string; code: string; message: string }>;
}

function asUtcDate(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

/**
 * Persistiert eine begrenzte, rein beobachtende SEC-Erfassung. Ein Run-Key
 * macht Tagesläufe pro Daten-/Universumsversion idempotent. Wiederholungen
 * lesen den fertiggestellten Lauf, anstatt Evidenz erneut zu erzeugen.
 */
export async function runResearchDeskShadow(input: {
  asOf?: Date;
  lookbackDays?: number;
} = {}): Promise<ResearchDeskShadowRunResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const asOf = input.asOf ?? new Date();
  const runKey = buildResearchDeskRunKey({
    runDate: asOf,
    universeVersion: SEC_PILOT_UNIVERSE_VERSION,
    sourceVersion: SEC_SUBMISSIONS_SOURCE_VERSION,
  });
  const existing = (await db.select().from(researchDeskRuns)
    .where(eq(researchDeskRuns.runKey, runKey)).limit(1))[0];
  if (existing?.status === "completed") {
    return {
      runId: existing.id,
      status: "already_completed",
      tickersRequested: existing.tickersRequested,
      tickersFetched: existing.tickersFetched,
      evidenceObserved: existing.evidenceObserved,
      evidenceIncomplete: existing.evidenceIncomplete,
      errors: Array.isArray(existing.errors) ? existing.errors as ResearchDeskShadowRunResult["errors"] : [],
    };
  }

  if (!existing) {
    await db.insert(researchDeskRuns).values({
      runKey,
      runDate: asUtcDate(asOf),
      universeVersion: SEC_PILOT_UNIVERSE_VERSION,
      sourceVersion: SEC_SUBMISSIONS_SOURCE_VERSION,
      isShadowMode: 1,
      status: "running",
    });
  }
  const run = (await db.select().from(researchDeskRuns)
    .where(eq(researchDeskRuns.runKey, runKey)).limit(1))[0];
  if (!run) throw new Error("Research Desk run could not be created");

  const collection = await collectSecPilotEvidence({ asOf, lookbackDays: input.lookbackDays });
  for (const evidence of collection.evidence) {
    await db.insert(researchDeskEvidence).values({
      evidenceKey: evidence.evidenceKey,
      runId: run.id,
      ticker: evidence.ticker,
      cik: evidence.cik,
      eventType: evidence.eventType,
      formType: evidence.formType,
      sourceUrl: evidence.sourceUrl,
      sourcePublishedAt: evidence.sourcePublishedAt,
      fetchedAt: evidence.fetchedAt,
      sourceVersion: evidence.sourceVersion,
      rawHash: evidence.rawHash,
      rawPayload: evidence.rawPayload,
      isShadowMode: 1,
      decisionImpact: "none",
      completenessStatus: evidence.completenessStatus,
      checkerStatus: evidence.checkerStatus,
      validationReasons: evidence.validationReasons,
    }).onDuplicateKeyUpdate({
      set: {
        fetchedAt: evidence.fetchedAt,
        rawHash: evidence.rawHash,
        rawPayload: evidence.rawPayload,
        completenessStatus: evidence.completenessStatus,
        checkerStatus: evidence.checkerStatus,
        validationReasons: evidence.validationReasons,
      },
    });
  }

  await db.update(researchDeskRuns).set({
    status: "completed",
    tickersRequested: collection.tickersRequested,
    tickersFetched: collection.tickersFetched,
    evidenceObserved: collection.evidenceObserved,
    evidenceIncomplete: collection.evidenceIncomplete,
    errors: collection.errors,
    completedAt: new Date(),
  }).where(eq(researchDeskRuns.id, run.id));

  return { runId: run.id, status: "completed", ...collection };
}
