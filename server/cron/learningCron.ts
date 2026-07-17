/**
 * Learning-Cron (K6, Learning-Koordination): schliesst die beiden Lernschleifen,
 * deren DATEN automatisch anfallen, deren LERNEN aber bisher nur per Admin-Klick
 * lief — ohne Klick blieben dauerhaft Default-Gewichte aktiv:
 *
 *  1. Regime-Engine-Priors (regimeSignalMemory.recomputeRegimeEngineWeights):
 *     lernt aus dem täglich gemessenen Out-of-Sample-Alpha (signalEvaluationCron),
 *     welche Signal-Engine in welchem Marktregime funktioniert.
 *     → wöchentlich So 03:15 UTC (nach einer Woche frischer Auswertungen).
 *
 *  2. Signal-Weight-Optimizer (optimizerWorker.runOptimizerNonBlocking):
 *     Grid-Backtest der 7 Scoring-Gewichte über die Watchlist; Persistenz nur
 *     bei Erfolg (saveOptimizerResult aktiviert die neue Konfiguration).
 *     → monatlich am 1. um 04:10 UTC — bewusst VOR dem Algo-Backtest-Feedback-
 *       Loop (Heartbeat am 3.), der ytd/momentum in signalWeights leicht
 *       nachjustiert (algoBacktestEngine.applyFeedbackLoopToSignalWeights):
 *       so tunt das Grid zuerst, der Feedback-Loop justiert danach auf der
 *       frischen Basis. Die 5 NICHT grid-getunten Gewichte (rf/sentiment/
 *       bubble/quality/momentum) werden aus der aktiven Konfiguration
 *       übernommen statt auf Defaults zurückgesetzt — sonst würde jeder
 *       Optimizer-Lauf die Feedback-Loop-Anpassungen löschen.
 *       Gemeinsames Lock mit dem Admin-Button. (ML-Training separat Mo 02:37.)
 *
 * Beide Läufe sind non-fatal: Fehler werden geloggt, die App läuft mit den
 * zuletzt aktiven Gewichten weiter.
 */
import cron from "node-cron";

export function initLearningCron() {
  // 1) Regime-Engine-Priors — So 03:15 UTC
  cron.schedule("15 3 * * 0", async () => {
    try {
      const { recomputeRegimeEngineWeights } = await import("../analytics/regimeSignalMemory");
      const res = await recomputeRegimeEngineWeights();
      console.log(
        `[learningCron] Regime-Priors aktualisiert: ${res.updatedRegimes} Regime aus ${res.evaluatedRows} ausgewerteten Signalen` +
        (res.reason ? ` (${res.reason})` : "")
      );
    } catch (e: any) {
      console.error("[learningCron] Priors-Recompute fehlgeschlagen (non-fatal):", e?.message);
    }
  });

  // 2) Signal-Weight-Optimizer — monatlich am 1. um 04:10 UTC
  cron.schedule("10 4 1 * *", async () => {
    const { tryAcquireOptimizerLock, releaseOptimizerLock } = await import("../analytics/optimizerWorker");
    if (!tryAcquireOptimizerLock()) {
      console.log("[learningCron] Optimizer übersprungen — läuft bereits (Admin-Trigger).");
      return;
    }
    try {
      const { runOptimizerNonBlocking, saveOptimizerResult, getActiveWeights } = await import("../analytics/optimizerWorker");
      const activeBefore = await getActiveWeights();
      const result = await runOptimizerNonBlocking((msg) => console.log(`[learningCron][optimizer] ${msg}`));
      // Nicht grid-getunte Gewichte aus der aktiven Konfiguration übernehmen —
      // sie stammen ggf. aus dem Algo-Backtest-Feedback-Loop (manus, Stufe 2)
      // und dürfen vom Grid-Lauf nicht auf Defaults zurückgesetzt werden.
      result.bestWeights = {
        ...result.bestWeights,
        rf: activeBefore.rf,
        sentiment: activeBefore.sentiment,
        bubble: activeBefore.bubble,
        quality: activeBefore.quality,
        momentum: activeBefore.momentum,
      };
      await saveOptimizerResult(result);
      console.log(`[learningCron] Signal-Gewichte neu getunt: Trefferquote ${result.hitRate.toFixed(1)}%`);
    } catch (e: any) {
      console.error("[learningCron] Optimizer fehlgeschlagen (non-fatal):", e?.message);
    } finally {
      releaseOptimizerLock();
    }
  });

  // 3) Vorschlags-Erfolgsmessung (K9) — wöchentlich So 05:00 UTC.
  // Reine Messung (realisierter 30-Tage-Return vs. SMI je Vorschlag),
  // keine automatische Parameter-Anpassung.
  cron.schedule("0 5 * * 0", async () => {
    try {
      const { evaluateProposalOutcomes } = await import("../analytics/proposalOutcome");
      const res = await evaluateProposalOutcomes();
      console.log(`[learningCron] Vorschlags-Erfolgsmessung: ${res.evaluated} bewertet, ${res.skipped} übersprungen${res.reason ? ` (${res.reason})` : ""}`);
    } catch (e: any) {
      console.error("[learningCron] Vorschlags-Erfolgsmessung fehlgeschlagen (non-fatal):", e?.message);
    }
  });

  console.log("[learningCron] Lernschleifen registriert (Priors So 03:15, Optimizer monatlich 1. 04:10, Vorschlags-Messung So 05:00 UTC)");
}
