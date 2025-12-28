import { getDb } from '../server/db';
import { stocks, research, transactions } from '../drizzle/schema';
import * as fs from 'fs';
import * as path from 'path';

async function exportData() {
  console.log('🔄 Starting data export...\n');
  
  const db = await getDb();
  if (!db) {
    console.error('❌ Database not available');
    process.exit(1);
  }
  
  try {
    // Export stocks
    const stocksData = await db.select().from(stocks);
    console.log(`✓ Exported ${stocksData.length} stocks`);
    
    // Export research
    const researchData = await db.select().from(research);
    console.log(`✓ Exported ${researchData.length} research entries`);
    
    // Export transactions
    const transactionsData = await db.select().from(transactions);
    console.log(`✓ Exported ${transactionsData.length} transactions`);
    
    // Create export object
    const exportObj = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      data: {
        stocks: stocksData,
        research: researchData,
        transactions: transactionsData,
      },
    };
    
    // Save to file
    const exportDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `portfolio-export-${timestamp}.json`;
    const filepath = path.join(exportDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(exportObj, null, 2));
    
    console.log(`\n✅ Export completed successfully!`);
    console.log(`📁 File: ${filepath}`);
    console.log(`\n📊 Summary:`);
    console.log(`   - Stocks: ${stocksData.length}`);
    console.log(`   - Research: ${researchData.length}`);
    console.log(`   - Transactions: ${transactionsData.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  }
}

exportData();

