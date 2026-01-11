import mysql from 'mysql2/promise';

const EODHD_API_KEY = process.env.EODHD_API_KEY;
const EODHD_BASE_URL = "https://eodhd.com/api";

async function fetchHistoricalPricesFromAPI(ticker, fromDate, toDate) {
  if (!EODHD_API_KEY) throw new Error("EODHD_API_KEY not set");
  const url = `${EODHD_BASE_URL}/eod/${ticker}?api_token=${EODHD_API_KEY}&fmt=json&from=${fromDate}&to=${toDate}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    return [];
  }
}

async function fetchSplitsFromAPI(ticker, fromDate, toDate) {
  if (!EODHD_API_KEY) return [];
  const url = `${EODHD_BASE_URL}/splits/${ticker}?api_token=${EODHD_API_KEY}&fmt=json&from=${fromDate}&to=${toDate}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    return [];
  }
}

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) { console.error('DATABASE_URL not set'); process.exit(1); }

  console.log('[MAX-Backfill] Connecting to database...');
  const conn = await mysql.createConnection(dbUrl);

  const tickers = new Set();

  // 1. Get tickers from stocks table (Watchlist)
  console.log('[MAX-Backfill] Fetching tickers from stocks table...');
  const [stocks] = await conn.query('SELECT DISTINCT ticker FROM stocks WHERE ticker IS NOT NULL');
  stocks.forEach(s => tickers.add(s.ticker));
  console.log(`  -> ${stocks.length} tickers from stocks`);

  // 2. Get tickers from savedPortfolios
  console.log('[MAX-Backfill] Fetching tickers from savedPortfolios...');
  const [portfolios] = await conn.query('SELECT portfolioData FROM savedPortfolios WHERE portfolioData IS NOT NULL');
  for (const portfolio of portfolios) {
    try {
      const data = typeof portfolio.portfolioData === 'string' ? JSON.parse(portfolio.portfolioData) : portfolio.portfolioData;
      if (data && Array.isArray(data.stocks)) {
        data.stocks.forEach(stock => { if (stock.ticker) tickers.add(stock.ticker); });
      }
    } catch (e) {}
  }
  console.log(`  -> Total unique tickers: ${tickers.size}`);

  // 3. Check which tickers already have MAX data (more than 5 years)
  console.log('[MAX-Backfill] Checking existing data coverage...');
  const tickerList = Array.from(tickers);
  const tickersToBackfill = [];
  
  for (const ticker of tickerList) {
    const [coverage] = await conn.query(
      'SELECT MIN(date) as minDate, MAX(date) as maxDate, COUNT(*) as cnt FROM historicalPrices WHERE ticker = ?',
      [ticker]
    );
    const minDate = coverage[0]?.minDate;
    const cnt = coverage[0]?.cnt || 0;
    
    // Backfill if less than 1000 records or no data before 2015
    if (cnt < 1000 || !minDate || minDate > '2015-01-01') {
      tickersToBackfill.push(ticker);
    }
  }
  
  console.log(`[MAX-Backfill] ${tickersToBackfill.length} tickers need backfill (of ${tickerList.length} total)`);

  const toDate = new Date().toISOString().split('T')[0];
  const fromDate = '1990-01-01';

  let totalPrices = 0, totalSplits = 0, processed = 0;

  for (const ticker of tickersToBackfill) {
    processed++;
    console.log(`[MAX-Backfill] (${processed}/${tickersToBackfill.length}) Processing ${ticker}...`);
    
    try {
      const prices = await fetchHistoricalPricesFromAPI(ticker, fromDate, toDate);
      
      if (prices.length > 0) {
        // Batch insert for better performance
        const values = prices.map(p => [
          ticker, p.date, p.open || null, p.high || null, p.low || null, 
          p.close, p.volume || null, p.adjusted_close || null, 'eodhd'
        ]);
        
        // Insert in batches of 500
        for (let i = 0; i < values.length; i += 500) {
          const batch = values.slice(i, i + 500);
          const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
          await conn.query(
            `INSERT IGNORE INTO historicalPrices (ticker, date, open, high, low, close, volume, adjustedClose, source) VALUES ${placeholders}`,
            batch.flat()
          );
        }
        totalPrices += prices.length;
        console.log(`  -> ${prices.length} prices`);
      }

      const splits = await fetchSplitsFromAPI(ticker, fromDate, toDate);
      if (splits.length > 0) {
        for (const split of splits) {
          const parts = split.split.split('/');
          const splitTo = parseFloat(parts[0]) || 1;
          const splitFrom = parseFloat(parts[1]) || 1;
          const splitRatio = splitTo / splitFrom;
          await conn.query(
            'INSERT IGNORE INTO equity_corporate_actions (ticker, date, actionType, splitFrom, splitTo, splitRatio, source) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [ticker, split.date, 'SPLIT', splitFrom, splitTo, splitRatio, 'eodhd']
          );
        }
        totalSplits += splits.length;
        console.log(`  -> ${splits.length} splits`);
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`  Error: ${error.message}`);
    }
  }

  await conn.end();
  console.log('\n========================================');
  console.log('[MAX-Backfill] COMPLETE');
  console.log(`Tickers processed: ${tickersToBackfill.length}`);
  console.log(`Total prices imported: ${totalPrices}`);
  console.log(`Total splits imported: ${totalSplits}`);
  console.log('========================================');
}

run().catch(console.error);
