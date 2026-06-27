/**
 * Manual ML training trigger script.
 * Run with: node scripts/run-ml-training.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Load environment variables
const dotenv = await import('dotenv').catch(() => null);
if (dotenv) dotenv.config({ path: new URL('../.env', import.meta.url).pathname });

const ANALYTICS_URL = process.env.ANALYTICS_SERVICE_URL || 'http://127.0.0.1:8001';
const DB_URL = process.env.DATABASE_URL;

if (!DB_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

console.log('[ML Test] Analytics service URL:', ANALYTICS_URL);

// 1. Check analytics service health
const health = await fetch(`${ANALYTICS_URL}/health`).then(r => r.json()).catch(e => ({ error: e.message }));
console.log('[ML Test] Health:', JSON.stringify(health));
if (!health.status) {
  console.error('[ML Test] Analytics service not available');
  process.exit(1);
}

// 2. Build a small test payload with a few tickers from the DB
const mysql2 = await import('mysql2/promise');
const conn = await mysql2.createConnection(DB_URL);

// Get a sample of tickers with enough historical data (>= 200 days)
const [rows] = await conn.execute(`
  SELECT ticker, COUNT(*) as cnt 
  FROM historical_prices 
  GROUP BY ticker 
  HAVING cnt >= 200 
  ORDER BY cnt DESC 
  LIMIT 10
`);
console.log('[ML Test] Available tickers for training:', rows.map(r => r.ticker));

// Fetch price series for the top 5 tickers
const seriesByTicker = {};
for (const row of rows.slice(0, 5)) {
  const [prices] = await conn.execute(
    'SELECT date, adjustedClose, close FROM historical_prices WHERE ticker = ? ORDER BY date ASC',
    [row.ticker]
  );
  if (prices.length >= 200) {
    seriesByTicker[row.ticker] = {
      dates: prices.map(p => p.date.toISOString ? p.date.toISOString().split('T')[0] : String(p.date)),
      prices: prices.map(p => parseFloat(p.adjustedClose || p.close || 0)).filter(p => p > 0),
    };
  }
}

await conn.end();

console.log('[ML Test] Tickers in training payload:', Object.keys(seriesByTicker));
console.log('[ML Test] Price series lengths:', Object.fromEntries(
  Object.entries(seriesByTicker).map(([k, v]) => [k, v.prices.length])
));

// 3. Call the /analytics/train endpoint
console.log('[ML Test] Calling /analytics/train...');
const startTime = Date.now();
const trainRes = await fetch(`${ANALYTICS_URL}/analytics/train`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    kind: 'gb_signal',
    seriesByTicker,
    lookahead: 30,
    minHitRate: 0.52,
    maxOverfitRatio: 1.6,
    minAlpha: 0.0,
  }),
  signal: AbortSignal.timeout(120_000), // 2 min timeout
}).catch(e => ({ error: e.message }));

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

if (trainRes.error) {
  console.error('[ML Test] Training request failed:', trainRes.error);
  process.exit(1);
}

if (!trainRes.ok) {
  const errText = await trainRes.text();
  console.error(`[ML Test] Training failed (HTTP ${trainRes.status}):`, errText.slice(0, 500));
  process.exit(1);
}

const result = await trainRes.json();
console.log(`[ML Test] Training completed in ${elapsed}s`);
console.log('[ML Test] Result summary:');
console.log('  - kind:', result.kind);
console.log('  - version:', result.version);
console.log('  - metrics:', JSON.stringify(result.metrics));
console.log('  - promoted:', result.promoted);
console.log('  - onnxBase64 length:', result.onnxBase64?.length || 0, 'chars');
console.log('  - featureSpec:', JSON.stringify(result.featureSpec));

if (!result.onnxBase64) {
  console.error('[ML Test] No ONNX model returned!');
  process.exit(1);
}

console.log('\n[ML Test] SUCCESS: Model trained and ONNX bytes received!');
console.log('[ML Test] Next step: persist to DB and cache in Redis via the Node.js server.');
