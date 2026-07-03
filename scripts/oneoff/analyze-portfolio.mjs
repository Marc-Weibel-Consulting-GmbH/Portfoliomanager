import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

const [rows] = await connection.execute(
  'SELECT id, name, cashBalance, portfolioData FROM savedPortfolios WHERE id = 990001'
);

const portfolio = rows[0];
console.log('Portfolio ID:', portfolio.id);
console.log('Portfolio Name:', portfolio.name);
console.log('Cash Balance:', portfolio.cashBalance);

const data = JSON.parse(portfolio.portfolioData || '{}');
console.log('\nNumber of stocks in portfolioData:', data.stocks?.length);
console.log('\nStocks:');
data.stocks?.forEach((stock, index) => {
  console.log(`${index + 1}. ${stock.ticker}: ${stock.shares} shares @ ${stock.currentPrice}`);
  if (stock.ticker === 'CASH') {
    console.log('   ^^^ FOUND CASH TICKER IN PORTFOLIO DATA ^^^');
  }
});

await connection.end();
