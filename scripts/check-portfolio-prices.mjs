import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute('SELECT portfolioData, investmentAmount FROM savedPortfolios WHERE id = 1890001');
const data = JSON.parse(rows[0].portfolioData);
const investmentAmount = parseFloat(rows[0].investmentAmount);

const tickers = data.stocks.map(s => s.ticker);
const placeholders = tickers.map(() => '?').join(',');
const [stockRows] = await conn.execute(
  `SELECT ticker, currentPrice, currency, exchangeRateToChf FROM stocks WHERE ticker IN (${placeholders})`,
  tickers
);

const stockMap = {};
stockRows.forEach(s => { stockMap[s.ticker] = s; });

let totalWithCurrentPrices = 0;
let totalWithStoredPrices = 0;

console.log('Ticker'.padEnd(12), 'Shares'.padStart(10), 'StoredCHF'.padStart(12), 'CurrentCHF'.padStart(12), 'StoredVal'.padStart(12), 'CurrentVal'.padStart(12), 'Diff%'.padStart(8));
console.log('-'.repeat(82));

for (const stock of data.stocks) {
  const dbStock = stockMap[stock.ticker];
  if (!dbStock) { console.log(stock.ticker, '- NOT IN DB'); continue; }

  const shares = parseFloat(stock.shares);
  const storedPriceCHF = parseFloat(stock.currentPrice);
  const localPrice = parseFloat(dbStock.currentPrice);
  const fxRate = parseFloat(dbStock.exchangeRateToChf || '1');
  const currentPriceCHF = localPrice * fxRate;

  const storedVal = shares * storedPriceCHF;
  const currentVal = shares * currentPriceCHF;

  totalWithStoredPrices += storedVal;
  totalWithCurrentPrices += currentVal;

  const diff = storedVal > 0 ? ((currentVal - storedVal) / storedVal * 100).toFixed(1) : 'N/A';
  if (Math.abs(parseFloat(diff)) > 1) {
    console.log(
      stock.ticker.padEnd(12),
      shares.toFixed(2).padStart(10),
      storedPriceCHF.toFixed(2).padStart(12),
      currentPriceCHF.toFixed(2).padStart(12),
      storedVal.toFixed(0).padStart(12),
      currentVal.toFixed(0).padStart(12),
      (diff + '%').padStart(8)
    );
  }
}

console.log('\nTotal with stored prices:  CHF', totalWithStoredPrices.toFixed(2));
console.log('Total with current prices: CHF', totalWithCurrentPrices.toFixed(2));
console.log('Investment amount:         CHF', investmentAmount);
console.log('Performance (stored):     ', ((totalWithStoredPrices - investmentAmount) / investmentAmount * 100).toFixed(2) + '%');
console.log('Performance (current):    ', ((totalWithCurrentPrices - investmentAmount) / investmentAmount * 100).toFixed(2) + '%');

await conn.end();
