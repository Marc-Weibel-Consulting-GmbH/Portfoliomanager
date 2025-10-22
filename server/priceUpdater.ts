import cron, { ScheduledTask } from "node-cron";
import { getAllStocks, updateStock } from "./db";

// Mock function to simulate fetching real-time prices
// In production, you would use a real API like yfinance, Alpha Vantage, etc.
async function fetchRealTimePrice(ticker: string): Promise<string | null> {
  try {
    // Simulate API call with random price variation
    // In production, replace this with actual API call
    const basePrice = Math.random() * 500 + 50;
    const variation = (Math.random() - 0.5) * 10; // ±5 variation
    const newPrice = (basePrice + variation).toFixed(2);
    return newPrice;
  } catch (error) {
    console.error(`Failed to fetch price for ${ticker}:`, error);
    return null;
  }
}

export async function startPriceUpdater() {
  // Schedule task to run every 15 minutes
  // Cron expression: "*/15 * * * *" means every 15 minutes
  const task = cron.schedule("*/15 * * * *", async () => {
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
            await updateStock(stock.ticker, {
              currentPrice: newPrice,
            });
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

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(
        `[${new Date().toISOString()}] Price update completed. Updated: ${updatedCount}, Failed: ${failedCount}`
      );
    } catch (error) {
      console.error("Price updater error:", error);
    }
  });

  // Run immediately on startup
  console.log("[Price Updater] Initialized. First update will run in 15 minutes.");
  console.log("[Price Updater] Cron schedule: Every 15 minutes");

  return task;
}

// Stop the updater
export function stopPriceUpdater(task: ScheduledTask) {
  task.stop();
  console.log("[Price Updater] Stopped");
}

