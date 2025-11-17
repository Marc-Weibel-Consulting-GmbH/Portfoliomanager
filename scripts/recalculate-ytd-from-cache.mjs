import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

async function main() {
  console.log('🔧 Recalculating ytdStartPrices from historicalPrices cache...\n');
  
  // Target date: 2024-12-31 (or closest available date)
  const targetDate = '2024-12-31';
  const fallbackDate = '2024-12-30'; // Monday before New Year
  
  // Get all stocks with cached historical data
  const [cachedTickers] = await connection.execute(
    'SELECT DISTINCT ticker FROM historicalPrices'
  );
  
  console.log(`📊 Found ${cachedTickers.length} stocks with cached data\n`);
  
  let updatedCount = 0;
  let notFoundCount = 0;
  let skippedCount = 0;
  
  for (const { ticker } of cachedTickers) {
    // Try to get price from target date or fallback date
    const [prices] = await connection.execute(
      `SELECT \`close\`, date FROM historicalPrices 
       WHERE ticker = ? AND (date = ? OR date = ?)
       ORDER BY date DESC LIMIT 1`,
      [ticker, targetDate, fallbackDate]
    );
    
    if (prices.length > 0) {
      const ytdStartPrice = parseFloat(prices[0].close);
      const actualDate = prices[0].date;
      
      // Update stocks table
      const [result] = await connection.execute(
        'UPDATE stocks SET ytdStartPrice = ? WHERE ticker = ?',
        [ytdStartPrice.toFixed(6), ticker]
      );
      
      if (result.affectedRows > 0) {
        console.log(`  ✅ ${ticker}: ${ytdStartPrice.toFixed(2)} (from ${actualDate})`);
        updatedCount++;
      } else {
        console.log(`  ⏭️  ${ticker}: Not found in stocks table`);
        skippedCount++;
      }
    } else {
      // Try to get the earliest available price in 2025
      const [earliestPrices] = await connection.execute(
        `SELECT \`close\`, date FROM historicalPrices 
         WHERE ticker = ? AND date >= '2025-01-01'
         ORDER BY date ASC LIMIT 1`,
        [ticker]
      );
      
      if (earliestPrices.length > 0) {
        const ytdStartPrice = parseFloat(earliestPrices[0].close);
        const actualDate = earliestPrices[0].date;
        
        const [result] = await connection.execute(
          'UPDATE stocks SET ytdStartPrice = ? WHERE ticker = ?',
          [ytdStartPrice.toFixed(6), ticker]
        );
        
        if (result.affectedRows > 0) {
          console.log(`  ⚠️  ${ticker}: ${ytdStartPrice.toFixed(2)} (from ${actualDate}, no 2024 data)`);
          updatedCount++;
        } else {
          console.log(`  ⏭️  ${ticker}: Not found in stocks table`);
          skippedCount++;
        }
      } else {
        console.log(`  ❌ ${ticker}: No data for ${targetDate} or ${fallbackDate}`);
        notFoundCount++;
      }
    }
  }
  
  console.log(`\n\n✨ Done!`);
  console.log(`  ✅ Updated: ${updatedCount}`);
  console.log(`  ❌ Not found: ${notFoundCount}`);
  console.log(`  ⏭️  Skipped: ${skippedCount}`);
  console.log(`  📊 Total: ${cachedTickers.length}`);
  
  await connection.end();
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  connection.end();
  process.exit(1);
});
