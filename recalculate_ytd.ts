import { getAllStocks, updateStock } from './server/db';

async function recalculateYTD() {
  console.log('Recalculating YTD performance for all stocks...\n');
  
  const stocks = await getAllStocks();
  let successCount = 0;
  let skipCount = 0;
  
  for (const stock of stocks) {
    if (stock.ytdStartPrice && stock.currentPrice) {
      const ytdStart = parseFloat(stock.ytdStartPrice);
      const current = parseFloat(stock.currentPrice);
      
      if (ytdStart > 0 && current > 0) {
        const ytdPerf = ((current - ytdStart) / ytdStart) * 100;
        
        await updateStock(stock.ticker, {
          ytdPerformance: ytdPerf.toFixed(2),
        });
        
        console.log(`✓ ${stock.ticker}: ${ytdStart.toFixed(2)} → ${current.toFixed(2)} = ${ytdPerf.toFixed(2)}%`);
        successCount++;
      } else {
        console.log(`⊘ ${stock.ticker}: Invalid prices (start: ${ytdStart}, current: ${current})`);
        skipCount++;
      }
    } else {
      console.log(`⊘ ${stock.ticker}: Missing data (ytdStart: ${stock.ytdStartPrice}, current: ${stock.currentPrice})`);
      skipCount++;
    }
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Success: ${successCount}`);
  console.log(`Skipped: ${skipCount}`);
  console.log(`Total: ${stocks.length}`);
}

recalculateYTD().catch(console.error);
