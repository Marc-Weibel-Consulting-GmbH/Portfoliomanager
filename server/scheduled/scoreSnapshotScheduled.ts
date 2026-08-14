/**
 * Score Snapshot Scheduled Handler
 *
 * Triggered daily via Heartbeat cron.
 * Reads all tickers from stock_signal_cache and saves a daily snapshot
 * of qualityScore, momentumScore, combinedScore, signalType into stock_score_snapshot.
 * Seit dem Drei-Score-Konzept zusätzlich: qualitaet, bewertung, timing aus
 * `stock_scores` — damit der Score-Verlauf die Scores zeigt, die auch auf der
 * Titelseite stehen, nicht nur den alten Einzelscore.
 * Skips tickers that already have a snapshot for today.
 */
import type { Request, Response } from "express";

// Die drei Score-Spalten kamen nachträglich dazu; der Deploy führt
// `drizzle-kit migrate` nicht aus, deshalb selbstheilend (Muster wie
// dreiScoresStore.stelleTabelleSicher).
let spaltenGeprueft = false;
export async function stelleSnapshotSpaltenSicher(db: any): Promise<void> {
  if (spaltenGeprueft) return;
  const { sql } = await import("drizzle-orm");
  for (const name of ["qualitaet", "bewertung", "timing"]) {
    const res: any = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'stock_score_snapshot'
        AND COLUMN_NAME = ${name}`);
    const liste = Array.isArray(res) ? (res[0] ?? res) : (res?.rows ?? []);
    if (Number((liste as any[])[0]?.cnt ?? 0) === 0) {
      await db.execute(sql.raw(`ALTER TABLE \`stock_score_snapshot\` ADD \`${name}\` int`));
    }
  }
  spaltenGeprueft = true;
}

export async function handleScoreSnapshot(req: Request, res: Response) {
  try {
    const { getDb } = await import("../db");
    const { stockSignalCache, stockScoreSnapshot } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    await stelleSnapshotSpaltenSicher(db);

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Get all cached signals
    const signals = await db.select().from(stockSignalCache);
    if (signals.length === 0) {
      return res.json({ ok: true, saved: 0, skipped: 0, message: "No signals in cache" });
    }

    // Die drei Scores aus der Ablage des Signal-Crons (eine Bulk-Abfrage).
    const { leseScores } = await import("../lib/dreiScoresStore");
    const dreiMap = await leseScores(signals.map((s) => s.ticker));

    // Get tickers that already have a snapshot for today
    const existingToday = await db
      .select({ ticker: stockScoreSnapshot.ticker })
      .from(stockScoreSnapshot)
      .where(eq(stockScoreSnapshot.snapshotDate, today));
    const existingSet = new Set(existingToday.map((r) => r.ticker));

    const startTime = Date.now();
    const TIME_LIMIT_MS = 100_000; // 100s — Heartbeat-Limit ist 120s
    let saved = 0;
    let skipped = 0;
    let timedOut = false;

    for (const signal of signals) {
      // Time-guard: stop before Heartbeat timeout
      if (Date.now() - startTime > TIME_LIMIT_MS) {
        timedOut = true;
        console.warn(`[scoreSnapshotCron] Time limit reached after ${saved} saves. Remaining will be picked up next run.`);
        break;
      }
      if (existingSet.has(signal.ticker)) {
        skipped++;
        continue;
      }
      const combinedNum = signal.combinedScore ? parseInt(signal.combinedScore, 10) : null;
      const drei = dreiMap.get(signal.ticker);
      const rund = (v: number | null | undefined) => (v == null ? null : Math.round(v));
      await db.insert(stockScoreSnapshot).values({
        ticker: signal.ticker,
        snapshotDate: today,
        qualityScore: signal.qualityScore ?? null,
        momentumScore: signal.momentumScore ?? null,
        combinedScore: isNaN(combinedNum as number) ? null : combinedNum,
        signalType: signal.signalType ?? "hold",
        signalStrength: signal.signalStrength ?? "weak",
        overallGrade: signal.overallGrade ?? null,
        currentPrice: signal.currentPrice ?? null,
        qualitaet: rund(drei?.qualitaet),
        bewertung: rund(drei?.bewertung),
        timing: rund(drei?.timing),
      });
      saved++;
    }

    console.log(`[scoreSnapshotCron] Saved ${saved} snapshots, skipped ${skipped} (already exist) for ${today}${timedOut ? ' [partial — time limit reached]' : ''}`);

    // Sektor-Rotation (RRG) täglich fortschreiben — die Vorwärtsreihe soll
    // nicht davon abhängen, ob jemand den Markt-Hub öffnet. Non-fatal.
    try {
      const { rrgStand } = await import("../lib/rrgDienst");
      await rrgStand(); // rechnet, cached und zeichnet die Tageszeilen auf
    } catch (e) {
      console.warn("[scoreSnapshotCron] RRG-Aufzeichnung fehlgeschlagen:", (e as Error).message);
    }

    return res.json({ ok: true, saved, skipped, date: today, timedOut });
  } catch (err: any) {
    console.error("[scoreSnapshotCron] Error:", err);
    return res.status(500).json({ error: err?.message ?? "Unknown error", stack: err?.stack });
  }
}
