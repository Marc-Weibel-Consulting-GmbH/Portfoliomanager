const { drizzle } = require('drizzle-orm/mysql2');
const mysql = require('mysql2/promise');

async function checkTickers() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(connection);
  
  const result = await connection.query('SELECT ticker, companyName FROM stocks WHERE ticker IN ("ML:US", "LIBN:SW", "MONCL:IM", "VIMS", "LONGI")');
  
  console.log('Failed stocks in database:');
  console.log(JSON.stringify(result[0], null, 2));
  
  await connection.end();
}

checkTickers().catch(console.error);
