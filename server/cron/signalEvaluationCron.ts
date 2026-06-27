/**
 * Signal Evaluation Cron — Lookback-Evaluation für historische Signale
 *
 * Läuft täglich. Für jedes offene Signal in signal_history, dessen
 * holdingPeriodHint abgelaufen ist, wird:
 *   1. Der aktuelle Preis aus der DB gelesen
 *   2. Die tatsächliche Rendite berechnet
 *   3. directionCorrect gesetzt (Signal-Richtung korrekt?)
 *   4. evaluatedAt gesetzt
 *
 * Zusätzlich: Speichert neue Signale aus dem SignalOrchestrator für alle
 * Aktien im Portfolio (täglich, nach Marktschluss).
 */

import { and, eq, isNull, lt, sql } from "drizzle-orm";

let isRunning = false;

// ─────────────────────────────────────────────────────────────────────────────
// Lookback-Evaluation: Offene Signale auswerten
// ─────────────────────────────────────────────────────────────────────────────

export async function evaluatePendingSignals(): Promise<void> {
  if (isRunning) {
    console.log("[signalEvalCron] Already running, skipping...");
    return;
  }
  isRunning = true;
  console.log("[signalEvalCron] Starting lookback evaluation...");

  try {
    const { getDb } = await import("../db");
    const { signalHistory, stocks: stocksTable } = await import("../../drizzle/schema");
    const db = await getDb();
    if (!db) {
      console.error("[signalEvalCron] DB not available");
      return;
    }

    // Alle Signale, die noch nicht evaluiert wurden und deren holdingPeriodHint abgelaufen ist
    const now = new Date();
    const pending = await db
      .select()
      .from(signalHistory)
      .where(
        and(
          isNull(signalHistory.evaluatedAt),
          sql`DATE_ADD(${signalHistory.computedAt}, INTERVAL ${signalHistory.holdingPeriodHint} DAY) <= ${now}`
        )
      )
      .limit(200);

    if (pending.length === 0) {
      console.log("[signalEvalCron] No pending signals to evaluate");
      return;
    }

    console.log(`[signalEvalCron] Evaluating ${pending.length} pending signals...`);

    // Aktuelle Preise laden
    const tickers = [...new Set(pending.map((s) => s.ticker))];
    const stockRows = await db
      .select({ ticker: stocksTable.ticker, currentPrice: stocksTable.currentPrice })
      .from(stocksTable)
      .where(sql`${stocksTable.ticker} IN (${sql.join(tickers.map(t => sql`${t}`), sql`, `)})`);

    const priceMap = new Map<string, number>();
    for (const row of stockRows) {
      if (row.currentPrice) priceMap.set(row.ticker, parseFloat(row.currentPrice));
    }

    let evaluated = 0;
    for (const signal of pending) {
      const currentPrice = priceMap.get(signal.ticker);
      if (!currentPrice || !signal.priceAtSignal) continue;

      const entryPrice = parseFloat(signal.priceAtSignal.toString());
      const actualReturn = (currentPrice - entryPrice) / entryPrice;
      const direction = signal.direction ?? 0;

      // Richtung korrekt: buy/add (dir=1) → positiver Return; sell/reduce (dir=-1) → negativer Return
      let directionCorrect: number | null = null;
      if (direction === 1) directionCorrect = actualReturn > 0 ? 1 : 0;
      else if (direction === -1) directionCorrect = actualReturn < 0 ? 1 : 0;
      else directionCorrect = null; // hold → nicht bewertbar

      await db
        .update(signalHistory)
        .set({
          evaluatedAt: now,
          priceAtEvaluation: currentPrice.toString() as any,
          actualReturnPct: actualReturn.toFixed(4) as any,
          directionCorrect: directionCorrect as any,
        })
        .where(eq(signalHistory.id, signal.id));

      evaluated++;
    }

    console.log(`[signalEvalCron] Evaluated ${evaluated} signals`);
  } catch (err) {
    console.error("[signalEvalCron] Error during evaluation:", err);
  } finally {
    isRunning = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal-Snapshot: Neue Signale für alle Portfolio-Aktien speichern
// ─────────────────────────────────────────────────────────────────────────────

export async function snapshotSignalsForPortfolio(): Promise<void> {
  console.log("[signalEvalCron] Snapshotting signals for all portfolio stocks...");

  try {
    const { getDb } = await import("../db");
    const { stocks: stocksTable, signalHistory } = await import("../../drizzle/schema");
    const { runSignalOrchestrator } = await import("../lib/signals/signalOrchestrator");
    const db = await getDb();
    if (!db) return;

    // Alle aktiven Aktien laden
    const allStocks = await db
      .select({ ticker: stocksTable.ticker, currentPrice: stocksTable.currentPrice })
      .from(stocksTable)
      .limit(100);

    let saved = 0;
    for (const stock of allStocks) {
      try {
        // Preise via Yahoo Finance laden (gleiche Logik wie getRegimeSignal)
        const yahooFinance = (await import('yahoo-finance2')).default;
        const normTicker = stock.ticker.replace('.SW', '.SW').replace('.US', '');
        const chartResult = await (yahooFinance as any).chart(normTicker, {
          period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          period2: new Date().toISOString().split('T')[0],
          interval: '1d',
        }) as any;
        const quotes = chartResult.quotes ?? [];
        const prices: number[] = quotes.map((q: any) => q.close).filter((c: any) => c != null);
        if (prices.length < 60) continue;

        const result = runSignalOrchestrator({
          ticker: stock.ticker,
          marketType: 'single_stock',
          prices,
          dates: [],
          lpplRisk: null,
          momentumScore: null,
          qualityScore: null,
        });
        if (!result) continue;

        // Engine-Scores extrahieren
        const engineScores: Record<string, number> = {};
        for (const output of result.signalOutputs ?? []) {
          engineScores[output.engine] = output.rawScore;
        }

        // direction und holdingPeriodHint aus dem gewählten SignalOutput
        const selectedOutput = result.signalOutputs?.find(o => o.engine === result.selectedModel);
        const direction = selectedOutput?.direction ?? 0;
        const holdingPeriodHint = selectedOutput?.holdingPeriodHint ?? 14;

        await db.insert(signalHistory).values({
          ticker: stock.ticker,
          action: result.action,
          selectedEngine: result.selectedModel,
          regime: result.regime,
          regimeConfidence: result.regimeConfidence?.toFixed(3) as any,
          conviction: result.conviction.toFixed(3) as any,
          rawScore: result.rawScore.toFixed(4) as any,
          adjustedScore: result.adjustedScore.toFixed(4) as any,
          direction,
          holdingPeriodHint,
          stopLossPct: result.stopLossPct?.toFixed(3) as any ?? null,
          takeProfitPct: result.takeProfitPct?.toFixed(3) as any ?? null,
          priceAtSignal: stock.currentPrice ? parseFloat(stock.currentPrice).toFixed(4) as any : null,
          engineScores: engineScores as any,
          riskDecision: result.riskOverlay?.decision ?? null,
          computedAt: new Date(),
        });
        saved++;
      } catch (e) {
        // Einzelne Fehler nicht abbrechen lassen
        console.warn(`[signalEvalCron] Error snapshotting ${stock.ticker}:`, (e as Error).message);
      }
    }

    console.log(`[signalEvalCron] Saved ${saved} signal snapshots`);
  } catch (err) {
    console.error("[signalEvalCron] Error during snapshot:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────────────────

export function initSignalEvaluationCron(): void {
  console.log("[signalEvalCron] Initializing signal evaluation cron...");

  // Evaluation: täglich um 22:00 (nach Marktschluss)
  const EVAL_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
  setInterval(() => {
    evaluatePendingSignals().catch((e) =>
      console.error("[signalEvalCron] Eval error:", e)
    );
  }, EVAL_INTERVAL_MS);

  // Snapshot: täglich um 18:00 (nach EU-Marktschluss)
  // Für den ersten Run: nach 5 Minuten starten (Server-Warmup)
  setTimeout(() => {
    snapshotSignalsForPortfolio().catch((e) =>
      console.error("[signalEvalCron] Snapshot error:", e)
    );
    setInterval(() => {
      snapshotSignalsForPortfolio().catch((e) =>
        console.error("[signalEvalCron] Snapshot error:", e)
      );
    }, EVAL_INTERVAL_MS);
  }, 5 * 60 * 1000);

  console.log("[signalEvalCron] Initialized (eval: 24h, snapshot: 24h with 5min delay)");
}
