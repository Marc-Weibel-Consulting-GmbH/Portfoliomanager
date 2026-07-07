/**
 * Full benchmark fix:
 * 1. Backfill CHSPI.SW and ACWI.US from 2025-01-01 to today
 * 2. Add CSSMI.SW as proper SMI proxy
 * 3. Update benchmarkData table with correct values
 * 
 * Run: node scripts/oneoff/fix-benchmarks-full.mjs [--apply]
 */
import mysql2 from 'mysql2/promise';

const EODHD_API_KEY = process.env.EODHD_API_KEY;
if (!EODHD_API_KEY) { console.error('EODHD_API_KEY not set'); process.exit(1); }
const APPLY = process.argv.includes('--apply');

const db = await mysql2.createConnection(process.env.DATABASE_URL);

// ─── Helper: fetch EODHD historical data ─────────────────────────────────────
async function fetchEODHD(symbol, from, to) {
  const url = `https://eodhd.com/api/eod/${symbol}?api_token=${EODHD_API_KEY}&from=${from}&to=${to}&fmt=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`EODHD ${symbol}: ${res.status} ${res.statusText}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error(`EODHD ${symbol}: unexpected response ${JSON.stringify(data).slice(0,100)}`);
  return data;
}

// ─── Helper: upsert into historicalPrices ────────────────────────────────────
async function upsertHistoricalPrices(ticker, rows) {
  let count = 0;
  for (const row of rows) {
    const close = String(row.adjusted_close ?? row.close);
    const open = String(row.open ?? row.close);
    const high = String(row.high ?? row.close);
    const low = String(row.low ?? row.close);
    const vol = row.volume || 0;
    await db.execute(
      `INSERT INTO historicalPrices (ticker, date, close, open, high, low, volume, adjustedClose)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE close = VALUES(close), open = VALUES(open), high = VALUES(high), low = VALUES(low), adjustedClose = VALUES(adjustedClose)`,
      [ticker, row.date, close, open, high, low, vol, close]
    );
    count++;
  }
  return count;
}

// ─── Helper: upsert into benchmarkData ───────────────────────────────────────
async function upsertBenchmarkData(benchmark, rows) {
  let count = 0;
  for (const row of rows) {
    const close = String(row.adjusted_close ?? row.close);
    await db.execute(
      `INSERT INTO benchmarkData (benchmark, date, close, source)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE close = VALUES(close), source = VALUES(source)`,
      [benchmark, row.date, close, 'eodhd']
    );
    count++;
  }
  return count;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const today = new Date().toISOString().split('T')[0];
const from = '2024-12-01'; // enough for YTD + some buffer

console.log(`\n=== Benchmark Fix (${APPLY ? 'APPLY' : 'DRY RUN'}) ===`);
console.log(`Fetching data from ${from} to ${today}\n`);

const benchmarks = [
  { ticker: 'ACWI.US', eodhdSymbol: 'ACWI.US', benchmarkKey: 'MSCI_WORLD', label: 'MSCI World (ACWI ETF)' },
  { ticker: 'CHSPI.SW', eodhdSymbol: 'CHSPI.SW', benchmarkKey: 'SMI', label: 'Swiss Performance Index (CHSPI)' },
  { ticker: 'SPY', eodhdSymbol: 'SPY.US', benchmarkKey: 'SP500', label: 'S&P 500 (SPY ETF)' },
];

for (const bench of benchmarks) {
  try {
    console.log(`--- ${bench.label} ---`);
    const data = await fetchEODHD(bench.eodhdSymbol, from, today);
    console.log(`  Fetched ${data.length} rows: ${data[0]?.date} → ${data[data.length-1]?.date}`);
    
    // Calculate YTD
    const dec31 = data.find(d => d.date === '2025-12-31') || [...data].filter(d => d.date <= '2025-12-31').pop();
    const latest = data[data.length-1];
    if (dec31 && latest) {
      const ytd = ((latest.adjusted_close - dec31.adjusted_close) / dec31.adjusted_close * 100).toFixed(2);
      console.log(`  Dec31=${dec31.adjusted_close}, Latest=${latest.adjusted_close} (${latest.date}), YTD=${ytd}%`);
    }
    
    if (APPLY) {
      const hp = await upsertHistoricalPrices(bench.ticker, data);
      console.log(`  ✓ historicalPrices: ${hp} rows upserted for ${bench.ticker}`);
      const bd = await upsertBenchmarkData(bench.benchmarkKey, data);
      console.log(`  ✓ benchmarkData: ${bd} rows upserted for ${bench.benchmarkKey}`);
    }
  } catch (err) {
    console.error(`  ERROR: ${err.message}`);
  }
}

// ─── Verify after apply ───────────────────────────────────────────────────────
if (APPLY) {
  console.log('\n=== Verification ===');
  const [rows] = await db.execute(`
    SELECT ticker, COUNT(*) as cnt, MIN(date) as minDate, MAX(date) as maxDate
    FROM historicalPrices WHERE ticker IN ('ACWI.US', 'CHSPI.SW', 'SPY')
    GROUP BY ticker
  `);
  rows.forEach(r => console.log(`  ${r.ticker}: ${r.cnt} rows, ${r.minDate} → ${r.maxDate}`));
  
  const [bdRows] = await db.execute(`
    SELECT benchmark, COUNT(*) as cnt, MIN(date) as minDate, MAX(date) as maxDate
    FROM benchmarkData WHERE benchmark IN ('MSCI_WORLD', 'SMI', 'SP500')
    GROUP BY benchmark
  `);
  bdRows.forEach(r => console.log(`  benchmarkData[${r.benchmark}]: ${r.cnt} rows, ${r.minDate} → ${r.maxDate}`));
  
  // Calculate actual YTD from DB
  console.log('\n=== Calculated YTD from DB ===');
  for (const { ticker, label } of [
    { ticker: 'ACWI.US', label: 'MSCI World' },
    { ticker: 'CHSPI.SW', label: 'SMI (SPI)' },
    { ticker: 'SPY', label: 'S&P 500' },
  ]) {
    const [startRows] = await db.execute(
      `SELECT close FROM historicalPrices WHERE ticker = ? AND date <= '2026-01-01' ORDER BY date DESC LIMIT 1`,
      [ticker]
    );
    const [endRows] = await db.execute(
      `SELECT close, date FROM historicalPrices WHERE ticker = ? ORDER BY date DESC LIMIT 1`,
      [ticker]
    );
    if (startRows.length && endRows.length) {
      const start = parseFloat(startRows[0].close);
      const end = parseFloat(endRows[0].close);
      const ytd = ((end - start) / start * 100).toFixed(2);
      console.log(`  ${label}: start=${start}, end=${end} (${endRows[0].date}), YTD=${ytd}%`);
    }
  }
}

if (!APPLY) console.log('\n=== DRY RUN complete - use --apply to execute ===');

await db.end();
