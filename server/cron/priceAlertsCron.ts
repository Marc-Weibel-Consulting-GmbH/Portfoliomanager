/**
 * Price Alerts Cron Job
 *
 * Automatically checks all active price alerts and sends notifications
 * when alert conditions are met.
 *
 * Schedule: Every hour (configurable)
 *
 * D-03: the alert-check body is shared with scheduled/priceAlertsScheduled.ts
 * (see lib/priceAlertsCheck.ts) and both entry points are guarded by the same
 * job lock so the two parallel scheduling mechanisms don't double-fire.
 */

import { runIfNotRecent } from "../lib/jobLock";
import { runPriceAlertsCheck, PRICE_ALERTS_JOB_NAME, PRICE_ALERTS_MIN_INTERVAL_MINUTES } from "../lib/priceAlertsCheck";

/**
 * Check all active price alerts and trigger notifications
 */
export async function checkPriceAlerts() {
  try {
    await runIfNotRecent(PRICE_ALERTS_JOB_NAME, PRICE_ALERTS_MIN_INTERVAL_MINUTES, runPriceAlertsCheck);
  } catch (error) {
    console.error("[priceAlertsCron] Fatal error during price alerts check:", error);
  }
}

/**
 * Initialize the price alerts cron job
 * This function should be called once when the server starts
 */
export function initPriceAlertsCron() {
  console.log("[priceAlertsCron] Initializing price alerts cron job...");

  // Run immediately on startup
  console.log("[priceAlertsCron] Running initial check...");
  checkPriceAlerts().catch((error) => {
    console.error("[priceAlertsCron] Error during initial check:", error);
  });

  // Schedule checks every hour (3600000 ms)
  const INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  setInterval(() => {
    checkPriceAlerts().catch((error) => {
      console.error("[priceAlertsCron] Error during scheduled check:", error);
    });
  }, INTERVAL_MS);

  console.log("[priceAlertsCron] Cron job initialized successfully (running every hour)");
}

/**
 * Manual trigger for testing or admin operations
 */
export async function manualPriceAlertsCheck() {
  console.log("[priceAlertsCron] Manual check triggered");
  return await checkPriceAlerts();
}
