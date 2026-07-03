import mysql from 'mysql2/promise';

async function fetchYTDPrices() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    console.log('Fetching YTD start prices (January 2, 2025)...');
    console.log('='.repeat(80));
    
    const [stocks] = await conn.query('SELECT id, ticker, companyName, currentPrice FROM stocks ORDER BY ticker');
    
    let updated = 0;
    let failed = 0;
    
    for (const stock of stocks) {
      try {
        // Fetch historical data for January 2, 2025
        const response = await fetch(
          `https://data.manus.im/yahoo-finance/v8/finance/chart/${stock.ticker}?interval=1d&range=1y`
        );
        
        if (!response.ok) {
          console.log(`✗ ${stock.ticker.padEnd(15)} - API Error`);
          failed++;
          continue;
        }
        
        const data = await response.json();
        const quotes = data?.chart?.result?.[0]?.indicators?.quote?.[0];
        const timestamps = data?.chart?.result?.[0]?.timestamp;
        
        if (!quotes || !timestamps) {
          console.log(`✗ ${stock.ticker.padEnd(15)} - No data`);
          failed++;
          continue;
        }
        
        // Find the first trading day of 2025 (around January 2-3)
        const targetDate = new Date('2025-01-02').getTime() / 1000;
        let closestIndex = 0;
        let closestDiff = Math.abs(timestamps[0] - targetDate);
        
        for (let i = 1; i < timestamps.length; i++) {
          const diff = Math.abs(timestamps[i] - targetDate);
          if (diff < closestDiff) {
            closestDiff = diff;
            closestIndex = i;
          }
        }
        
        const ytdStartPrice = quotes.close[closestIndex];
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
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('='.repeat(80));
    console.log(`\nCompleted: ${updated} updated, ${failed} failed`);
    
  } finally {
    await conn.end();
  }
}

fetchYTDPrices().catch(console.error);
