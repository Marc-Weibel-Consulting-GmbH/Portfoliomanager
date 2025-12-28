import { drizzle } from 'drizzle-orm/mysql2';
import { stocks } from '../drizzle/schema.js';

const db = drizzle(process.env.DATABASE_URL);

async function compareYTD() {
  console.log("=== Comparing DB YTD vs Excel YTD ===\n");

  const allStocks = await db.select().from(stocks);
  
  // Calculate DB YTD
  let dbYTD = 0;
  for (const stock of allStocks) {
    const currentPrice = parseFloat(stock.currentPrice || "0");
    const ytdStartPrice = parseFloat(stock.ytdStartPrice || "0");
    const weight = parseFloat(stock.portfolioWeight || "0");
    
    if (currentPrice > 0 && ytdStartPrice > 0 && weight > 0) {
      const stockYTD = ((currentPrice - ytdStartPrice) / ytdStartPrice) * 100;
      const contribution = stockYTD * (weight / 100);
      dbYTD += contribution;
    }
  }
  
  console.log(`DB YTD Performance: ${dbYTD.toFixed(2)}%`);
  console.log(`Excel YTD Performance: 13.10%`);
  console.log(`Difference: ${(dbYTD - 13.10).toFixed(2)}%\n`);
  
  // Show first 10 stocks comparison
  console.log("First 10 stocks (DB calculation):");
  for (let i = 0; i < Math.min(10, allStocks.length); i++) {
    const stock = allStocks[i];
    const currentPrice = parseFloat(stock.currentPrice || "0");
    const ytdStartPrice = parseFloat(stock.ytdStartPrice || "0");
    const weight = parseFloat(stock.portfolioWeight || "0");
    
    if (currentPrice > 0 && ytdStartPrice > 0) {
      const stockYTD = ((currentPrice - ytdStartPrice) / ytdStartPrice) * 100;
      console.log(`${stock.ticker}: ${stockYTD.toFixed(1)}% (${currentPrice.toFixed(2)} vs ${ytdStartPrice.toFixed(2)})`);
    }
  }
  
  process.exit(0);
}

compareYTD().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
