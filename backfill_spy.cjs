/**
 * Backfill SPY from SPY.US for 2014-01-01 to 2019-12-31
 * SPY and SPY.US are the same ETF — SPY.US has data back to 1993
 */
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Copy SPY.US rows to SPY where SPY has no data (2014-2019)
  const [result] = await conn.execute(`
    INSERT INTO historicalPrices (ticker, date, close, source)
    SELECT 'SPY', date, close, source
    FROM historicalPrices
    WHERE ticker = 'SPY.US'
      AND date >= '2014-01-01'
      AND date < '2020-01-01'
    ON DUPLICATE KEY UPDATE close = VALUES(close)
  `);
  console.log(`Backfilled SPY: ${result.affectedRows} rows inserted/updated`);

  // Verify
  const [rows] = await conn.execute(
    "SELECT COUNT(*) as cnt, MIN(date) as earliest, MAX(date) as latest FROM historicalPrices WHERE ticker = 'SPY'"
  );
  console.log('SPY after backfill:', JSON.stringify(rows[0]));

  await conn.end();
  console.log('Done.');
}

main().catch(console.error);
