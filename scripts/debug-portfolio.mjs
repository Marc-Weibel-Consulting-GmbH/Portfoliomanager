import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  // First, find the portfolio
  const [portfolios] = await connection.execute(
    "SELECT id, name, portfolioType, isLive, investmentAmount, cashBalance FROM savedPortfolios WHERE name LIKE '%Test Portfolio Marc%'"
  );
  console.log('Portfolios:', JSON.stringify(portfolios, null, 2));
  
  if (portfolios.length > 0) {
    const portfolioId = portfolios[0].id;
    
    // Get transactions
    const [transactions] = await connection.execute(
      "SELECT id, portfolioId, transactionType, ticker, shares, pricePerShare, currency, totalAmount, totalAmountCHF, transactionDate, notes FROM portfolioTransactions WHERE portfolioId = ?",
      [portfolioId]
    );
    console.log('Transactions:', JSON.stringify(transactions, null, 2));
    
    // Get positions from portfolioData
    const [portfolioData] = await connection.execute(
      "SELECT portfolioData FROM savedPortfolios WHERE id = ?",
      [portfolioId]
    );
    if (portfolioData[0]?.portfolioData) {
      const data = JSON.parse(portfolioData[0].portfolioData);
      console.log('Portfolio stocks count:', data.stocks?.length || 0);
      if (data.stocks?.length > 0) {
        console.log('First stock:', JSON.stringify(data.stocks[0], null, 2));
      }
    }
  }
  
  await connection.end();
}

main().catch(console.error);
