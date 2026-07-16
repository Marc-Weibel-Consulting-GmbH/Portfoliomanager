import mysql2 from 'mysql2/promise';
const conn = await mysql2.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(
  "SELECT ticker, score, peRatio, pegRatio, beta, volatility, sharpeRatio, dividendYield, category FROM stocks WHERE ticker IN ('RO.SW', 'NESN.SW', 'AAPL') LIMIT 3"
);
console.log(JSON.stringify(rows, null, 2));
await conn.end();
