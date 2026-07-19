import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const mysql = require('mysql2/promise');

const PAIRS_TO_BACKFILL = ['NOKCHF', 'CADCHF'];
const START_DATE = '2020-01-01';

const conn = await mysql.createConnection(process.env.DATABASE_URL || '');

for (const pair of PAIRS_TO_BACKFILL) {
  console.log(`Backfilling ${pair} from ${START_DATE}...`);
  const symbol = `${pair}=X`;
  const ts1 = Math.floor(new Date(START_DATE).getTime() / 1000);
  const ts2 = Math.floor(new Date().getTime() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${ts1}&period2=${ts2}&interval=1d`;
  
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!resp.ok) { console.error(`Failed: ${resp.status} for ${url}`); continue; }
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
      } catch(e) { console.error('Insert error:', e.message); }
    }
    console.log(`${pair}: inserted ${inserted} rates from ${timestamps.length} timestamps`);
  } catch(e) {
    console.error(`Error for ${pair}:`, e.message);
  }
}

await conn.end();
console.log('Done!');
