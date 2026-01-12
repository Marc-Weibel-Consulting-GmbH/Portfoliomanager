import { drizzle } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';
import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

// Check transactions for portfolio 270001
const result = await connection.execute(
  'SELECT id, portfolioId, ticker, transactionType, shares, pricePerShare, amountCHF, transactionDate FROM portfolioTransactions WHERE portfolioId = 270001 ORDER BY transactionDate LIMIT 20'
);

console.log('Transactions for portfolio 270001:');
console.log(JSON.stringify(result[0], null, 2));

// Check portfolio details
const portfolioResult = await connection.execute(
  'SELECT id, name, isLive, liveStartDate, startCapital, cashBalance, investmentAmount FROM savedPortfolios WHERE id = 270001'
);
console.log('\nPortfolio details:');
console.log(JSON.stringify(portfolioResult[0], null, 2));

await connection.end();
