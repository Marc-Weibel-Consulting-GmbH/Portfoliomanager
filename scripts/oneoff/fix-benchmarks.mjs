/**
 * Benchmark data fix: backfill MSCI World (ACWI.US) and SMI (CHSPI.SW) 
 * from EODHD for YTD 2026 and check existing data.
 */
import mysql2 from 'mysql2/promise';

const EODHD_API_KEY = process.env.EODHD_API_KEY;
if (!EODHD_API_KEY) {
  console.error('EODHD_API_KEY not set');
  process.exit(1);
}

const db = await mysql2.createConnection(process.env.DATABASE_URL);

// ─── 1. Check existing data ───────────────────────────────────────────────────
const [existing] = await db.execute(`
  SELECT ticker, COUNT(*) as cnt, MIN(date) as minDate, MAX(date) as maxDate
  FROM historicalPrices 
  WHERE ticker IN ('ACWI', 'ACWI.US', 'CHSPI.SW', 'SPY', 'URTH')
  GROUP BY ticker
`);
console.log('\n=== Existing benchmark proxy data ===');
existing.forEach(r => console.log(`  ${r.ticker}: ${r.cnt} rows, ${r.minDate} → ${r.maxDate}`));

// ─── 2. Check YTD start data ─────────────────────────────────────────────────
const [ytdRows] = await db.execute(`
  SELECT ticker, date, close FROM historicalPrices 
  WHERE ticker IN ('ACWI', 'ACWI.US', 'CHSPI.SW', 'SPY', 'URTH') 
  AND date BETWEEN '2025-12-28' AND '2026-01-05'
  ORDER BY ticker, date
`);
console.log('\n=== YTD start data (Dec 28 - Jan 5) ===');
ytdRows.forEach(r => console.log(`  ${r.ticker} ${r.date}: ${r.close}`));

// ─── 3. Check latest data ─────────────────────────────────────────────────────
const [latestRows] = await db.execute(`
  SELECT ticker, date, close FROM historicalPrices 
  WHERE ticker IN ('ACWI', 'ACWI.US', 'CHSPI.SW', 'SPY', 'URTH') 
  AND date >= '2026-06-01'
  ORDER BY ticker, date DESC LIMIT 10
`);
console.log('\n=== Latest data (June+ 2026) ===');
latestRows.forEach(r => console.log(`  ${r.ticker} ${r.date}: ${r.close}`));

// ─── 4. Fetch from EODHD ─────────────────────────────────────────────────────
const APPLY = process.argv.includes('--apply');
const benchmarks = [
  { ticker: 'ACWI.US', eodhdSymbol: 'ACWI.US', label: 'MSCI World (ACWI ETF)' },
  { ticker: 'CHSPI.SW', eodhdSymbol: 'CHSPI.SW', label: 'SMI (CHSPI Swiss Performance Index)' },
  { ticker: 'SPY', eodhdSymbol: 'SPY.US', label: 'S&P 500 (SPY ETF)' },
];

for (const bench of benchmarks) {
  console.log(`\n=== Fetching ${bench.label} ===`);
  const url = `https://eodhd.com/api/eod/${bench.eodhdSymbol}?api_token=${EODHD_API_KEY}&from=2025-12-01&to=2026-07-07&fmt=json`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`  FAILED: ${res.status} ${res.statusText}`);
    continue;
  }
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    console.error(`  No data returned`);
    continue;
  }
  console.log(`  Got ${data.length} rows, ${data[0].date} → ${data[data.length-1].date}`);
  console.log(`  Dec 31 close: ${data.find(d => d.date === '2025-12-31')?.close || data.find(d => d.date <= '2025-12-31')?.close || 'N/A'}`);
  console.log(`  Latest close: ${data[data.length-1].close} on ${data[data.length-1].date}`);
  
  if (APPLY) {
    // Insert/update in historicalPrices
    let inserted = 0;
    for (const row of data) {
      await db.execute(
        `INSERT INTO historicalPrices (ticker, date, close, open, high, low, volume, adjustedClose)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE close = VALUES(close), open = VALUES(open), high = VALUES(high), low = VALUES(low)`,
        [bench.ticker, row.date, String(row.adjusted_close ?? row.close), String(row.open), String(row.high), String(row.low), row.volume || 0, String(row.adjusted_close ?? row.close)]
      );
      inserted++;
    }
    console.log(`  ✓ Inserted/updated ${inserted} rows for ${bench.ticker}`);
  }
}

if (!APPLY) {
  console.log('\n=== DRY RUN - use --apply to execute ===');
}

await db.end();
