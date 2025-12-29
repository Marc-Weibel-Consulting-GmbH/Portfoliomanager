/**
 * Script to load historical prices for portfolio stocks and benchmarks
 * Run with: node scripts/load-historical-prices.mjs
 */

import mysql from 'mysql2/promise';
import 'dotenv/config';

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

// Benchmarks to load
const BENCHMARKS = [
  'SPY',      // S&P 500 ETF
  'QQQ',      // Nasdaq 100 ETF
  'SSMI.SW',  // SMI Index
  'FEZ',      // EuroStoxx 50 ETF
];

async function fetchHistoricalPrices(ticker, fromDate, toDate) {
  // Handle ticker format for EODHD
  let apiTicker = ticker;
  if (!ticker.includes('.')) {
    apiTicker = `${ticker}.US`; // Default to US exchange
  }
  
  const url = `https://eodhd.com/api/eod/${apiTicker}?from=${fromDate}&to=${toDate}&api_token=${EODHD_API_KEY}&fmt=json`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to fetch ${apiTicker}: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    if (!Array.isArray(data)) {
      console.warn(`Invalid response for ${apiTicker}`);
      return [];
    }
    
    return data.map(d => ({
      date: d.date,
      close: parseFloat(d.close),
    }));
  } catch (error) {
    console.error(`Error fetching ${apiTicker}:`, error.message);
    return [];
  }
}

async function savePrices(conn, ticker, prices) {
  if (prices.length === 0) return 0;
  
  let saved = 0;
  for (const price of prices) {
    try {
      await conn.execute(
        `INSERT INTO historicalPrices (ticker, date, close, source, updatedAt)
         VALUES (?, ?, ?, 'eodhd', NOW())
         ON DUPLICATE KEY UPDATE close = VALUES(close), updatedAt = NOW()`,
        [ticker, price.date, price.close.toString()]
      );
      saved++;
    } catch (error) {
      console.error(`Error saving ${ticker} ${price.date}:`, error.message);
    }
  }
  return saved;
}

async function getPortfolioTickers(conn) {
  const [rows] = await conn.execute(`
    SELECT DISTINCT ticker FROM portfolioTransactions WHERE ticker IS NOT NULL
  `);
  return rows.map(r => r.ticker);
}

async function main() {
  console.log('Connecting to database...');
  const conn = await mysql.createConnection(DATABASE_URL);
  
  // Calculate date range (YTD + some buffer)
  const today = new Date();
  const fromDate = `${today.getFullYear() - 5}-01-01`; // 5 years back for 5Y chart
  const toDate = today.toISOString().split('T')[0];
  
  console.log(`Loading prices from ${fromDate} to ${toDate}`);
  
  // Get portfolio tickers
  const portfolioTickers = await getPortfolioTickers(conn);
  console.log(`Found ${portfolioTickers.length} portfolio tickers:`, portfolioTickers);
  
  // Combine with benchmarks
  const allTickers = [...new Set([...portfolioTickers, ...BENCHMARKS])];
  console.log(`Total tickers to process: ${allTickers.length}`);
  
  let totalSaved = 0;
  
  for (const ticker of allTickers) {
    console.log(`\nProcessing ${ticker}...`);
    const prices = await fetchHistoricalPrices(ticker, fromDate, toDate);
    
    if (prices.length > 0) {
      const saved = await savePrices(conn, ticker, prices);
      console.log(`  Saved ${saved} prices for ${ticker} (${prices[0]?.date} to ${prices[prices.length-1]?.date})`);
      totalSaved += saved;
    } else {
      console.log(`  No prices found for ${ticker}`);
    }
    
    // Rate limiting - wait 200ms between requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log(`\n✅ Done! Total prices saved: ${totalSaved}`);
  
  await conn.end();
}

main().catch(console.error);
