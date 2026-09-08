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

            // YTD-Felder werden ausschliesslich durch den täglichen
            // adjusted-close-Abgleich geschrieben. Ein Real-Time-Kurs kann nach
            // einem Split auf einer anderen Preisbasis liegen und darf daher
            // nicht gegen eine Jahresanfangs-Baseline verglichen werden.

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

  console.log("[Price Updater] ENABLED - Using EODHD real-time prices");
  console.log("[Price Updater] Cron schedule: daily at 18:00 local server time");
  task.start();

  return task;
}

// Stop the updater
export function stopPriceUpdater(task: ScheduledTask) {
  task.stop();
  console.log("[Price Updater] Stopped");
}
