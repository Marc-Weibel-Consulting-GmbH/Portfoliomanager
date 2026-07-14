import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Get all distinct currency pairs and their latest rates
const [fxRows] = await conn.execute('SELECT currencyPair, rate, date FROM exchangeRates ORDER BY date DESC');
const fxMap = {};
for (const r of fxRows) {
  if (!fxMap[r.currencyPair]) {
    fxMap[r.currencyPair] = parseFloat(r.rate);
  }
}
// Add GBp
if (fxMap['GBPCHF']) fxMap['GBpCHF'] = fxMap['GBPCHF'] / 100;

console.log('=== Available FX rates ===');
Object.entries(fxMap).forEach(([k, v]) => console.log(k.padEnd(12), v.toFixed(6)));

// Get portfolio data
const [rows] = await conn.execute('SELECT portfolioData, investmentAmount FROM savedPortfolios WHERE id = 1890001');
const data = JSON.parse(rows[0].portfolioData);
const investmentAmount = parseFloat(rows[0].investmentAmount);

// Get all stocks from DB
const tickers = data.stocks.map(s => s.ticker);
const placeholders = tickers.map(() => '?').join(',');
const [stockRows] = await conn.execute(
  `SELECT ticker, currentPrice, currency, exchangeRateToChf FROM stocks WHERE ticker IN (${placeholders})`,
  tickers
);
const stockMap = {};
stockRows.forEach(s => { stockMap[s.ticker] = s; });

console.log('\n=== Portfolio value simulation ===');
console.log('Ticker'.padEnd(12), 'Curr'.padEnd(6), 'LocalPx'.padStart(10), 'FxKey'.padEnd(12), 'FxRate'.padStart(10), 'PriceCHF'.padStart(10), 'Shares'.padStart(10), 'ValueCHF'.padStart(12), 'Status');
console.log('-'.repeat(100));

let totalValueCHF = 0;

for (const stock of data.stocks) {
  const dbStock = stockMap[stock.ticker];
  if (!dbStock) { console.log(stock.ticker, '- NOT IN DB'); continue; }

  const currency = dbStock.currency || 'CHF';
  const localPrice = parseFloat(dbStock.currentPrice);
  const shares = parseFloat(stock.shares);
  const fxKey = `${currency}CHF`;
  
  let priceCHF;
  let status;
  let fxRate;

  if (currency === 'CHF') {
    priceCHF = localPrice;
    fxRate = 1;
    status = 'CHF';
  } else if (fxMap[fxKey]) {
    fxRate = fxMap[fxKey];
    priceCHF = localPrice * fxRate;
    status = 'OK';
  } else {
    // Fallback: stored exchangeRateToChf
    const storedFx = parseFloat(dbStock.exchangeRateToChf || '0');
    if (storedFx > 0) {
      fxRate = storedFx;
      priceCHF = localPrice * storedFx;
      status = 'FALLBACK';
    } else {
      fxRate = 0;
      priceCHF = 0;
      status = 'MISSING!';
    }
  }

  const valueForStock = shares * priceCHF;
  totalValueCHF += valueForStock;

  console.log(
    stock.ticker.padEnd(12),
    currency.padEnd(6),
    localPrice.toFixed(2).padStart(10),
    fxKey.padEnd(12),
    fxRate.toFixed(6).padStart(10),
    priceCHF.toFixed(2).padStart(10),
    shares.toFixed(2).padStart(10),
    valueForStock.toFixed(0).padStart(12),
    status
  );
}

console.log('\n=== Summary ===');
console.log('Total value CHF:', totalValueCHF.toFixed(2));
console.log('Investment amount:', investmentAmount);
console.log('Performance:', ((totalValueCHF - investmentAmount) / investmentAmount * 100).toFixed(2) + '%');

await conn.end();
