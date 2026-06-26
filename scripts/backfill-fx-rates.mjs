/**
 * FX Backfill Script
 * Fetches historical FX rates (USDCHF, EURCHF, GBPCHF) from EODHD API
 * and inserts them into the exchangeRates table.
 * 
 * Run with: node scripts/backfill-fx-rates.mjs
 */

import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
const EODHD_API_KEY = process.env.EODHD_API_KEY;

if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }
if (!EODHD_API_KEY) { console.error('EODHD_API_KEY not set'); process.exit(1); }

const PAIRS = ['USDCHF', 'EURCHF', 'GBPCHF'];
const FROM_DATE = '2020-01-01';
const TO_DATE = new Date().toISOString().split('T')[0];

async function fetchFxData(pair) {
  const url = `https://eodhd.com/api/eod/${pair}.FOREX?from=${FROM_DATE}&to=${TO_DATE}&api_token=${EODHD_API_KEY}&fmt=json`;
  console.log(`Fetching ${pair} from ${FROM_DATE} to ${TO_DATE}...`);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`EODHD API error: ${resp.status} ${resp.statusText}`);
  const data = await resp.json();
  console.log(`  → ${data.length} data points received`);
  return data;
}

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);
  
  try {
    // Check existing data range
    const [existing] = await conn.execute(
      'SELECT currencyPair, MIN(date) as earliest, MAX(date) as latest, COUNT(*) as cnt FROM exchangeRates GROUP BY currencyPair'
    );
    console.log('\nExisting data:');
    existing.forEach(r => console.log(`  ${r.currencyPair}: ${r.earliest?.toISOString?.()?.split('T')[0] || r.earliest} → ${r.latest?.toISOString?.()?.split('T')[0] || r.latest} (${r.cnt} rows)`));
    
    let totalInserted = 0;
    let totalSkipped = 0;
    
    for (const pair of PAIRS) {
      const data = await fetchFxData(pair);
      
      if (!data || data.length === 0) {
        console.log(`  No data for ${pair}, skipping.`);
        continue;
      }
      
      // Batch insert in chunks of 500
      const chunkSize = 500;
      let inserted = 0;
      let skipped = 0;
      
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        
        // Use INSERT IGNORE to skip existing rows
        const values = chunk.map(row => {
          const dateStr = row.date; // already YYYY-MM-DD
          const rate = row.close;
          return [dateStr, pair, String(rate)];
        });
        
        if (values.length === 0) continue;
        
        const placeholders = values.map(() => '(?, ?, ?)').join(', ');
        const flatValues = values.flat();
        
        const [result] = await conn.execute(
          `INSERT IGNORE INTO exchangeRates (date, currencyPair, rate) VALUES ${placeholders}`,
          flatValues
        );
        
        inserted += result.affectedRows;
        skipped += values.length - result.affectedRows;
      }
      
      console.log(`  ${pair}: inserted ${inserted}, skipped ${skipped} (already existed)`);
      totalInserted += inserted;
      totalSkipped += skipped;
    }
    
    console.log(`\n✅ Backfill complete: ${totalInserted} rows inserted, ${totalSkipped} rows skipped`);
    
    // Show final data range
    const [final] = await conn.execute(
      'SELECT currencyPair, MIN(date) as earliest, MAX(date) as latest, COUNT(*) as cnt FROM exchangeRates GROUP BY currencyPair'
    );
    console.log('\nFinal data:');
    final.forEach(r => console.log(`  ${r.currencyPair}: ${r.earliest?.toISOString?.()?.split('T')[0] || r.earliest} → ${r.latest?.toISOString?.()?.split('T')[0] || r.latest} (${r.cnt} rows)`));
    
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
