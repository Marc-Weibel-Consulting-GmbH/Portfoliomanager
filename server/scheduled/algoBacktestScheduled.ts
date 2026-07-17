/**
 * algoBacktestScheduled.ts
 *
 * Heartbeat-Handler für das monatliche Algo-Backtesting.
 * Wird am 1. des Monats aufgerufen (Portfolio-Erstellung)
 * und am 1. des Folgemonats (Evaluation der Vormonats-Portfolios).
 *
 * Endpoint: POST /api/scheduled/algoBacktest
 */

import type { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import {
  createBacktestRun,
  evaluateBacktestRun,
  getPendingEvaluations,
} from "../lib/algoBacktestEngine";

export async function handleAlgoBacktest(req: Request, res: Response) {
  try {
    // Authentifizierung: nur Cron-Calls erlaubt
    const user = await sdk.authenticateRequest(req);
    if (!(user as any).isCron) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    const results: string[] = [];

    // 1. Ausstehende Evaluationen prüfen (Runs die 30+ Tage alt sind)
    const pendingEvals = await getPendingEvaluations();
    for (const { runId, runMonth } of pendingEvals) {
      try {
        const evalResult = await evaluateBacktestRun(runId);
        results.push(`Evaluation Run ${runId} (${runMonth}): ${evalResult.message}`);
        console.log(`[algoBacktest] ${evalResult.message}`);
      } catch (e: any) {
        const msg = `Evaluation Run ${runId} fehlgeschlagen: ${e?.message}`;
        results.push(msg);
        console.error(`[algoBacktest] ${msg}`);
      }
    }

    // 2. Neuen Monats-Run erstellen
    try {
      const createResult = await createBacktestRun();
      if (createResult.portfoliosCreated > 0) {
        results.push(`Neuer Run ${createResult.runId}: ${createResult.portfoliosCreated}/6 Portfolios erstellt`);
        if (createResult.errors.length > 0) {
          results.push(`Fehler: ${createResult.errors.join("; ")}`);
        }
      } else {
        results.push(`Run ${createResult.runId}: Bereits vorhanden, übersprungen`);
      }
    } catch (e: any) {
      const msg = `Portfolio-Erstellung fehlgeschlagen: ${e?.message}`;
      results.push(msg);
      console.error(`[algoBacktest] ${msg}`);
    }

    return res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (err: any) {
    console.error("[algoBacktest] Handler-Fehler:", err);
    return res.status(500).json({
      error: err?.message ?? "Unbekannter Fehler",
      stack: err?.stack,
      context: { url: req.url, taskUid: (req as any).taskUid },
      timestamp: new Date().toISOString(),
    });
  }
}
