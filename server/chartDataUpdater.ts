import cron, { ScheduledTask } from "node-cron";
import { getAllStocks, updateStock } from "./db";

const MARKETSTACK_API_KEY = process.env.MARKETSTACK_API_KEY || "59fa6788029f8094ee4eee81cea9700f";
const MARKETSTACK_URL = "http://api.marketstack.com/v1/eod";

// Fetch historical chart data from Marketstack
async function fetchChartData(ticker: string): Promise<any[] | null> {
  try {
    // Get last 30 days of data for better chart visualization
    const response = await fetch(
      `${MARKETSTACK_URL}?symbols=${ticker}&access_key=${MARKETSTACK_API_KEY}&limit=30&sort=ASC`
    );

    if (!response.ok) {
      console.warn(`[Chart Updater] Failed to fetch chart data for ${ticker}: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json() as any;

    if (data.error) {
      console.warn(`[Chart Updater] API Error for ${ticker}: ${data.error.info}`);
      return null;
    }

    if (!data.data || data.data.length === 0) {
      console.warn(`[Chart Updater] No chart data for ${ticker}`);
      return null;
    }

    // Transform data for chart display
    const chartData = data.data.map((item: any) => ({
      date: item.date,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
    }));

    return chartData;
  } catch (error) {
    console.error(`[Chart Updater] Failed to fetch chart data for ${ticker}:`, error);
    return null;
  }
}

export async function startChartDataUpdater() {
  // DISABLED: Marketstack API calls to save costs
  // Schedule task to run every 4 hours
  const task = cron.schedule("0 */4 * * *", async () => {
    console.log(`[${new Date().toISOString()}] Chart data update DISABLED to save API costs`);
    return; // Early return to skip API calls
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

        // Add small delay to respect Marketstack rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(
        `[${new Date().toISOString()}] Chart data update completed. Updated: ${updatedCount}, Failed: ${failedCount}`
      );
    } catch (error) {
      console.error("Chart data updater error:", error);
    }
  });

  console.log("[Chart Data Updater] Initialized. First update will run in 4 hours.");
  console.log("[Chart Data Updater] Cron schedule: Every 4 hours");

  return task;
}

export function stopChartDataUpdater(task: ScheduledTask) {
  task.stop();
  console.log("[Chart Data Updater] Stopped");
}
