/**
 * KI-Boom History Cron
 *
 * Persistiert täglich einen Snapshot aller KI-Boom-Signalwerte in
 * `ki_boom_metrics_history`. Diese Zeitreihe speist die historischen Charts
 * im KI-Blase Monitor.
 *
 * Läuft um 23:30 UTC — nach EU- und US-Handelsschluss, nach dem Daily-Refresh.
 * Initial-Snapshot 8 Min nach Start für sofortige Datenverfügbarkeit.
 */

import cron from "node-cron";
import { recordKiBoomSnapshot } from "../routers/kiBoomRouter";

async function runOnce() {
  try {
    const res = await recordKiBoomSnapshot();
    console.log(`[kiBoomHistoryCron] Snapshot gespeichert: Zone=${res.overallZone}, Warnungen=${res.activeWarnings}, Kritisch=${res.activeCritical}`);
  } catch (e) {
    console.error("[kiBoomHistoryCron] Snapshot fehlgeschlagen:", (e as Error).message);
  }
}

export function initKiBoomHistoryCron() {
  // Initial-Snapshot kurz nach Start
  setTimeout(() => {
    runOnce().catch((e) => console.error("[kiBoomHistoryCron] Initial-Snapshot:", e));
  }, 8 * 60 * 1000);

  // Täglich 23:30 UTC
  cron.schedule("0 30 23 * * *", runOnce);

  console.log("[kiBoomHistoryCron] Initialized (täglich 23:30 UTC)");
}
