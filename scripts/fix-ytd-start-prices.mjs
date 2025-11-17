import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

async function main() {
  console.log('🔧 Fixing ytdStartPrice values...\n');
  
  // Get all stocks
  const [stocks] = await connection.execute('SELECT id, ticker, ytdStartPrice, currentPrice FROM stocks');
  console.log(`📊 Found ${stocks.length} stocks\n`);
  
  let fixedCount = 0;
  let skippedCount = 0;
  
  for (const stock of stocks) {
    const ticker = stock.ticker.replace(/\s+•\s+/, '.');
    const ytdStartPrice = parseFloat(stock.ytdStartPrice || '0');
    const currentPrice = parseFloat(stock.currentPrice || '0');
    
    // Check if ytdStartPrice looks wrong (too close to currentPrice or zero)
    const ratio = ytdStartPrice > 0 ? currentPrice / ytdStartPrice : 0;
    
    if (ytdStartPrice === 0 || ratio > 0.95 && ratio < 1.05) {
      // ytdStartPrice is missing or looks like currentPrice
      // Calculate it from ytdPerformance: startPrice = currentPrice / (1 + ytdPerf/100)
      const [perfRows] = await connection.execute(
        'SELECT ytdPerformance FROM stocks WHERE id = ?',
        [stock.id]
      );
      
      const ytdPerf = parseFloat(perfRows[0]?.ytdPerformance || '0');
      
      if (ytdPerf !== 0 && currentPrice > 0) {
        const calculatedStartPrice = currentPrice / (1 + ytdPerf / 100);
        
        console.log(`  🔄 ${ticker}:`);
        console.log(`     Current: ${currentPrice.toFixed(2)}, YTD Perf: ${ytdPerf.toFixed(2)}%`);
        console.log(`     Old Start: ${ytdStartPrice.toFixed(2)}, New Start: ${calculatedStartPrice.toFixed(2)}`);
        
        await connection.execute(
          'UPDATE stocks SET ytdStartPrice = ? WHERE id = ?',
          [calculatedStartPrice.toFixed(6), stock.id]
        );
        
        fixedCount++;
      } else {
        console.log(`  ⏭️  ${ticker}: Skipped (no ytdPerformance or currentPrice)`);
        skippedCount++;
      }
    } else {
      console.log(`  ✅ ${ticker}: ytdStartPrice looks correct (${ytdStartPrice.toFixed(2)})`);
      skippedCount++;
    }
  }
  
  console.log(`\n\n✨ Done!`);
  console.log(`  🔧 Fixed: ${fixedCount}`);
  console.log(`  ⏭️  Skipped: ${skippedCount}`);
  console.log(`  📊 Total: ${stocks.length}`);
  
  await connection.end();
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  connection.end();
  process.exit(1);
});
