/**
 * Force-update FX rates in the exchangeRates table.
 * Deletes today's existing rates and re-fetches them from Yahoo Finance.
 */
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const today = new Date().toISOString().split('T')[0];
const CURRENCY_PAIRS = [
  'USDCHF', 'EURCHF', 'GBPCHF',
  'CADCHF', 'JPYCHF', 'SEKCHF', 'NOKCHF', 'DKKCHF', 'AUDCHF', 'PLNCHF', 'SGDCHF', 'ILSCHF',
];

async function fetchFxRateYahoo(currencyPair) {
  try {
    const symbol = `${currencyPair}=X`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const data = await response.json();
    const quote = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return quote ? parseFloat(quote) : null;
  } catch {
    return null;
  }
}

console.log(`Updating FX rates for ${today}...`);

// Delete today's existing rates to force re-fetch
await conn.execute('DELETE FROM exchangeRates WHERE date = ?', [today]);
console.log('Deleted existing rates for today');

for (const pair of CURRENCY_PAIRS) {
  const rate = await fetchFxRateYahoo(pair);
  if (rate) {
    await conn.execute(
      'INSERT INTO exchangeRates (date, currencyPair, rate) VALUES (?, ?, ?)',
      [today, pair, rate.toString()]
    );
    console.log(`${pair}: ${rate}`);
  } else {
    console.log(`${pair}: FAILED to fetch`);
  }
  await new Promise(r => setTimeout(r, 200));
}

// Now sync stocks.exchangeRateToChf from updated rates
const [fxRows] = await conn.execute('SELECT currencyPair, rate FROM exchangeRates WHERE date = ?', [today]);
const rateMap = { CHF: 1 };
for (const r of fxRows) {
  const currency = r.currencyPair.replace('CHF', '');
  rateMap[currency] = parseFloat(r.rate);
}
if (rateMap['GBP']) rateMap['GBp'] = rateMap['GBP'] / 100;

console.log('\nSyncing stocks.exchangeRateToChf...');
for (const [currency, rate] of Object.entries(rateMap)) {
  if (currency === 'CHF') continue;
  const [result] = await conn.execute(
    'UPDATE stocks SET exchangeRateToChf = ? WHERE currency = ?',
    [rate.toString(), currency]
  );
  console.log(`${currency}: ${rate} (updated ${result.affectedRows} stocks)`);
}

// Verify
console.log('\n=== Verification: Updated FX rates ===');
const [verifyRows] = await conn.execute('SELECT currencyPair, rate FROM exchangeRates WHERE date = ? ORDER BY currencyPair', [today]);
for (const r of verifyRows) {
  console.log(r.currencyPair.padEnd(12), parseFloat(r.rate).toFixed(6));
}

await conn.end();
console.log('\nDone!');
