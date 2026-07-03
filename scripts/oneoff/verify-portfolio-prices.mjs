/**
 * Verify and update portfolio prices
 * Checks all portfolio holdings against current API data
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
const EODHD_API_KEY = process.env.EODHD_API_KEY;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not configured');
  process.exit(1);
}

if (!EODHD_API_KEY) {
  console.error('❌ EODHD_API_KEY not configured');
  process.exit(1);
}

console.log('=== Portfolio Price Verification ===\n');
console.log('Date:', new Date().toISOString().split('T')[0]);
console.log('\n');

/**
 * Fetch current price from EODHD API
 */
async function fetchCurrentPrice(ticker) {
  try {
    const url = `https://eodhd.com/api/real-time/${ticker}?api_token=${EODHD_API_KEY}&fmt=json`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`   ⚠️  API Error for ${ticker}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return {
      price: data.close,
      timestamp: data.timestamp,
      date: new Date(data.timestamp * 1000).toISOString().split('T')[0]
    };
  } catch (error) {
    console.log(`   ❌ Error fetching ${ticker}:`, error.message);
    return null;
  }
}

/**
 * Main verification function
 */
async function verifyPortfolioPrices() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  try {
    // Get all portfolios
    const [portfolios] = await connection.execute('SELECT * FROM savedPortfolios');
    console.log(`Found ${portfolios.length} portfolios`);
    
    // Get all stocks
    const [allStocks] = await connection.execute('SELECT * FROM stocks');
    console.log(`Found ${allStocks.length} stocks in database\n`);
    
    // Get unique tickers from all portfolios
    const uniqueTickers = new Set();
    
    for (const portfolio of portfolios) {
      if (!portfolio.portfolioData) continue;
      
      try {
        const portfolioData = JSON.parse(portfolio.portfolioData);
        if (portfolioData.stocks) {
          portfolioData.stocks.forEach(stock => {
            if (stock.ticker) {
              uniqueTickers.add(stock.ticker);
            }
          });
        }
      } catch (error) {
        console.log(`⚠️  Error parsing portfolio ${portfolio.id}:`, error.message);
      }
    }
    
    console.log(`Found ${uniqueTickers.size} unique tickers across all portfolios\n`);
    
    // Verify each ticker
    let updatedCount = 0;
    let errorCount = 0;
    let upToDateCount = 0;
    
    for (const ticker of uniqueTickers) {
      console.log(`\n📊 Checking ${ticker}...`);
      
      // Get current DB price
      const stockInDb = allStocks.find(s => s.ticker === ticker);
      if (stockInDb) {
        console.log(`   DB Price: ${stockInDb.currentPrice || 'N/A'}`);
        console.log(`   Last Refresh: ${stockInDb.lastDataRefresh || 'Never'}`);
      } else {
        console.log(`   ⚠️  Stock not found in database`);
      }
      
      // Fetch current API price
      const apiData = await fetchCurrentPrice(ticker);
      
      if (apiData) {
        console.log(`   API Price: ${apiData.price} (${apiData.date})`);
        
        // Compare and update if different
        if (stockInDb) {
          const dbPrice = parseFloat(stockInDb.currentPrice || '0');
          const apiPrice = parseFloat(apiData.price);
          
          if (Math.abs(dbPrice - apiPrice) > 0.01) {
            console.log(`   ⚠️  Price mismatch! DB: ${dbPrice}, API: ${apiPrice}`);
            
            try {
              await connection.execute(
                'UPDATE stocks SET currentPrice = ?, lastDataRefresh = NOW() WHERE ticker = ?',
                [apiPrice.toString(), ticker]
              );
              console.log(`   ✅ Updated ${ticker}: ${apiPrice} (${apiData.date})`);
              updatedCount++;
            } catch (error) {
              console.log(`   ❌ Error updating ${ticker}:`, error.message);
              errorCount++;
            }
          } else {
            console.log(`   ✅ Price is current`);
            upToDateCount++;
          }
        }
      } else {
        errorCount++;
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log('\n\n=== Summary ===');
    console.log(`Total tickers checked: ${uniqueTickers.size}`);
    console.log(`✅ Updated: ${updatedCount}`);
    console.log(`✅ Up to date: ${upToDateCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    
  } finally {
    await connection.end();
  }
}

// Run verification
verifyPortfolioPrices()
  .then(() => {
    console.log('\n✅ Verification complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });
