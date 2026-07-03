import mysql from 'mysql2/promise';

const FMP_API_KEY = process.env.FMP_API_KEY;
if (!FMP_API_KEY) {
  console.error('FMP_API_KEY environment variable is required');
  process.exit(1);
}

async function fetchYTDPrices() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    console.log('Fetching YTD start prices using FMP API (January 2, 2025)...');
    console.log('='.repeat(80));
    
    const [stocks] = await conn.query('SELECT id, ticker, companyName, currentPrice FROM stocks ORDER BY ticker');
    
    let updated = 0;
    let failed = 0;
    
    for (const stock of stocks) {
      try {
        // Clean ticker for FMP (remove exchange suffixes)
        let fmpTicker = stock.ticker
          .replace('.SW', '')
          .replace('.PA', '')
          .replace('.MI', '')
          .replace('.CO', '')
          .replace('.DE', '')
          .replace('.AS', '');
        
        // Fetch historical data from FMP
        const response = await fetch(
          `https://financialmodelingprep.com/api/v3/historical-price-full/${fmpTicker}?from=2025-01-01&to=2025-01-10&apikey=${FMP_API_KEY}`
        );
        
        if (!response.ok) {
          console.log(`✗ ${stock.ticker.padEnd(15)} - API Error (${response.status})`);
          failed++;
          continue;
        }
        
        const data = await response.json();
        const historical = data?.historical;
        
        if (!historical || historical.length === 0) {
          console.log(`✗ ${stock.ticker.padEnd(15)} - No data`);
          failed++;
          continue;
        }
        
        // Get the first trading day of 2025 (should be around Jan 2-3)
        const ytdStartPrice = historical[historical.length - 1].close;
        const currentPrice = parseFloat(stock.currentPrice);
        
        if (!ytdStartPrice || ytdStartPrice <= 0) {
          console.log(`✗ ${stock.ticker.padEnd(15)} - Invalid price`);
          failed++;
          continue;
        }
        
        // Calculate YTD performance
        const ytdPerformance = ((currentPrice - ytdStartPrice) / ytdStartPrice) * 100;
        
        // Store in database
        await conn.query(
          'UPDATE stocks SET ytdStartPrice = ?, ytdPerformance = ? WHERE id = ?',
          [ytdStartPrice, ytdPerformance, stock.id]
        );
        
        console.log(`✓ ${stock.ticker.padEnd(15)} - Start: ${ytdStartPrice.toFixed(2)}, Current: ${currentPrice.toFixed(2)}, YTD: ${ytdPerformance.toFixed(2)}%`);
        updated++;
        
      } catch (error) {
        console.log(`✗ ${stock.ticker.padEnd(15)} - Error: ${error.message}`);
        failed++;
      }
      
      // Rate limiting (FMP allows 250 requests/day on free tier)
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log('='.repeat(80));
    console.log(`\nCompleted: ${updated} updated, ${failed} failed`);
    
    // Calculate weighted portfolio YTD performance
    const [result] = await conn.query(`
      SELECT 
        SUM(ytdPerformance * portfolioWeight / 100) as weightedYTD,
        SUM(portfolioWeight) as totalWeight
      FROM stocks 
      WHERE ytdPerformance IS NOT NULL
    `);
    
    if (result[0].weightedYTD) {
      console.log(`\nPortfolio YTD Performance (weighted): ${result[0].weightedYTD.toFixed(2)}%`);
    }
    
  } finally {
    await conn.end();
  }
}

fetchYTDPrices().catch(console.error);
