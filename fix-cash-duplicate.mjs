import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Get portfolio 990001
const [rows] = await connection.execute(
  'SELECT id, name, cashBalance, portfolioData FROM savedPortfolios WHERE id = 990001'
);

const portfolio = rows[0];
console.log('Portfolio ID:', portfolio.id);
console.log('Portfolio Name:', portfolio.name);
console.log('Cash Balance from DB:', portfolio.cashBalance);

const data = JSON.parse(portfolio.portfolioData || '{}');
console.log('\nOriginal stocks count:', data.stocks?.length);
console.log('Stock tickers:', data.stocks?.map(s => s.ticker).join(', '));

// Filter out CASH ticker
const stocksWithoutCash = data.stocks?.filter(s => s.ticker !== 'CASH') || [];
console.log('\nAfter removing CASH ticker:');
console.log('New stocks count:', stocksWithoutCash.length);
console.log('Stock tickers:', stocksWithoutCash.map(s => s.ticker).join(', '));

// Update the portfolioData
const updatedData = { ...data, stocks: stocksWithoutCash };
const updatedJson = JSON.stringify(updatedData);

// Update database
await connection.execute(
  'UPDATE savedPortfolios SET portfolioData = ? WHERE id = ?',
  [updatedJson, portfolio.id]
);

console.log('\n✅ Database updated successfully!');
console.log('CASH ticker removed from portfolioData JSON');
console.log('Cash position will now be tracked via cashBalance field only');

await connection.end();
