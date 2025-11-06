import cron, { ScheduledTask } from "node-cron";
import { getAllStocks, updateStock } from "./db";
import { callDataApi } from "./_core/dataApi";

// Fetch real-time prices from Yahoo Finance API
async function fetchRealTimePrice(ticker: string): Promise<string | null> {
  try {
    // Determine region based on ticker suffix
    let region = "US";
    
    if (ticker.includes(".")) {
      const suffix = ticker.split('.')[1];
      // Map Yahoo Finance suffixes to regions
      const regionMap: Record<string, string> = {
        "SW": "CH",  // Switzerland
        "DE": "DE",  // Germany
        "L": "GB",   // London/UK
        "PA": "FR",  // Paris/France
        "CO": "DK",  // Copenhagen/Denmark
        "MI": "IT",  // Milan/Italy
      };
      region = regionMap[suffix] || "US";
    }

    const response = await callDataApi("YahooFinance/get_stock_chart", {
      query: {
        symbol: ticker,
        region: region,
        interval: "1d",
        range: "1d"
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
            const ytdStart = parseFloat(stock.ytdStartPrice || "0");
            if (ytdStart > 0 && isFinite(ytdStart)) {
              const currentPrice = parseFloat(newPrice);
              if (isFinite(currentPrice)) {
                const ytdPerformance = ((currentPrice - ytdStart) / ytdStart) * 100;
                if (isFinite(ytdPerformance)) {
                  updateData.ytdPerformance = ytdPerformance.toFixed(2);
                }
              }
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

