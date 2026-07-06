import cron, { ScheduledTask } from "node-cron";
import { getAllStocks, updateStock } from "./db";
import { fetchEODHDRealTime } from "./_core/eodhdApi";

// Aktuellen Kurs via EODHD holen. Yahoo Finance (bisherige Quelle) ist aus der Deploy-Umgebung
// blockiert → der tägliche Updater lief ins Leere und stocks.currentPrice blieb leer ("Kurs
// fehlt"). fetchEODHDRealTime wendet den Symbol-Alias an (z. B. ROG.SW→ROP.SW, ABB.SW→ABBN.SW).
async function fetchRealTimePrice(ticker: string): Promise<string | null> {
  try {
    const rt = await fetchEODHDRealTime(ticker);
    if (rt.close != null && rt.close > 0) {
      return rt.close.toString();
    }
    console.warn(`[Price Updater] Kein EODHD-Kurs für ${ticker}`);
    return null;
  } catch (error) {
    console.error(`[Price Updater] Failed to fetch price for ${ticker}:`, error);
    return null;
  }
}

export async function startPriceUpdater() {
  // Schedule task to run once daily at 18:00 (after market close)
  // Cron expression: "0 18 * * *" means every day at 18:00
  const task = cron.schedule("0 18 * * *", async () => {
    console.log(`[${new Date().toISOString()}] Starting price update...`);

    try {
      const stocks = await getAllStocks();

      if (!stocks || stocks.length === 0) {
        console.log("No stocks found to update");
        return;
      }

      let updatedCount = 0;
      let failedCount = 0;

      for (const stock of stocks) {
        try {
          const newPrice = await fetchRealTimePrice(stock.ticker);

          if (newPrice) {
            const updateData: any = {
              currentPrice: newPrice,
            };

            // If ytdStartPrice is not set (first time or new year), set it
            if (!stock.ytdStartPrice || parseFloat(stock.ytdStartPrice) === 0) {
              updateData.ytdStartPrice = newPrice;
              console.log(`→ Set YTD start price for ${stock.ticker}: ${newPrice}`);
            }

            // Calculate YTD performance if ytdStartPrice exists
            // R-30: ytdStartPrice wird vom ytdUpdater (bzw. scripts/
            // recompute-ytd-baselines.ts) aus adjustedClose gesetzt, damit
            // currentPrice vs. Baseline über Splits/Spin-offs des VORJAHRES
            // hinweg stimmt (Holcim/Amrize-Fall).
            // TODO(R-11/R-30): Bei einer Corporate Action MITTEN im Jahr bleibt
            // die Rechnung falsch — currentPrice springt, die Baseline nicht.
            // Braucht Ratio-Sprung-Erkennung im täglichen Update oder eine
            // Splits-Tabelle; bis dahin: scripts/recompute-ytd-baselines.ts
            // nach bekannten Corporate Actions laufen lassen.
            const ytdStart = parseFloat(stock.ytdStartPrice || "0");
            if (ytdStart > 0) {
              const ytdPerformance = ((parseFloat(newPrice) - ytdStart) / ytdStart) * 100;
              updateData.ytdPerformance = ytdPerformance.toFixed(2);
            }

            await updateStock(stock.ticker, updateData);
            updatedCount++;
            console.log(`✓ Updated ${stock.ticker}: ${newPrice} ${stock.currency}`);
          } else {
            failedCount++;
            console.warn(`✗ Failed to update ${stock.ticker}`);
          }
        } catch (error) {
          failedCount++;
          console.error(`Error updating ${stock.ticker}:`, error);
        }

        // Add small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500)); // 0.5 second between requests
      }

      console.log(
        `[${new Date().toISOString()}] Price update completed. Updated: ${updatedCount}, Failed: ${failedCount}`
      );
    } catch (error) {
      console.error("Price updater error:", error);
    }
  });

  console.log("[Price Updater] ENABLED - Using Yahoo Finance API (free)");
  console.log("[Price Updater] Cron schedule: Every 15 minutes");
  task.start();

  return task;
}

// Stop the updater
export function stopPriceUpdater(task: ScheduledTask) {
  task.stop();
  console.log("[Price Updater] Stopped");
}

