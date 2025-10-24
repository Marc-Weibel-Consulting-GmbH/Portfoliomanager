import cron, { ScheduledTask } from "node-cron";
import { getAllStocks, updateStock } from "./db";
import { callDataApi } from "./_core/dataApi";

// Fetch historical chart data from Yahoo Finance
async function fetchChartData(ticker: string): Promise<any[] | null> {
  try {
    // Determine region based on ticker suffix
    let region = "US";
    
    if (ticker.includes(".")) {
      const suffix = ticker.split('.')[1];
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

    // Get last 30 days of data for better chart visualization
    const response = await callDataApi("YahooFinance/get_stock_chart", {
      query: {
        symbol: ticker,
        region: region,
        interval: "1d",
        range: "1mo" // Last 1 month
      }
    }) as any;

    if (!response || !response.chart || !response.chart.result || response.chart.result.length === 0) {
      console.warn(`[Chart Updater] No chart data for ${ticker}`);
      return null;
    }

    const result = response.chart.result[0];
    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];

    if (!timestamps || !quotes || timestamps.length === 0) {
      console.warn(`[Chart Updater] No valid chart data for ${ticker}`);
      return null;
    }

    // Transform data for chart display
    const chartData = timestamps.map((timestamp: number, index: number) => ({
      date: new Date(timestamp * 1000).toISOString().split('T')[0], // Convert to YYYY-MM-DD
      open: quotes.open[index] || 0,
      high: quotes.high[index] || 0,
      low: quotes.low[index] || 0,
      close: quotes.close[index] || 0,
      volume: quotes.volume[index] || 0,
    }));

    return chartData;
  } catch (error) {
    console.error(`[Chart Updater] Failed to fetch chart data for ${ticker}:`, error);
    return null;
  }
}

export async function startChartDataUpdater() {
  // Schedule task to run every 4 hours
  const task = cron.schedule("0 */4 * * *", async () => {
    console.log(`[${new Date().toISOString()}] Starting chart data update...`);

    try {
      const stocks = await getAllStocks();

      if (!stocks || stocks.length === 0) {
        console.log("No stocks found to update chart data");
        return;
      }

      let updatedCount = 0;
      let failedCount = 0;

      for (const stock of stocks) {
        try {
          const chartData = await fetchChartData(stock.ticker);

          if (chartData && chartData.length > 0) {
            // Store chart data as JSON string
            await updateStock(stock.ticker, {
              chartData: JSON.stringify(chartData),
            });
            updatedCount++;
            console.log(`✓ Updated chart data for ${stock.ticker} (${chartData.length} days)`);
          } else {
            failedCount++;
            console.warn(`✗ Failed to update chart data for ${stock.ticker}`);
          }
        } catch (error) {
          failedCount++;
          console.error(`Error updating chart data for ${stock.ticker}:`, error);
        }

        // Add small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(
        `[${new Date().toISOString()}] Chart data update completed. Updated: ${updatedCount}, Failed: ${failedCount}`
      );
    } catch (error) {
      console.error("Chart data updater error:", error);
    }
  });

  console.log("[Chart Data Updater] ENABLED - Using Yahoo Finance API (free)");
  console.log("[Chart Data Updater] Cron schedule: Every 4 hours");
  task.start();

  return task;
}

export function stopChartDataUpdater(task: ScheduledTask) {
  task.stop();
  console.log("[Chart Data Updater] Stopped");
}

