/**
 * Simulate the getWithCurrency FX conversion to find why totalValueCHF = 218,079
 * instead of 250,000.
 */
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

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

// Get exchange rates (like tryConvertToCHF does)
const todayStr = new Date().toISOString().split('T')[0];
const [fxRows] = await conn.execute(
  'SELECT fromCurrency, toCurrency, rate, date FROM exchangeRates ORDER BY date DESC'
);

// Build FX rate map (same as tryConvertToCHF)
const fxMap = {};
for (const row of fxRows) {
  const key = `${row.fromCurrency}CHF`;
  if (!fxMap[key]) fxMap[key] = parseFloat(row.rate);
}
// Add GBp special case
if (fxMap['GBPCHF']) {
  fxMap['GBpCHF'] = fxMap['GBPCHF'] / 100;
}

console.log('Available FX rates:', Object.keys(fxMap).join(', '));
console.log('');

function tryConvertToCHF(price, currency) {
  if (currency === 'CHF') return price;
  const key = `${currency}CHF`;
  if (fxMap[key]) return price * fxMap[key];
  return null; // missing!
}

let totalValueCHF = 0;
let missingFxCount = 0;

console.log('Ticker'.padEnd(12), 'Currency'.padEnd(8), 'LocalPrice'.padStart(12), 'FxRate'.padStart(10), 'PriceCHF'.padStart(12), 'Shares'.padStart(10), 'ValueCHF'.padStart(12), 'Status'.padStart(10));
console.log('-'.repeat(90));

for (const stock of data.stocks) {
  const dbStock = stockMap[stock.ticker];
  if (!dbStock) { console.log(stock.ticker, '- NOT IN DB'); continue; }

  const currency = dbStock.currency || 'CHF';
  const localPrice = parseFloat(dbStock.currentPrice);
  const shares = parseFloat(stock.shares);

  const converted = tryConvertToCHF(localPrice, currency);
  let priceCHF;
  let status;

  if (converted !== null) {
    priceCHF = converted;
    status = 'OK';
  } else {
    // Fallback: use stored exchangeRateToChf
    const storedFx = parseFloat(dbStock.exchangeRateToChf || '0');
    if (storedFx > 0) {
      priceCHF = localPrice * storedFx;
      status = 'FALLBACK';
    } else {
      priceCHF = 0;
      status = 'MISSING!';
      missingFxCount++;
    }
  }

  const fxRate = localPrice > 0 ? priceCHF / localPrice : 0;
  const valueForStock = shares * priceCHF;
  totalValueCHF += valueForStock;

  if (status !== 'OK' || Math.abs(valueForStock - parseFloat(stock.totalValue)) > 100) {
    console.log(
      stock.ticker.padEnd(12),
      currency.padEnd(8),
      localPrice.toFixed(2).padStart(12),
      fxRate.toFixed(6).padStart(10),
      priceCHF.toFixed(2).padStart(12),
      shares.toFixed(2).padStart(10),
      valueForStock.toFixed(0).padStart(12),
      status.padStart(10)
    );
  }
}

console.log('\n=== Summary ===');
console.log('Total value CHF:', totalValueCHF.toFixed(2));
console.log('Investment amount:', investmentAmount);
console.log('Performance:', ((totalValueCHF - investmentAmount) / investmentAmount * 100).toFixed(2) + '%');
console.log('Missing FX rates:', missingFxCount);

await conn.end();
