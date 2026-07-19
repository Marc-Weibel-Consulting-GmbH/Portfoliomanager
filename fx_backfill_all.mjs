import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const mysql = require('mysql2/promise');

// All currency pairs that need historical data from 2020
const PAIRS_MISSING_HISTORY = ['ILSCHF', 'PLNCHF', 'DKKCHF', 'SEKCHF', 'AUDCHF', 'JPYCHF', 'SGDCHF'];
const START_DATE = '2020-01-01';
const conn = await mysql.createConnection(process.env.DATABASE_URL || '');

for (const pair of PAIRS_MISSING_HISTORY) {
  // Check existing range
  const [existing] = await conn.execute(
    'SELECT MIN(date) as minDate, COUNT(*) as cnt FROM exchangeRates WHERE currencyPair = ?',
    [pair]
  );
  const ex = existing[0];
  if (ex.minDate && new Date(ex.minDate) <= new Date('2020-06-01')) {
    console.log(`${pair}: already has data from 2020 (${ex.cnt} rows), skipping`);
    continue;
  }
  
  console.log(`Backfilling ${pair} from ${START_DATE}...`);
  const symbol = `${pair}=X`;
  const ts1 = Math.floor(new Date(START_DATE).getTime() / 1000);
  const ts2 = Math.floor(new Date().getTime() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${ts1}&period2=${ts2}&interval=1d`;
  
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!resp.ok) { 
      console.error(`${pair}: HTTP ${resp.status}`); 
      continue; 
    }
    const data = await resp.json();
    const timestamps = data?.chart?.result?.[0]?.timestamp ?? [];
    const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    
    let inserted = 0;
    for (let i = 0; i < timestamps.length; i++) {
      const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
      const rate = closes[i];
      if (!rate || !isFinite(rate)) continue;
      try {
        await conn.execute(
          'INSERT IGNORE INTO exchangeRates (date, currencyPair, rate) VALUES (?, ?, ?)',
          [date, pair, rate.toFixed(6)]
        );
        inserted++;
      } catch(e) { /* ignore */ }
    }
    console.log(`${pair}: inserted ${inserted} rates`);
    await new Promise(r => setTimeout(r, 300));
  } catch(e) {
    console.error(`${pair}: Error - ${e.message}`);
  }
}

await conn.end();
console.log('FX backfill done!');
