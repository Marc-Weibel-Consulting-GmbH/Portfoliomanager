import { getStockByTicker, updateStock } from './server/db';
import * as fs from 'fs';

async function importCurrentPrices() {
  console.log('Importing current prices from CSV...\n');
  
  const csvContent = fs.readFileSync('/home/ubuntu/current_prices.csv', 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  let successCount = 0;
  let notFoundCount = 0;
  
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const [ticker, price, company] = lines[i].split(',').map(v => v.trim());
    
    if (!ticker || !price) continue;
    
    try {
      const stock = await getStockByTicker(ticker);
      
      if (!stock) {
        console.log(`⊘ ${ticker}: Not found in portfolio`);
        notFoundCount++;
        continue;
      }
      
      const newPrice = parseFloat(price);
      if (isNaN(newPrice)) {
        console.log(`⊘ ${ticker}: Invalid price: ${price}`);
        continue;
      }
      
      await updateStock(ticker, {
        currentPrice: newPrice.toString(),
      });
      
      // Calculate YTD if we have start price
      if (stock.ytdStartPrice) {
        const ytdStart = parseFloat(stock.ytdStartPrice);
        const ytdPerf = ((newPrice - ytdStart) / ytdStart) * 100;
        await updateStock(ticker, {
          ytdPerformance: ytdPerf.toFixed(2),
        });
        console.log(`✓ ${ticker}: ${ytdStart.toFixed(2)} → ${newPrice.toFixed(2)} = ${ytdPerf.toFixed(2)}%`);
      } else {
        console.log(`✓ ${ticker}: ${newPrice.toFixed(2)} (no YTD start price)`);
      }
      
      successCount++;
    } catch (error: any) {
      console.log(`✗ ${ticker}: ${error.message}`);
    }
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Success: ${successCount}`);
  console.log(`Not found: ${notFoundCount}`);
  console.log(`Total: ${lines.length - 1}`);
}

importCurrentPrices().catch(console.error);
