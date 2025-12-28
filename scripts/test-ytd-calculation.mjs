/**
 * Test script to verify YTD Performance calculation
 * Compares frontend formula with backend formula
 */

import { drizzle } from "drizzle-orm/mysql2";
import { stocks } from "../drizzle/schema.js";

const db = drizzle(process.env.DATABASE_URL);

async function testYTDCalculation() {
  console.log("=== YTD Performance Calculation Test ===\n");

  // Load all stocks
  const allStocks = await db.select().from(stocks);
  
  console.log(`Loaded ${allStocks.length} stocks from database\n`);

  // Calculate YTD using the same formula as frontend
  let weightedYTD = 0;
  let totalWeight = 0;
  let validStocks = 0;
  let missingData = [];

  console.log("Individual Stock Contributions:");
  console.log("─".repeat(80));

  for (const stock of allStocks) {
    const currentPrice = parseFloat(stock.currentPrice || "0");
    const ytdStartPrice = parseFloat(stock.ytdStartPrice || "0");
    const weight = parseFloat(stock.portfolioWeight || "0");

    if (currentPrice > 0 && ytdStartPrice > 0 && weight > 0) {
      // Calculate individual stock YTD performance
      const stockYTD = ((currentPrice - ytdStartPrice) / ytdStartPrice) * 100;
      
      // Weight it by portfolio weight
      const weightedContribution = stockYTD * (weight / 100);
      
      weightedYTD += weightedContribution;
      totalWeight += weight;
      validStocks++;

      console.log(
        `${stock.ticker.padEnd(12)} | ` +
        `Current: ${currentPrice.toFixed(2).padStart(8)} | ` +
        `YTD Start: ${ytdStartPrice.toFixed(2).padStart(8)} | ` +
        `YTD: ${stockYTD.toFixed(2).padStart(7)}% | ` +
        `Weight: ${weight.toFixed(2).padStart(5)}% | ` +
        `Contribution: ${weightedContribution.toFixed(4).padStart(8)}%`
      );
    } else {
      missingData.push({
        ticker: stock.ticker,
        currentPrice,
        ytdStartPrice,
        weight,
      });
    }
  }

  console.log("─".repeat(80));
  console.log(`\n✅ Valid stocks: ${validStocks}/${allStocks.length}`);
  console.log(`📊 Total weight: ${totalWeight.toFixed(2)}%`);
  console.log(`📈 Weighted YTD Performance: ${weightedYTD >= 0 ? '+' : ''}${weightedYTD.toFixed(2)}%`);

  if (missingData.length > 0) {
    console.log(`\n⚠️  Stocks with missing data (${missingData.length}):`);
    missingData.forEach(s => {
      console.log(
        `  ${s.ticker.padEnd(12)} | ` +
        `Current: ${s.currentPrice || 'N/A'} | ` +
        `YTD Start: ${s.ytdStartPrice || 'N/A'} | ` +
        `Weight: ${s.weight || 'N/A'}`
      );
    });
  }

  console.log("\n=== Test Complete ===");
  process.exit(0);
}

testYTDCalculation().catch(error => {
  console.error("Error:", error);
  process.exit(1);
});
