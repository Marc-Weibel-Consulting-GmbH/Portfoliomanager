/**
 * Regime-History Cron (R4)
 *
 * Persistiert einmal täglich einen Snapshot des Markt-Regime-Gesamt-Scores in
 * `market_regime_history`. Diese Zeitreihe speist die 90-Tage-Sparkline auf der
 * Markt-Regime-Seite («Regime-Verlauf»).
 *
 * Läuft um 23:15 UTC — nach EU- und US-Handelsschluss, kurz nach dem
 * Daily-Refresh (23:00), damit die zugrundeliegenden Kursreihen aktuell sind.
 * Zusätzlich ein Initial-Snapshot 6 Min nach Start, damit direkt nach dem
 * Deploy schon der heutige Punkt existiert (Upsert per Datum, idempotent).
 */

import cron from "node-cron";
import { recordRegimeSnapshot } from "../routers/marketRegimeRouter";

async function runOnce() {
  try {
    const res = await recordRegimeSnapshot();
    if (res.recorded) {
      console.log(`[regimeHistoryCron] Snapshot ${res.date}: Score ${res.score.toFixed(4)}`);
    } else {
      console.log(`[regimeHistoryCron] Snapshot ${res.date} nicht gespeichert (DB/Tabelle fehlt)`);
    }
  } catch (e) {
    console.error("[regimeHistoryCron] Snapshot fehlgeschlagen:", (e as Error).message);
  }
}

export function initRegimeHistoryCron() {
  // Initial-Snapshot kurz nach Start (nach den übrigen Diensten).
  setTimeout(() => {
    runOnce().catch((e) => console.error("[regimeHistoryCron] Initial-Snapshot:", e));
  }, 6 * 60 * 1000);

  // Täglich 23:15 UTC (second minute hour …).
  cron.schedule("0 15 23 * * *", runOnce);

  console.log("[regimeHistoryCron] Initialized (täglich 23:15 UTC)");
}
