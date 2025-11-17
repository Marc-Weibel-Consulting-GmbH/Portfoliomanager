import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

async function main() {
  console.log('🔧 Inserting ytdStartPrices as 2024-12-31 data points...\n');
  
  // Get all stocks with ytdStartPrice
  const [stocks] = await connection.execute(
    'SELECT ticker, ytdStartPrice FROM stocks WHERE ytdStartPrice IS NOT NULL AND ytdStartPrice > 0'
  );
  
  console.log(`📊 Found ${stocks.length} stocks with ytdStartPrice\n`);
  
  let insertedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  for (const { ticker, ytdStartPrice } of stocks) {
    try {
      // Check if 2024-12-31 already exists for this ticker
      const [existing] = await connection.execute(
        'SELECT COUNT(*) as count FROM historicalPrices WHERE ticker = ? AND date = ?',
        [ticker, '2024-12-31']
      );
      
      if (existing[0].count > 0) {
        console.log(`  ⏭️  ${ticker}: 2024-12-31 already exists`);
        skippedCount++;
        continue;
      }
      
      // Insert ytdStartPrice as 2024-12-31 data point
      await connection.execute(
        `INSERT INTO historicalPrices (ticker, date, \`close\`, source, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [ticker, '2024-12-31', parseFloat(ytdStartPrice), 'ytdStartPrice']
      );
      
      console.log(`  ✅ ${ticker}: Inserted ${parseFloat(ytdStartPrice).toFixed(2)} for 2024-12-31`);
      insertedCount++;
      
    } catch (error) {
      console.error(`  ❌ ${ticker}: Error - ${error.message}`);
      errorCount++;
    }
  }
  
  console.log(`\n\n✨ Done!`);
  console.log(`  ✅ Inserted: ${insertedCount}`);
  console.log(`  ⏭️  Skipped: ${skippedCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log(`  📊 Total: ${stocks.length}`);
  
  await connection.end();
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  connection.end();
  process.exit(1);
});
