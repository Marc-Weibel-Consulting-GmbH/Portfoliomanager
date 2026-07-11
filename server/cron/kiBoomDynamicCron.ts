/**
 * KI-Boom Dynamic Metrics Cron
 *
 * Ruft täglich via Perplexity Sonar-Pro aktuelle KI-Boom-Metriken ab und
 * speichert sie in `ki_boom_dynamic_metrics`. Diese Werte ersetzen die
 * statischen Fallback-Werte in kiBoomRouter.ts.
 *
 * Läuft um 06:00 UTC — vor dem Handelsbeginn Europa, nach US-Handelsschluss.
 * Initial-Fetch 5 Min nach Start für sofortige Datenverfügbarkeit.
 */
import cron from "node-cron";
import { fetchAndSaveDynamicMetrics } from "./kiBoomDynamicMetricsFetcher";

async function runOnce() {
  try {
    const res = await fetchAndSaveDynamicMetrics();
    if (res.saved > 0) {
      console.log(`[kiBoomDynamicCron] ${res.saved} Metriken gespeichert`);
    } else {
      console.warn(`[kiBoomDynamicCron] Keine Metriken gespeichert. Fehler: ${res.errors.join("; ")}`);
    }
  } catch (e) {
    console.error("[kiBoomDynamicCron] Fetch fehlgeschlagen:", (e as Error).message);
  }
}

export function initKiBoomDynamicCron() {
  // Initial-Fetch 5 Min nach Start (nur wenn DB verfügbar)
  setTimeout(() => {
    runOnce().catch((e) => console.error("[kiBoomDynamicCron] Initial-Fetch:", e));
  }, 5 * 60 * 1000);

  // Täglich 06:00 UTC
  cron.schedule("0 0 6 * * *", runOnce);

  console.log("[kiBoomDynamicCron] Initialized (täglich 06:00 UTC)");
}
