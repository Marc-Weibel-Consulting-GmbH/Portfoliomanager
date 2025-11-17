import { getAllStocks, updateStock } from './server/db';
import { callDataApi } from './server/_core/dataApi';

async function updateCurrentPrices() {
  console.log('Updating current prices for all stocks...\n');
  
  const stocks = await getAllStocks();
  let successCount = 0;
  let failCount = 0;
  
  for (const stock of stocks) {
    try {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      
      console.log(`Fetching ${stock.ticker}...`);
      
      const response: any = await callDataApi('YahooFinance/quote', {
        query: { symbols: stock.ticker },
      });
      
      if (response?.quoteResponse?.result?.[0]) {
        const quote = response.quoteResponse.result[0];
        const newPrice = quote.regularMarketPrice;
        
        if (newPrice) {
          await updateStock(stock.ticker, {
            currentPrice: newPrice.toString(),
          });
          
          // Recalculate YTD if we have start price
          if (stock.ytdStartPrice) {
            const ytdStart = parseFloat(stock.ytdStartPrice);
            const ytdPerf = ((newPrice - ytdStart) / ytdStart) * 100;
            await updateStock(stock.ticker, {
              ytdPerformance: ytdPerf.toFixed(2),
            });
            console.log(`✓ ${stock.ticker}: ${newPrice.toFixed(2)} (YTD: ${ytdPerf.toFixed(2)}%)`);
          } else {
            console.log(`✓ ${stock.ticker}: ${newPrice.toFixed(2)}`);
          }
          successCount++;
        }
      } else {
        console.log(`✗ ${stock.ticker}: No data`);
        failCount++;
      }
    } catch (error: any) {
      console.log(`✗ ${stock.ticker}: ${error.message}`);
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

updateCurrentPrices().catch(console.error);
