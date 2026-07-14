const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [rows] = await conn.execute('SELECT id, name, portfolioType, isLive, liveStartDate FROM savedPortfolios WHERE id = 1980001');
  console.log(JSON.stringify(rows[0]));
  await conn.end();
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
