/**
 * Adds LVMUY (LVMH Moët Hennessy - US ADR) to the stocks table.
 * Fetches fundamentals and real-time price from EODHD.
 */
import mysql from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL;
const EODHD_KEY = process.env.EODHD_API_KEY;

if (!DB_URL) { console.error('DATABASE_URL not set'); process.exit(1); }
if (!EODHD_KEY) { console.error('EODHD_API_KEY not set'); process.exit(1); }

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

async function main() {
  const conn = await mysql.createConnection(DB_URL);

  // 1. Check if LVMUY already exists
  const [existing] = await conn.execute('SELECT id, ticker FROM stocks WHERE ticker = ?', ['LVMUY']);
  if (existing.length > 0) {
    console.log('LVMUY already exists in stocks table:', existing[0]);
    await conn.end();
    return;
  }

  // 2. Fetch real-time price
  console.log('Fetching LVMUY real-time price from EODHD...');
  const rt = await fetchJson(`https://eodhd.com/api/real-time/LVMUY.US?api_token=${EODHD_KEY}&fmt=json`);
  console.log('Real-time data:', JSON.stringify(rt, null, 2));

  // 3. Fetch fundamentals
  console.log('Fetching LVMUY fundamentals from EODHD...');
  let fundamentals = {};
  try {
    fundamentals = await fetchJson(`https://eodhd.com/api/fundamentals/LVMUY.US?api_token=${EODHD_KEY}&fmt=json`);
    console.log('Fundamentals General:', JSON.stringify(fundamentals.General || {}, null, 2));
  } catch (e) {
    console.warn('Could not fetch fundamentals:', e.message);
  }

  const general = fundamentals.General || {};
  const highlights = fundamentals.Highlights || {};

  // 4. Build stock record using actual stocks table columns
  const stock = {
    ticker: 'LVMUY',
    companyName: general.Name || 'LVMH Moet Hennessy Louis Vuitton SA ADR',
    currency: 'USD',
    sector: general.Sector || 'Consumer Cyclical',
    currentPrice: String(rt.close || rt.adjusted_close || '0'),
    marketCap: highlights.MarketCapitalization ? String(highlights.MarketCapitalization) : null,
    peRatio: highlights.PERatio ? String(highlights.PERatio) : null,
    dividendYield: highlights.DividendYield ? String(highlights.DividendYield) : null,
    beta: highlights.Beta ? String(highlights.Beta) : null,
    logoUrl: general.LogoURL ? `https://eodhd.com${general.LogoURL}` : null,
    week52High: highlights['52WeekHigh'] ? String(highlights['52WeekHigh']) : null,
    week52Low: highlights['52WeekLow'] ? String(highlights['52WeekLow']) : null,
  };

  console.log('\nInserting stock:', JSON.stringify(stock, null, 2));

  // 5. Insert into stocks table with correct column names
  const [result] = await conn.execute(
    `INSERT INTO stocks (ticker, companyName, currency, sector, currentPrice, marketCap, peRatio, dividendYield, beta, logoUrl, week52High, week52Low, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      stock.ticker, stock.companyName, stock.currency, stock.sector,
      stock.currentPrice, stock.marketCap, stock.peRatio,
      stock.dividendYield, stock.beta, stock.logoUrl,
      stock.week52High, stock.week52Low
    ]
  );

  console.log(`\nInserted LVMUY with id=${result.insertId}`);

  // 6. Verify
  const [rows] = await conn.execute('SELECT id, ticker, companyName, currentPrice, sector FROM stocks WHERE ticker = ?', ['LVMUY']);
  console.log('Verification:', rows[0]);

  await conn.end();
  console.log('\nDone!');
}

main().catch(e => { console.error(e); process.exit(1); });
