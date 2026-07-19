/**
 * Outcome-Tracking für den nutzersichtbaren Combined Score (Stack A) — KIMI-Audit ④.
 *
 * `stock_signal_cache` hält nur den aktuellen Zustand; ohne Historie lässt sich
 * nicht messen, ob der Score, den Kunden sehen, tatsächlich Alpha liefert. Dieses
 * Modul snapshotet den combinedScore täglich in `combined_score_history` und misst
 * nach `horizonDays` den realisierten Return vs. SMI (Alpha) + directionCorrect —
 * analog zur bewährten Stack-B-Mechanik (signalEvaluationCron).
 *
 * Self-healing: `CREATE TABLE IF NOT EXISTS` läuft einmal pro Prozess, damit der
 * manus-Deploy (der `drizzle-kit migrate` nicht ausführt) nicht blockiert.
 */

const HORIZON_DAYS = 30;
let tableEnsured = false;

async function ensureTable(db: any): Promise<void> {
  if (tableEnsured) return;
  const { sql } = await import("drizzle-orm");
  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS \`combined_score_history\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`ticker\` varchar(20) NOT NULL,
    \`snapshotDate\` varchar(10) NOT NULL,
    \`combinedScore\` decimal(6,2),
    \`signalType\` varchar(16),
    \`priceAtSnapshot\` decimal(12,4),
    \`horizonDays\` int NOT NULL DEFAULT 30,
    \`computedAt\` timestamp NOT NULL DEFAULT (now()),
    \`evaluatedAt\` timestamp NULL,
    \`priceAtEvaluation\` decimal(12,4),
    \`actualReturnPct\` decimal(7,4),
    \`benchmarkReturnPct\` decimal(7,4),
    \`alphaPct\` decimal(7,4),
    \`directionCorrect\` tinyint,
    CONSTRAINT \`combined_score_history_id\` PRIMARY KEY(\`id\`),
    CONSTRAINT \`uq_combined_score_history_ticker_date\` UNIQUE(\`ticker\`,\`snapshotDate\`)
  )`));
  tableEnsured = true;
}

/**
 * Täglicher Snapshot: den aktuellen combinedScore je Titel aus stock_signal_cache
 * festhalten (max. 1 Zeile pro Ticker und Tag).
 */
export async function snapshotCombinedScores(): Promise<{ inserted: number }> {
  const { getDb } = await import("../db");
  const { stockSignalCache, combinedScoreHistory } = await import("../../drizzle/schema");
  const db = await getDb();
  if (!db) return { inserted: 0 };

  try {
    await ensureTable(db);
    const rows = await db
      .select({
        ticker: stockSignalCache.ticker,
        combinedScore: stockSignalCache.combinedScore,
        signalType: stockSignalCache.signalType,
        currentPrice: stockSignalCache.currentPrice,
      })
      .from(stockSignalCache);

    const snapshotDate = new Date().toISOString().split("T")[0];
    let inserted = 0;
    for (const r of rows) {
      if (r.combinedScore == null || r.currentPrice == null) continue;
      try {
        await db
          .insert(combinedScoreHistory)
          .values({
            ticker: r.ticker,
            snapshotDate,
            combinedScore: r.combinedScore as any,
            signalType: r.signalType ?? null,
            priceAtSnapshot: r.currentPrice as any,
            horizonDays: HORIZON_DAYS,
          })
          // Idempotent: gleicher Ticker+Tag → no-op (kein Duplikat).
          .onDuplicateKeyUpdate({ set: { snapshotDate } });
        inserted++;
      } catch { /* Einzelzeile überspringen */ }
    }
    console.log(`[combinedScoreOutcome] Snapshot ${snapshotDate}: ${inserted} Titel`);
    return { inserted };
  } catch (e) {
    console.warn("[combinedScoreOutcome] Snapshot fehlgeschlagen:", (e as Error).message);
    return { inserted: 0 };
  }
}

/**
 * Reife Snapshots bewerten: realisierter Return seit Snapshot vs. SMI (Alpha) +
 * directionCorrect (buy → Return>0, sell → Return<0, hold → nicht bewertbar).
 */
export async function evaluateCombinedScores(): Promise<{ evaluated: number }> {
  const { getDb } = await import("../db");
  const { combinedScoreHistory, stocks } = await import("../../drizzle/schema");
  const { and, isNull, sql, eq } = await import("drizzle-orm");
  const { computeWindowReturn, computeAlpha } = await import("../lib/signals/benchmarkAlpha");
  const db = await getDb();
  if (!db) return { evaluated: 0 };

  try {
    await ensureTable(db);
    const now = new Date();
    const pending = await db
      .select()
      .from(combinedScoreHistory)
      .where(
        and(
          isNull(combinedScoreHistory.evaluatedAt),
          sql`DATE_ADD(${combinedScoreHistory.computedAt}, INTERVAL ${combinedScoreHistory.horizonDays} DAY) <= ${now}`,
        ),
      )
      .limit(300);

    if (pending.length === 0) return { evaluated: 0 };

    const tickers = [...new Set(pending.map((s: any) => s.ticker))];
    const stockRows = await db
      .select({ ticker: stocks.ticker, currentPrice: stocks.currentPrice })
      .from(stocks)
      .where(sql`${stocks.ticker} IN (${sql.join(tickers.map((t) => sql`${t}`), sql`, `)})`);
    const priceMap = new Map<string, number>();
    for (const row of stockRows) if (row.currentPrice) priceMap.set(row.ticker, parseFloat(row.currentPrice));

    const todayStr = now.toISOString().split("T")[0];
    let benchmarkRows: { date: string; close: number }[] = [];
    try {
      const { getBenchmarkData } = await import("../db");
      const oldest = pending.reduce((min: Date, s: any) => (s.computedAt < min ? s.computedAt : min), pending[0].computedAt);
      const fetchStart = new Date(oldest.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      benchmarkRows = (await getBenchmarkData("SMI", fetchStart, todayStr)).map((r: any) => ({ date: r.date, close: r.close }));
    } catch (e) {
      console.warn("[combinedScoreOutcome] Benchmark unavailable, Alpha übersprungen:", (e as Error).message);
    }

    let evaluated = 0;
    for (const s of pending) {
      const cur = priceMap.get(s.ticker);
      const entry = s.priceAtSnapshot != null ? parseFloat(s.priceAtSnapshot.toString()) : null;
      if (!cur || !entry) continue;

      const actualReturn = (cur - entry) / entry;
      const dateStr = s.computedAt.toISOString().split("T")[0];
      const benchmarkReturn = benchmarkRows.length ? computeWindowReturn(benchmarkRows, dateStr, todayStr) : null;
      const alpha = computeAlpha(actualReturn, benchmarkReturn);

      let directionCorrect: number | null = null;
      if (s.signalType === "buy") directionCorrect = actualReturn > 0 ? 1 : 0;
      else if (s.signalType === "sell") directionCorrect = actualReturn < 0 ? 1 : 0;
      else directionCorrect = null; // hold → nicht bewertbar

      await db
        .update(combinedScoreHistory)
        .set({
          evaluatedAt: now,
          priceAtEvaluation: cur.toString() as any,
          actualReturnPct: actualReturn.toFixed(4) as any,
          benchmarkReturnPct: benchmarkReturn !== null ? (benchmarkReturn.toFixed(4) as any) : null,
          alphaPct: alpha !== null ? (alpha.toFixed(4) as any) : null,
          directionCorrect: directionCorrect as any,
        })
        .where(eq(combinedScoreHistory.id, s.id));
      evaluated++;
    }
    console.log(`[combinedScoreOutcome] Evaluated ${evaluated} Combined-Score-Snapshots`);
    return { evaluated };
  } catch (e) {
    console.warn("[combinedScoreOutcome] Eval fehlgeschlagen:", (e as Error).message);
    return { evaluated: 0 };
  }
}

/** Aggregat für die Admin-Ansicht: Trefferquote + Alpha des Combined Score. */
export async function getCombinedScoreOutcomeStats(): Promise<{
  evaluated: number; hitRate: number | null; avgAlphaPct: number | null; pendingSnapshots: number;
}> {
  const { getDb } = await import("../db");
  const { combinedScoreHistory } = await import("../../drizzle/schema");
  const { sql, isNotNull, isNull } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) return { evaluated: 0, hitRate: null, avgAlphaPct: null, pendingSnapshots: 0 };
  try {
    await ensureTable(db);
    const agg = await db
      .select({
        evaluated: sql<number>`COUNT(*)`,
        directionalCount: sql<number>`SUM(CASE WHEN ${combinedScoreHistory.directionCorrect} IS NOT NULL THEN 1 ELSE 0 END)`,
        directionalCorrect: sql<number>`SUM(CASE WHEN ${combinedScoreHistory.directionCorrect} = 1 THEN 1 ELSE 0 END)`,
        avgAlpha: sql<number>`AVG(${combinedScoreHistory.alphaPct})`,
      })
      .from(combinedScoreHistory)
      .where(isNotNull(combinedScoreHistory.evaluatedAt));
    const pending = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(combinedScoreHistory)
      .where(isNull(combinedScoreHistory.evaluatedAt));

    const row = agg[0] ?? ({} as any);
    const dirCount = Number(row.directionalCount ?? 0);
    const dirCorrect = Number(row.directionalCorrect ?? 0);
    const avgAlpha = row.avgAlpha != null ? Number(row.avgAlpha) : null;
    return {
      evaluated: Number(row.evaluated ?? 0),
      hitRate: dirCount > 0 ? (dirCorrect / dirCount) * 100 : null,
      avgAlphaPct: avgAlpha != null && Number.isFinite(avgAlpha) ? avgAlpha * 100 : null,
      pendingSnapshots: Number(pending[0]?.c ?? 0),
    };
  } catch {
    return { evaluated: 0, hitRate: null, avgAlphaPct: null, pendingSnapshots: 0 };
  }
}
