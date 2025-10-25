import { getDb } from '../server/db';
import { stocks, research, transactions } from '../drizzle/schema';
import * as fs from 'fs';
import * as path from 'path';

async function importData() {
  console.log('🔄 Starting data import...\n');
  
  // Get import file from command line argument
  const importFile = process.argv[2];
  
  if (!importFile) {
    console.error('❌ Please provide import file path');
    console.log('Usage: pnpm import-data <path-to-export-file.json>');
    process.exit(1);
  }
  
  if (!fs.existsSync(importFile)) {
    console.error(`❌ File not found: ${importFile}`);
    process.exit(1);
  }
  
  const db = await getDb();
  if (!db) {
    console.error('❌ Database not available');
    process.exit(1);
  }
  
  try {
    // Read import file
    const fileContent = fs.readFileSync(importFile, 'utf-8');
    const importObj = JSON.parse(fileContent);
    
    console.log(`📅 Export date: ${importObj.exportDate}`);
    console.log(`📦 Version: ${importObj.version}\n`);
    
    const { stocks: stocksData, research: researchData, transactions: transactionsData } = importObj.data;
    
    console.log('⚠️  WARNING: This will DELETE all existing data!');
    console.log(`📊 Import summary:`);
    console.log(`   - Stocks: ${stocksData.length}`);
    console.log(`   - Research: ${researchData.length}`);
    console.log(`   - Transactions: ${transactionsData.length}\n`);
    
    // Ask for confirmation
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    const answer = await new Promise<string>((resolve) => {
      readline.question('Continue? (yes/no): ', resolve);
    });
    readline.close();
    
    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Import cancelled');
      process.exit(0);
    }
    
    console.log('\n🗑️  Deleting existing data...');
    
    // Delete existing data
    await db.delete(transactions);
    console.log('✓ Deleted transactions');
    
    await db.delete(research);
    console.log('✓ Deleted research');
    
    await db.delete(stocks);
    console.log('✓ Deleted stocks');
    
    console.log('\n📥 Importing new data...');
    
    // Import stocks
    if (stocksData.length > 0) {
      // Remove id and timestamps to let database generate new ones
      const stocksToInsert = stocksData.map((s: any) => {
        const { id, createdAt, updatedAt, ...rest } = s;
        return rest;
      });
      await db.insert(stocks).values(stocksToInsert);
      console.log(`✓ Imported ${stocksData.length} stocks`);
    }
    
    // Import research
    if (researchData.length > 0) {
      const researchToInsert = researchData.map((r: any) => {
        const { id, createdAt, updatedAt, ...rest } = r;
        return rest;
      });
      await db.insert(research).values(researchToInsert);
      console.log(`✓ Imported ${researchData.length} research entries`);
    }
    
    // Import transactions
    if (transactionsData.length > 0) {
      const transactionsToInsert = transactionsData.map((t: any) => {
        const { id, createdAt, ...rest } = t;
        return rest;
      });
      await db.insert(transactions).values(transactionsToInsert);
      console.log(`✓ Imported ${transactionsData.length} transactions`);
    }
    
    console.log('\n✅ Import completed successfully!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

importData();

