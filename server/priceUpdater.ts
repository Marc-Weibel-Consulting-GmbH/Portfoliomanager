import cron, { ScheduledTask } from "node-cron";
import { getAllStocks, updateStock } from "./db";

const ALPHAVANTAGE_API_KEY = process.env.ALPHAVANTAGE_API_KEY || "J2PHNBNIR5TX1T7V";
const ALPHAVANTAGE_URL = "https://www.alphavantage.co/query";

// Fetch real-time prices from Alpha Vantage API
async function fetchRealTimePrice(ticker: string): Promise<string | null> {
  try {
    // Remove exchange suffix for API call (e.g., NVDA:US -> NVDA)
    const cleanTicker = ticker.split(":")[0];
    
    const response = await fetch(
      `${ALPHAVANTAGE_URL}?function=GLOBAL_QUOTE&symbol=${cleanTicker}&apikey=${ALPHAVANTAGE_API_KEY}`
    );

    if (!response.ok) {
      console.warn(`[Price Updater] Failed to fetch ${ticker}: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json() as any;

    // Check for API errors or rate limiting
    if (data["Error Message"]) {
      console.warn(`[Price Updater] API Error for ${ticker}: ${data["Error Message"]}`);
      return null;
    }

    if (data["Note"]) {
      console.warn(`[Price Updater] API Rate Limit: ${data["Note"]}`);
      return null;
    }

    const globalQuote = data["Global Quote"];
    if (!globalQuote || !globalQuote["05. price"]) {
      console.warn(`[Price Updater] No price data for ${ticker}`);
      return null;
    }

    const price = globalQuote["05. price"];
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

        // Add delay to respect Alpha Vantage rate limits (5 requests per minute for free tier)
        await new Promise(resolve => setTimeout(resolve, 12000)); // 12 seconds between requests
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

