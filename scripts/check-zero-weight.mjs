import { drizzle } from 'drizzle-orm/mysql2';
import { stocks } from '../drizzle/schema.js';

const db = drizzle(process.env.DATABASE_URL);
const allStocks = await db.select().from(stocks);

const zeroWeight = allStocks.filter(s => parseFloat(s.portfolioWeight || '0') === 0);
const nonZeroWeight = allStocks.filter(s => parseFloat(s.portfolioWeight || '0') > 0);

console.log('Total stocks:', allStocks.length);
console.log('Stocks with weight > 0:', nonZeroWeight.length);
console.log('Stocks with weight = 0:', zeroWeight.length);

if (zeroWeight.length > 0) {
  console.log('\nStocks with 0% weight:');
  zeroWeight.forEach(s => console.log('  -', s.ticker, ':', s.portfolioWeight));
}

// Calculate YTD for non-zero weight stocks only
let ytdNonZero = 0;
let totalWeightNonZero = 0;

for (const stock of nonZeroWeight) {
  const currentPrice = parseFloat(stock.currentPrice || "0");
  const ytdStartPrice = parseFloat(stock.ytdStartPrice || "0");
  const weight = parseFloat(stock.portfolioWeight || "0");

  if (currentPrice > 0 && ytdStartPrice > 0 && weight > 0) {
    const stockYTD = ((currentPrice - ytdStartPrice) / ytdStartPrice) * 100;
    const weightedContribution = stockYTD * (weight / 100);
    ytdNonZero += weightedContribution;
    totalWeightNonZero += weight;
  }
}

console.log(`\nYTD for stocks with weight > 0: ${ytdNonZero.toFixed(2)}%`);
console.log(`Total weight (non-zero): ${totalWeightNonZero.toFixed(2)}%`);

process.exit(0);
