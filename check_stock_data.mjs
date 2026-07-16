import mysql2 from 'mysql2/promise';

const conn = await mysql2.createConnection(process.env.DATABASE_URL);
// First check actual columns
const [cols] = await conn.execute("SHOW COLUMNS FROM stocks");
console.log("COLUMNS:", cols.map(c => c.Field).join(', '));
const [rows] = await conn.execute(
  "SELECT ticker, peRatio, pegRatio, beta, volatility, sharpeRatio, dividendYield FROM stocks WHERE ticker IN ('RO.SW', 'NESN.SW', 'AAPL') LIMIT 3"
);
console.log("DATA:", JSON.stringify(rows, null, 2));
await conn.end();
