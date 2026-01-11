import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

const [rows] = await connection.execute(`
  SELECT 
    ticker, 
    MIN(date) as earliest_date, 
    MAX(date) as latest_date, 
    COUNT(*) as data_points
  FROM historical_prices 
  WHERE ticker IN ('ZURN.SW', 'JNJ', 'KNIN.SW', 'HOLN.SW', 'SLHN.SW', 'NESN.SW', 'NOVN.SW', 'SGKN.SW', 'NEE', 'SCMN.SW', 'SPY')
  GROUP BY ticker
  ORDER BY earliest_date DESC
`);

console.log('Historical Price Data Summary:');
console.table(rows);

// Check portfolio transactions
const [portfolio] = await connection.execute(`
  SELECT id, name, isLive, liveStartDate, createdAt 
  FROM portfolios 
  WHERE id = 1020002
`);
console.log('\nPortfolio Info:');
console.table(portfolio);

// Check transactions for this portfolio
const [transactions] = await connection.execute(`
  SELECT ticker, transactionType, transactionDate, shares
  FROM portfolio_transactions 
  WHERE portfolioId = 1020002
  ORDER BY transactionDate
  LIMIT 20
`);
console.log('\nPortfolio Transactions:');
console.table(transactions);

await connection.end();
