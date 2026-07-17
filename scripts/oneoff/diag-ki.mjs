import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// 1. Get KI Portfolio
const [portfolios] = await conn.execute(
  "SELECT id, name, investmentAmount, portfolioType FROM savedPortfolios WHERE name LIKE '%KI Portfolio%' LIMIT 1"
);
const portfolio = portfolios[0];
console.log('Portfolio:', portfolio);

// 2. Get portfolio stocks
const [pData] = await conn.execute(
  "SELECT portfolioData FROM savedPortfolios WHERE id = ?", [portfolio.id]
);
const stocks = JSON.parse(pData[0].portfolioData).stocks;
const tickers = stocks.map(s => s.ticker);
console.log('\nTickers:', tickers.join(', '));

// 3. Get current prices and YTD from DB
const placeholders = tickers.map(() => '?').join(',');
const [stockData] = await conn.execute(
  `SELECT ticker, currentPrice, ytdPerformance, exchangeRateToChf, currency FROM stocks WHERE ticker IN (${placeholders})`,
  tickers
);

const stockMap = {};
stockData.forEach(s => { stockMap[s.ticker] = s; });

console.log('\nTicker       | currentPrice | ytdPerf  | fxRate | currency | priceCHF | buyPrice (portfolioData)');
let totalValueWeightBased = 0;
let totalValueSharesBased = 0;
const investmentAmount = parseFloat(portfolio.investmentAmount);

stocks.forEach(s => {
  const db = stockMap[s.ticker];
  if (!db) {
    console.log(`${s.ticker.padEnd(12)} | MISSING IN STOCKS TABLE`);
    return;
  }
  const fx = parseFloat(db.exchangeRateToChf) || 1;
  const currentPriceCHF = parseFloat(db.currentPrice) * fx;
  const buyPrice = parseFloat(s.avgBuyPrice || s.currentPrice || db.currentPrice);
  const buyPriceCHF = buyPrice * fx;
  const weight = parseFloat(s.weight) / 100;
  const shares = parseFloat(s.shares) || 0;
  
  // Weight-based (correct for demo)
  const alloc = investmentAmount * weight;
  const sharesWeightBased = alloc / buyPriceCHF;
  const valWeightBased = sharesWeightBased * currentPriceCHF;
  totalValueWeightBased += valWeightBased;
  
  // Shares-based (old, potentially wrong)
  const valSharesBased = shares * currentPriceCHF;
  totalValueSharesBased += valSharesBased;
  
  const ytd = db.ytdPerformance !== null ? `${parseFloat(db.ytdPerformance).toFixed(1)}%` : 'NULL';
  console.log(`${s.ticker.padEnd(12)} | ${String(db.currentPrice).padEnd(12)} | ${ytd.padEnd(8)} | ${String(fx).padEnd(6)} | ${db.currency.padEnd(8)} | ${currentPriceCHF.toFixed(2).padEnd(8)} | buyPrice=${buyPrice} shares=${shares} weight=${s.weight}%`);
});

console.log('\n=== TOTAL VALUE COMPARISON ===');
console.log(`Investment Amount:    CHF ${investmentAmount.toLocaleString('de-CH')}`);
console.log(`Weight-based total:  CHF ${totalValueWeightBased.toFixed(2)}`);
console.log(`Shares-based total:  CHF ${totalValueSharesBased.toFixed(2)}`);
console.log(`\nDifference (weight): ${((totalValueWeightBased - investmentAmount) / investmentAmount * 100).toFixed(2)}%`);
console.log(`Difference (shares): ${((totalValueSharesBased - investmentAmount) / investmentAmount * 100).toFixed(2)}%`);

// 4. Check Redis cache
console.log('\n=== YTD NULL ANALYSIS ===');
const nullYtd = stocks.filter(s => {
  const db = stockMap[s.ticker];
  return db && db.ytdPerformance === null;
});
console.log(`Stocks with NULL ytdPerformance: ${nullYtd.length}/${stocks.length}`);
nullYtd.forEach(s => console.log(`  - ${s.ticker}`));

await conn.end();
