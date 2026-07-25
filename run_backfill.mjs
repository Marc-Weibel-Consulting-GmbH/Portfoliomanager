/**
 * One-time backfill script for tickers with insufficient history.
 * Run with: node run_backfill.mjs
 * 
 * Tickers: PSK.TO, OFN.SW, BTI, DWS.DE, PST.MI, SON.LS
 * These only have data from 2024-07-12 (~500 days) but need 3+ years for backtest.
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Load environment variables
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const EODHD_API_KEY = process.env.EODHD_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!EODHD_API_KEY) {
  console.error('EODHD_API_KEY not set');
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const mysql = require('mysql2/promise');
const conn = await mysql.createConnection(DATABASE_URL);

// Ticker → EODHD symbol mapping
const TICKERS = [
  { ticker: 'PSK.TO', eodhd: 'PSK.TO' },
  { ticker: 'OFN.SW', eodhd: 'OFN.SW' },
  { ticker: 'BTI',    eodhd: 'BTI.US' },
  { ticker: 'DWS.DE', eodhd: 'DWS.XETRA' },
  { ticker: 'PST.MI', eodhd: 'PST.MI' },
  { ticker: 'SON.LS', eodhd: 'SON.LS' },
];

const FROM_DATE = '2020-01-01';
const TO_DATE = new Date().toISOString().split('T')[0];

let totalInserted = 0;

for (const { ticker, eodhd } of TICKERS) {
  // Check existing data range
  const [existing] = await conn.execute(
    'SELECT MIN(date) as minDate, MAX(date) as maxDate, COUNT(*) as cnt FROM historical_prices WHERE ticker = ?',
    [ticker]
  );
  const ex = existing[0];
  console.log(`\n[${ticker}] Existing: ${ex.cnt} rows, ${ex.minDate} → ${ex.maxDate}`);

  // Check if we already have data from 2020
  if (ex.minDate && new Date(ex.minDate) <= new Date('2020-06-01')) {
    console.log(`[${ticker}] Already has data from 2020, skipping`);
    continue;
  }

  const url = `https://eodhd.com/api/eod/${eodhd}?api_token=${EODHD_API_KEY}&fmt=json&from=${FROM_DATE}&to=${TO_DATE}`;
  console.log(`[${ticker}] Fetching from EODHD: ${eodhd}...`);
  
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error(`[${ticker}] EODHD error: ${resp.status} ${resp.statusText}`);
      continue;
    }
    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) {
      console.error(`[${ticker}] No data returned from EODHD`);
      continue;
    }
    
    console.log(`[${ticker}] Got ${data.length} price points from EODHD`);
    
    let inserted = 0;
    for (const row of data) {
      if (!row.date || row.adjusted_close == null) continue;
      try {
        const [result] = await conn.execute(
          `INSERT IGNORE INTO historical_prices (ticker, date, open, high, low, close, adjustedClose, volume) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ticker,
            row.date,
            row.open ?? null,
            row.high ?? null,
            row.low ?? null,
            row.close ?? null,
            row.adjusted_close ?? null,
            row.volume ?? null,
          ]
        );
        if (result.affectedRows > 0) inserted++;
      } catch (e) {
        // skip duplicates silently
      }
    }
    console.log(`[${ticker}] Inserted ${inserted} new rows`);
    totalInserted += inserted;
    
    // Rate limit: 500ms between tickers
    await new Promise(r => setTimeout(r, 500));
  } catch (e) {
    console.error(`[${ticker}] Error:`, e.message);
  }
}

await conn.end();
console.log(`\n✓ Backfill complete. Total inserted: ${totalInserted} rows`);
