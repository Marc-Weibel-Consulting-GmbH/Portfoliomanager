/**
 * Research Observatory — Fetch-&-Cache-Service
 * ============================================
 * Holt Research-Signale von einer externen n8n-Instanz und cached sie in
 * `research_signals`. Analog zum stockBriefingCache (siehe stocksRouter):
 * ~24h-Cache, Upsert nach `signalId`, fire-and-forget bei Fehlern.
 *
 * Compliance: reine Research-FILTERUNG, KEINE Anlageberatung.
 */

import { z } from "zod";
import { desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import { researchSignals, type ResearchSignal } from "../../drizzle/schema";
import { ENV } from "./env";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 Stunden

// Validierung der n8n-Antwort. Fehlende/leere Felder werden tolerant behandelt,
// damit ein einzelner unvollständiger Eintrag nicht den ganzen Fetch kippt.
const N8nSignal = z.object({
  signal_id: z.string().min(1),
  title: z.string().default(""),
  url: z.string().nullish(),
  source_name: z.string().nullish(),
  source_category: z.string().nullish(),
  relevance_score: z.coerce.number().int().nullish(),
  topics: z.array(z.string()).nullish(),
  content_type: z.string().nullish(),
  evidence_type: z.string().nullish(),
  follow_up_required: z.coerce.boolean().nullish(),
  published_at: z.string().nullish(),
  classified_at: z.string().nullish(),
});
const N8nResponse = z.object({
  generated_at: z.string().nullish(),
  count: z.number().nullish(),
  signals: z.array(N8nSignal).default([]),
});

/** ISO-String → Date, fehlertolerant (ungültige/leere Werte → null). */
function toDate(iso: unknown): Date | null {
  if (typeof iso !== "string" || !iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Alter des jüngsten Cache-Eintrags in ms, oder Infinity wenn leer. */
async function cacheAgeMs(db: NonNullable<Awaited<ReturnType<typeof getDb>>>): Promise<number> {
  const rows = await db
    .select({ fetchedAt: sql<Date>`max(${researchSignals.fetchedAt})` })
    .from(researchSignals);
  const newest = rows[0]?.fetchedAt ? new Date(rows[0].fetchedAt).getTime() : null;
  return newest == null ? Infinity : Date.now() - newest;
}

/**
 * Fetcht die n8n-URL und upsertet alle Signale nach `signalId`. Respektiert den
 * 24h-Cache: ohne `force` wird nur gefetcht, wenn der Cache älter als 24h ist.
 * Gibt die Anzahl upserteter Signale zurück (0 = übersprungen / kein Fetch).
 */
export async function refreshResearchSignals(opts: { force?: boolean } = {}): Promise<number> {
  const db = await getDb();
  if (!db) {
    console.warn("[researchSignals] DB nicht verfügbar — Refresh übersprungen");
    return 0;
  }
  const url = ENV.n8nSignalsUrl;
  if (!url) {
    console.warn("[researchSignals] N8N_SIGNALS_URL nicht gesetzt — Refresh übersprungen");
    return 0;
  }

  if (!opts.force) {
    const age = await cacheAgeMs(db);
    if (age < CACHE_TTL_MS) {
      console.log(`[researchSignals] Cache frisch (${Math.floor(age / 3_600_000)}h) — kein Fetch`);
      return 0;
    }
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`n8n-Fetch fehlgeschlagen: HTTP ${res.status}`);
  const parsed = N8nResponse.parse(await res.json());

  const now = new Date();
  let upserted = 0;
  for (const s of parsed.signals) {
    const { signalId, ...updatable } = {
      signalId: s.signal_id,
      title: s.title || s.signal_id,
      url: s.url ?? null,
      sourceName: s.source_name ?? null,
      sourceCategory: s.source_category ?? null,
      contentType: s.content_type ?? null,
      evidenceType: s.evidence_type ?? null,
      relevanceScore: s.relevance_score ?? null,
      topics: s.topics ?? [],
      followUpRequired: s.follow_up_required ? 1 : 0,
      publishedAt: toDate(s.published_at),
      classifiedAt: toDate(s.classified_at),
      fetchedAt: now,
    };
    await db
      .insert(researchSignals)
      .values({ signalId, ...updatable })
      .onDuplicateKeyUpdate({ set: updatable });
    upserted++;
  }
  console.log(`[researchSignals] ${upserted} Signale upserted (von ${parsed.signals.length})`);
  return upserted;
}

/**
 * Liefert die gecachten Signale sortiert (relevanceScore desc, dann classifiedAt
 * desc). Löst vorab einen on-demand-Refresh aus (24h-Cache), best-effort — ein
 * fehlgeschlagener Fetch liefert weiterhin den vorhandenen Cache.
 */
export async function getResearchSignals(): Promise<ResearchSignal[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    await refreshResearchSignals();
  } catch (e: any) {
    console.warn(`[researchSignals] Refresh fehlgeschlagen (liefere Cache): ${e?.message}`);
  }

  return db
    .select()
    .from(researchSignals)
    .orderBy(desc(researchSignals.relevanceScore), desc(researchSignals.classifiedAt));
}
