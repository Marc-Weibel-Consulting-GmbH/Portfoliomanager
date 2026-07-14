/**
 * Manually sync stocks.exchangeRateToChf from the latest exchangeRates entries.
 * Uses DESC order to get the most recent rates first.
 */
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Get latest rates (DESC = newest first), limit 500 to cover all pairs
const [fxRows] = await conn.execute(
  'SELECT currencyPair, rate, date FROM exchangeRates ORDER BY date DESC LIMIT 500'
);

const rateMap = { CHF: 1 };
const seen = new Set();
for (const r of fxRows) {
  if (!seen.has(r.currencyPair)) {
    seen.add(r.currencyPair);
    const currency = r.currencyPair.replace('CHF', '');
    rateMap[currency] = parseFloat(r.rate);
  }
}
if (rateMap['GBP']) rateMap['GBp'] = rateMap['GBP'] / 100;
if (!rateMap['ILS']) rateMap['ILS'] = 0.27;

console.log('FX rates to sync:', JSON.stringify(rateMap, null, 2));

for (const [currency, rate] of Object.entries(rateMap)) {
  if (currency === 'CHF') continue;
  const [result] = await conn.execute(
    'UPDATE stocks SET exchangeRateToChf = ? WHERE currency = ?',
    [rate.toString(), currency]
  );
  console.log(`${currency}: ${rate} (updated ${result.affectedRows} stocks)`);
}

// Ensure CHF stocks always have rate 1
await conn.execute('UPDATE stocks SET exchangeRateToChf = 1 WHERE currency = ?', ['CHF']);

console.log('\nDone! Verifying USD stocks:');
const [usdStocks] = await conn.execute(
  'SELECT ticker, currency, currentPrice, exchangeRateToChf FROM stocks WHERE currency = ? LIMIT 3',
  ['USD']
);
usdStocks.forEach(s => console.log(s.ticker, 'USD', parseFloat(s.currentPrice).toFixed(2), 'fxRate:', parseFloat(s.exchangeRateToChf).toFixed(6)));

await conn.end();
