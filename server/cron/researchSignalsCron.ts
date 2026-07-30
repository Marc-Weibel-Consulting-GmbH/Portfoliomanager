/**
 * Research Signals Cron
 *
 * Holt täglich die Research-Observatory-Signale von der n8n-Instanz und
 * cached sie in `research_signals` (Upsert nach signalId). Ergänzt den
 * on-demand-Refresh (24h-Cache) im researchObservatoryRouter, damit die Daten
 * auch ohne Seitenaufruf frisch bleiben.
 *
 * Läuft täglich 05:30 UTC. No-op, wenn N8N_SIGNALS_URL nicht gesetzt ist.
 * Initial-Fetch 5 Min nach Start für sofortige Datenverfügbarkeit.
 */
import cron from "node-cron";
import { refreshResearchSignals } from "../_core/researchSignals";

async function runOnce() {
  try {
    const upserted = await refreshResearchSignals({ force: true });
    console.log(`[researchSignalsCron] ${upserted} Signale aktualisiert`);
  } catch (e) {
    console.error("[researchSignalsCron] Fetch fehlgeschlagen:", (e as Error).message);
  }
}

export function initResearchSignalsCron() {
  // Initial-Fetch 5 Min nach Start (nur wenn DB + URL verfügbar)
  setTimeout(() => {
    runOnce().catch((e) => console.error("[researchSignalsCron] Initial-Fetch:", e));
  }, 5 * 60 * 1000);

  // Täglich 05:30 UTC
  cron.schedule("0 30 5 * * *", runOnce);

  console.log("[researchSignalsCron] Initialized (täglich 05:30 UTC)");
}
