/**
 * Learning-Cron — seit K1 (Selbstlern-Stopp, design/KONSOLIDIERUNG_RECHENWERKE.md)
 * bewusst OHNE selbständige Lernschleifen. Leitsatz L3: Messen ja,
 * automatisches Übernehmen nein.
 *
 * Entfernt wurden (Historie: PR #315-Ära, K1):
 *  - Regime-Engine-Priors (So 03:15): schrieb wöchentlich engineWeights aus
 *    dem signal_history-Alpha in regime_signal_config — ohne Gate, und auf
 *    Basis einer Messung mit bekanntem Fenster-Fehler. Das Werkzeug bleibt
 *    als Admin-Knopf erhalten (adminRouter → recomputeRegimeEngineWeights).
 *  - Signal-Weight-Optimizer (monatlich 1. 04:10): tunte die F2-Fallback-
 *    Gewichte unbeaufsichtigt. Der Lauf bleibt als Admin-Knopf erhalten
 *    (optimizerRouter), dort weiterhin mit Out-of-Sample-Gate.
 *
 * Was bleibt, ist reine Messung (Schicht C) — sie ändert nie Parameter.
 */
import cron from "node-cron";

export function initLearningCron() {
  // Vorschlags-Erfolgsmessung (K9) — wöchentlich So 05:00 UTC.
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

  console.log("[learningCron] Nur Messung registriert (Vorschlags-Messung So 05:00 UTC) — Lernschleifen per K1 gestoppt, Werkzeuge nur noch per Admin-Knopf");
}
