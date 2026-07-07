/**
 * Watchlist Cleanup: Find tickers that can't be resolved via EODHD or Yahoo Finance
 * This identifies potentially delisted, renamed, or otherwise broken tickers.
 */
import mysql from 'mysql2/promise';
import https from 'https';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const apiKey = process.env.EODHD_API_KEY;

// Get all active watchlist stocks
const [stocks] = await conn.execute(
  "SELECT id, ticker, companyName, signalScore, lastMetricsUpdate FROM watchlistStocks WHERE isActive = 1 ORDER BY ticker"
);
console.log(`Total active watchlist stocks: ${stocks.length}\n`);

// Check each ticker via EODHD real-time API
async function checkTicker(ticker) {
  const eodhTicker = ticker.includes('.') ? ticker : `${ticker}.US`;
  const url = `https://eodhd.com/api/real-time/${eodhTicker}?api_token=${apiKey}&fmt=json`;
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          resolve({ ticker, close: j.close, code: j.code, ok: j.close !== 'NA' && j.close !== null });
        } catch(e) { resolve({ ticker, ok: false, error: 'parse_error' }); }
      });
    }).on('error', e => resolve({ ticker, ok: false, error: e.message }));
  });
}

// Check in batches of 5
const problems = [];
const noMetrics = [];

for (let i = 0; i < stocks.length; i += 5) {
  const batch = stocks.slice(i, i + 5);
  const results = await Promise.all(batch.map(s => checkTicker(s.ticker)));
  
  for (let j = 0; j < results.length; j++) {
    const r = results[j];
    const stock = batch[j];
    if (!r.ok) {
      problems.push({ id: stock.id, ticker: stock.ticker, name: stock.companyName, reason: 'EODHD returns NA/error' });
    }
    // Also flag stocks with no metrics update in 7+ days
    if (stock.lastMetricsUpdate) {
      const daysSinceUpdate = (Date.now() - new Date(stock.lastMetricsUpdate).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate > 7) {
        noMetrics.push({ ticker: stock.ticker, name: stock.companyName, daysSinceUpdate: Math.round(daysSinceUpdate) });
      }
    } else {
      noMetrics.push({ ticker: stock.ticker, name: stock.companyName, daysSinceUpdate: 'never' });
    }
  }
  
  // Rate limiting
  await new Promise(r => setTimeout(r, 200));
}

console.log('\n━━━ PROBLEMATIC TICKERS (EODHD returns NA) ━━━');
if (problems.length === 0) {
  console.log('  ✅ No problems found!');
} else {
  console.table(problems);
}

console.log('\n━━━ STALE METRICS (>7 days without update) ━━━');
if (noMetrics.length === 0) {
  console.log('  ✅ All metrics are fresh!');
} else {
  console.table(noMetrics);
}

await conn.end();
