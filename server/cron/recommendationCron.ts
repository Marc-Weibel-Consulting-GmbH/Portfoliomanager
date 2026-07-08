/**
 * Empfehlungs-Cron (Track D / P3) — generiert wiederkehrende Transaktions-Empfehlungslisten
 * je Portfolio-Kadenz (wöchentlich/monatlich/quartalsweise) und setzt sie bei opt-in
 * (autoExecute) automatisch um. Läuft täglich; die Fälligkeit ergibt sich aus der pro
 * Portfolio konfigurierten Kadenz und dem letzten Generierungszeitpunkt.
 */
import { runDueRecommendations } from "../lib/scheduledRecommendations";

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // täglich

async function tick(): Promise<void> {
  try {
    const n = await runDueRecommendations(Date.now());
    if (n > 0) console.log(`[recommendationCron] ${n} fällige Portfolios verarbeitet`);
  } catch (e) {
    console.error("[recommendationCron] Fehler:", (e as Error).message);
  }
}

export function initRecommendationCron(): void {
  console.log("[recommendationCron] Initializing (täglicher Fälligkeits-Check)...");
  // Erster Lauf nach 5 Minuten (Server-Warmup), danach täglich.
  setTimeout(() => {
    tick().catch((e) => console.error("[recommendationCron] Erstlauf-Fehler:", e));
    setInterval(() => {
      tick().catch((e) => console.error("[recommendationCron] Fehler:", e));
    }, CHECK_INTERVAL_MS);
  }, 5 * 60 * 1000);
}
