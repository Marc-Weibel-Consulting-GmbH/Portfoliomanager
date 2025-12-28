import { callDataApi } from './server/_core/dataApi';
import { getAllStocks, updateStock } from './server/db';

async function fetchYTDStartPrices() {
  console.log('Fetching YTD start prices for all stocks...\n');
  
  const stocks = await getAllStocks();
  let successCount = 0;
  let failCount = 0;
  
  // Target date: 2024-12-31
  const targetDate = new Date('2024-12-31');
  const period1 = Math.floor(new Date('2024-12-20').getTime() / 1000);
  const period2 = Math.floor(new Date('2025-01-10').getTime() / 1000);
  
  for (const stock of stocks) {
    try {
      // Skip if already has YTD start price
      if (stock.ytdStartPrice && parseFloat(stock.ytdStartPrice) > 0) {
        console.log(`✓ ${stock.ticker} - Already has YTD start price: ${stock.ytdStartPrice}`);
        successCount++;
        continue;
      }
      
      // Wait 2 seconds to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log(`Fetching ${stock.ticker}...`);
      
      // Fetch historical data
      const response: any = await callDataApi('YahooFinance/chart', {
        query: { 
          symbols: stock.ticker,
          period1,
          period2,
          interval: '1d'
        },
      });
      
      if (response?.chart?.result?.[0]?.timestamp) {
        const result = response.chart.result[0];
        const timestamps = result.timestamp;
        const closes = result.indicators?.quote?.[0]?.close || [];
        
        // Find the closest date to 2024-12-31
        let closestPrice = null;
        let closestDiff = Infinity;
        
        for (let i = 0; i < timestamps.length; i++) {
          const date = new Date(timestamps[i] * 1000);
          const diff = Math.abs(date.getTime() - targetDate.getTime());
          
          if (diff < closestDiff && closes[i]) {
            closestDiff = diff;
            closestPrice = closes[i];
          }
        }
        
        if (closestPrice) {
          await updateStock(stock.ticker, {
            ytdStartPrice: closestPrice.toString(),
          });
          
          // Calculate YTD performance if current price exists
          if (stock.currentPrice) {
            const currentPrice = parseFloat(stock.currentPrice);
            const ytdPerf = ((currentPrice - closestPrice) / closestPrice) * 100;
            await updateStock(stock.ticker, {
              ytdPerformance: ytdPerf.toFixed(2),
            });
            console.log(`✓ ${stock.ticker} - YTD start: ${closestPrice.toFixed(2)}, Current: ${currentPrice.toFixed(2)}, Performance: ${ytdPerf.toFixed(2)}%`);
          } else {
            console.log(`✓ ${stock.ticker} - YTD start: ${closestPrice.toFixed(2)}`);
          }
          successCount++;
        } else {
          console.log(`✗ ${stock.ticker} - No price data found`);
          failCount++;
        }
      } else {
        console.log(`✗ ${stock.ticker} - API returned no data`);
        failCount++;
      }
    } catch (error: any) {
      console.log(`✗ ${stock.ticker} - Error: ${error.message}`);
      failCount++;
      
      if (error.message?.includes('429') || error.message?.includes('rate limit')) {
        console.log('\n⚠️  Rate limit hit. Stopping...');
        break;
      }
    }
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Total: ${stocks.length}`);
}

fetchYTDStartPrices().catch(console.error);
