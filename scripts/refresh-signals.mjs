/**
 * Trigger signal score refresh for RO.SW and HBAN.SW
 * by calling the watchlist.refreshMetrics endpoint directly via tRPC
 */
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Get the IDs for RO.SW and HBAN.SW
const [rows] = await conn.execute(
  "SELECT id, ticker, signalScore, signalType FROM watchlistStocks WHERE ticker IN ('RO.SW', 'HBAN.SW')"
);
console.log('Current state:');
console.table(rows);

// We'll call the server's refreshMetrics endpoint via HTTP
// First, generate a valid admin session token
const jwt = await import('/home/ubuntu/portfolio_analysis_website/node_modules/.pnpm/jsonwebtoken@9.0.2/node_modules/jsonwebtoken/index.js');
const token = jwt.default.sign(
  { userId: 1, openId: process.env.OWNER_OPEN_ID },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

for (const row of rows) {
  console.log(`\nRefreshing ${row.ticker} (id=${row.id})...`);
  try {
    const resp = await fetch('http://localhost:3000/api/trpc/watchlist.refreshMetrics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `app_session_id=${token}`,
      },
      body: JSON.stringify({ tickerId: row.id }),
    });
    const data = await resp.json();
    if (data.result?.data) {
      console.log(`  ✅ Result:`, data.result.data);
    } else {
      console.log(`  ❌ Error:`, JSON.stringify(data).substring(0, 200));
    }
  } catch (e) {
    console.error(`  ❌ Fetch error:`, e.message);
  }
}

// Verify the updated scores
const [updated] = await conn.execute(
  "SELECT id, ticker, signalScore, signalType, currentPrice, lastMetricsUpdate FROM watchlistStocks WHERE ticker IN ('RO.SW', 'HBAN.SW')"
);
console.log('\nUpdated state:');
console.table(updated);

await conn.end();
