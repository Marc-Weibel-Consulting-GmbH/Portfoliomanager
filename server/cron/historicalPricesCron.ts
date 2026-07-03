import { importHistoricalPrices, HISTORICAL_PRICES_JOB_NAME, HISTORICAL_PRICES_MIN_INTERVAL_MINUTES } from "../jobs/importHistoricalPrices";
import { runIfNotRecent } from "../lib/jobLock";

/**
 * Daily cron job to update historical prices
 * This job runs once per day to fetch the latest historical prices
 * for all tickers in user portfolios.
 *
 * Schedule: Every day at 2:00 AM UTC
 *
 * D-03: guarded by the shared job lock together with
 * scheduled/historicalPricesScheduled.ts so the import doesn't run twice
 * daily while both scheduling mechanisms are wired.
 */

export async function dailyHistoricalPricesUpdate() {
  try {
    await runIfNotRecent(HISTORICAL_PRICES_JOB_NAME, HISTORICAL_PRICES_MIN_INTERVAL_MINUTES, async () => {
      console.log("[historicalPricesCron] Starting daily historical prices update...");

      // Get yesterday's date (to fetch the most recent complete trading day)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      // Get date from 7 days ago (to fill any gaps)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split("T")[0];

      // Import prices for the last 7 days (to fill gaps and get latest data)
      const result = await importHistoricalPrices(weekAgoStr, yesterdayStr, false);

      if (result.success) {
        console.log(
          `[historicalPricesCron] Daily update completed: ${result.tickersProcessed} tickers, ${result.pricesImported} prices imported`
        );
        if (result.errors.length > 0) {
          console.warn(`[historicalPricesCron] Errors during update:`, result.errors);
        }
      } else {
        console.error("[historicalPricesCron] Daily update failed:", result.errors);
      }
    });
  } catch (error) {
    console.error("[historicalPricesCron] Fatal error during daily update:", error);
  }
}

/**
 * Initialize the cron job
 * This function should be called once when the server starts
 */
export function initHistoricalPricesCron() {
  console.log("[historicalPricesCron] Initializing daily historical prices cron job...");

  // Run immediately on startup (but only if it's past 2 AM)
  const now = new Date();
  const hours = now.getUTCHours();
  if (hours >= 2) {
    console.log("[historicalPricesCron] Running initial update...");
    dailyHistoricalPricesUpdate().catch((error) => {
      console.error("[historicalPricesCron] Error during initial update:", error);
    });
  }

  // Schedule daily updates at 2:00 AM UTC
  const CRON_SCHEDULE = "0 2 * * *"; // Every day at 2:00 AM UTC
  const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  // Calculate time until next 2:00 AM UTC
  const getTimeUntilNext2AM = () => {
    const now = new Date();
    const next2AM = new Date();
    next2AM.setUTCHours(2, 0, 0, 0);

    // If it's already past 2 AM today, schedule for tomorrow
    if (now.getUTCHours() >= 2) {
      next2AM.setUTCDate(next2AM.getUTCDate() + 1);
    }

    return next2AM.getTime() - now.getTime();
  };

  // Schedule first run
  const timeUntilNext2AM = getTimeUntilNext2AM();
  console.log(`[historicalPricesCron] Next update scheduled in ${Math.round(timeUntilNext2AM / 1000 / 60)} minutes`);

  setTimeout(() => {
    dailyHistoricalPricesUpdate().catch((error) => {
      console.error("[historicalPricesCron] Error during scheduled update:", error);
    });

    // Then run every 24 hours
    setInterval(() => {
      dailyHistoricalPricesUpdate().catch((error) => {
        console.error("[historicalPricesCron] Error during scheduled update:", error);
      });
    }, INTERVAL_MS);
  }, timeUntilNext2AM);

  console.log("[historicalPricesCron] Cron job initialized successfully");
}

/**
 * Manual trigger for testing or admin operations
 */
export async function manualHistoricalPricesUpdate(fromDate?: string, toDate?: string, forceRefresh?: boolean) {
  console.log("[historicalPricesCron] Manual update triggered");
  return await importHistoricalPrices(fromDate, toDate, forceRefresh);
}
