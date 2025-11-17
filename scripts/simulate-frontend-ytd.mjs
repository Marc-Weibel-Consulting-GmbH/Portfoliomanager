import { drizzle } from 'drizzle-orm/mysql2';
import { stocks } from '../drizzle/schema.js';

const db = drizzle(process.env.DATABASE_URL);

async function simulateFrontendYTD() {
  console.log("=== Simulating Frontend YTD Calculation ===\n");

  const allStocks = await db.select().from(stocks);
  
  // Simulate frontend calculation (from Home.tsx lines 1947-1956)
  let ytdPerf = 0;
  let validStocks = 0;
  
  for (const stock of allStocks) {
    const currentPrice = parseFloat(stock.currentPrice || "0");
    const ytdStartPrice = parseFloat(stock.ytdStartPrice || "0");
    const weight = parseFloat(stock.portfolioWeight || "0");
    
    if (currentPrice > 0 && ytdStartPrice > 0 && weight > 0) {
      const stockYTD = ((currentPrice - ytdStartPrice) / ytdStartPrice) * 100;
      const contribution = stockYTD * (weight / 100);
      ytdPerf += contribution;
      validStocks++;
      
      // Debug first 5 stocks
      if (validStocks <= 5) {
        console.log(`${stock.ticker}: ${stockYTD.toFixed(2)}% × ${weight.toFixed(2)}% = ${contribution.toFixed(4)}%`);
      }
    }
  }
  
  console.log(`\n... (${validStocks - 5} more stocks)\n`);
  console.log(`Total stocks processed: ${validStocks}/${allStocks.length}`);
  console.log(`Frontend YTD Performance: ${ytdPerf >= 0 ? '+' : ''}${ytdPerf.toFixed(1)}%`);
  console.log(`Expected (from test-ytd-calculation.mjs): +39.25%`);
  
  if (Math.abs(ytdPerf - 39.25) < 1) {
    console.log('\n✅ Frontend calculation matches expected value!');
  } else {
    console.log(`\n⚠️  MISMATCH! Difference: ${(ytdPerf - 39.25).toFixed(2)}%`);
  }
  
  process.exit(0);
}

simulateFrontendYTD().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
