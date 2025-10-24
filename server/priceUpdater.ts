import cron, { ScheduledTask } from "node-cron";
import { getAllStocks, updateStock } from "./db";

const MARKETSTACK_API_KEY = process.env.MARKETSTACK_API_KEY || "59fa6788029f8094ee4eee81cea9700f";
const MARKETSTACK_URL = "http://api.marketstack.com/v1/eod";

// Fetch real-time prices from Marketstack API
async function fetchRealTimePrice(ticker: string): Promise<string | null> {
  try {
    // Remove exchange suffix (e.g., NVDA:US -> NVDA) as Marketstack only accepts base ticker
    const cleanTicker = ticker.split(':')[0];
    const response = await fetch(
      `${MARKETSTACK_URL}?symbols=${cleanTicker}&access_key=${MARKETSTACK_API_KEY}&limit=1`
    );

    if (!response.ok) {
      console.warn(`[Price Updater] Failed to fetch ${ticker}: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json() as any;

    // Check for API errors
    if (data.error) {
      console.warn(`[Price Updater] API Error for ${ticker}: ${data.error.info}`);
      return null;
    }

    if (!data.data || data.data.length === 0) {
      console.warn(`[Price Updater] No price data for ${ticker}`);
      return null;
    }

    const price = data.data[0].close?.toString();
    if (!price) {
      console.warn(`[Price Updater] No close price for ${ticker}`);
      return null;
    }

    return price;
  } catch (error) {
    console.error(`[Price Updater] Failed to fetch price for ${ticker}:`, error);
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

        // Add small delay to respect Marketstack rate limits
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second between requests
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

