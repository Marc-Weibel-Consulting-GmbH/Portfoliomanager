import cron, { ScheduledTask } from "node-cron";
import { getAllStocks, updateStock } from "./db";
import { callDataApi } from "./_core/dataApi";

// Fetch real-time prices from Yahoo Finance API
async function fetchRealTimePrice(ticker: string): Promise<string | null> {
  try {
    // Remove exchange suffix (e.g., NVDA:US -> NVDA) as Yahoo Finance accepts base ticker
    const cleanTicker = ticker.split(':')[0];
    
    // Determine region based on ticker suffix or default to US
    let region = "US";
    if (ticker.includes(":")) {
      const suffix = ticker.split(':')[1];
      // Map common suffixes to Yahoo Finance regions
      const regionMap: Record<string, string> = {
        "US": "US",
        "SW": "CH", // Switzerland
        "DE": "DE", // Germany
        "UK": "GB", // United Kingdom
        "CA": "CA", // Canada
        "AU": "AU", // Australia
      };
      region = regionMap[suffix] || "US";
    }

    const response = await callDataApi("YahooFinance/get_stock_chart", {
      query: {
        symbol: cleanTicker,
        region: region,
        interval: "1d",
        range: "1d",
        includeAdjustedClose: true
      }
    }) as any;

    if (!response || !response.chart || !response.chart.result || response.chart.result.length === 0) {
      console.warn(`[Price Updater] No data returned for ${ticker}`);
      return null;
    }

    const result = response.chart.result[0];
    const meta = result.meta;

    // Get the current price from meta (most recent price)
    const currentPrice = meta.regularMarketPrice;

    if (!currentPrice) {
      console.warn(`[Price Updater] No current price for ${ticker}`);
      return null;
    }

    return currentPrice.toString();
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

