import { getAllStocks, updateStock } from "./server/db.js";
import { callDataApi } from "./server/_core/dataApi.js";

async function fetchRealTimePrice(ticker, region = "US") {
  try {
    const response = await callDataApi("YahooFinance/get_stock_chart", {
      query: {
        symbol: ticker,
        region: region,
        interval: "1d",
        range: "1d"
      }
    });

    if (!response || !response.chart || !response.chart.result || response.chart.result.length === 0) {
      return null;
    }

    const result = response.chart.result[0];
    const meta = result.meta;
    const currentPrice = meta.regularMarketPrice;

    if (!currentPrice) {
      return null;
    }

    return currentPrice.toString();
  } catch (error) {
    console.error(`Failed to fetch price for ${ticker}:`, error.message);
    return null;
  }
}

async function manualPriceUpdate() {
  console.log('Starting manual price update...');
  console.log('='.repeat(80));
  
  const stocks = await getAllStocks();
  
  let updatedCount = 0;
  let failedCount = 0;
  
  for (const stock of stocks) {
    try {
      // Determine region
      let region = "US";
      if (stock.ticker.includes(".")) {
        const suffix = stock.ticker.split('.')[1];
        const regionMap = {
          "SW": "CH", "DE": "DE", "L": "GB", 
          "PA": "FR", "CO": "DK", "MI": "IT"
        };
        region = regionMap[suffix] || "US";
      }
      
      const newPrice = await fetchRealTimePrice(stock.ticker, region);
      
      if (newPrice) {
        const updateData = {
          currentPrice: newPrice,
        };
        
        // Set YTD start price if not set
        if (!stock.ytdStartPrice || parseFloat(stock.ytdStartPrice) === 0) {
          updateData.ytdStartPrice = newPrice;
          console.log(`→ Set YTD start for ${stock.ticker}: ${newPrice}`);
        }
        
        // Calculate YTD performance
        const ytdStart = parseFloat(stock.ytdStartPrice || newPrice);
        if (ytdStart > 0) {
          const ytdPerformance = ((parseFloat(newPrice) - ytdStart) / ytdStart) * 100;
          updateData.ytdPerformance = ytdPerformance.toFixed(2);
        }
        
        await updateStock(stock.ticker, updateData);
        updatedCount++;
        console.log(`✓ ${stock.ticker.padEnd(15)} - ${newPrice} ${stock.currency}`);
      } else {
        failedCount++;
        console.log(`✗ ${stock.ticker.padEnd(15)} - Failed`);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
      
    } catch (error) {
      failedCount++;
      console.error(`Error updating ${stock.ticker}:`, error.message);
    }
  }
  
  console.log('='.repeat(80));
  console.log(`Completed: ${updatedCount} updated, ${failedCount} failed`);
}

manualPriceUpdate().catch(console.error);
