import { getDb } from "../server/db";
import { stocks } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

async function importFinancialHighlights() {
  console.log("Starting financial highlights import...");
  
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    return;
  }
  
  // Read the CSV file
  const csvPath = path.join(process.cwd(), "upload", "pasted_content.txt");
  const csvContent = fs.readFileSync(csvPath, "utf-8");
  
  // Parse CSV
  const lines = csvContent.trim().split("\n");
  const headers = lines[0].split(",");
  
  console.log(`Found ${lines.length - 1} stocks to update`);
  
  let updated = 0;
  let notFound = 0;
  let failed = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    
    // Parse CSV line (handle commas inside quotes)
    const parts: string[] = [];
    let currentPart = "";
    let insideQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        parts.push(currentPart.trim());
        currentPart = "";
      } else {
        currentPart += char;
      }
    }
    parts.push(currentPart.trim());
    
    if (parts.length < 5) {
      console.log(`⚠ Skipping line ${i}: Invalid format`);
      failed++;
      continue;
    }
    
    const ticker = parts[0].trim();
    const companyName = parts[1].trim();
    const highlight1 = parts[2].trim();
    const highlight2 = parts[3].trim();
    const highlight3 = parts[4].trim();
    
    console.log(`\nProcessing ${ticker} (${companyName})...`);
    
    try {
      // Check if stock exists
      const existingStocks = await db.select().from(stocks).where(eq(stocks.ticker, ticker));
      
      if (existingStocks.length === 0) {
        console.log(`✗ Stock ${ticker} not found in database`);
        notFound++;
        continue;
      }
      
      // Update financial highlights
      await db
        .update(stocks)
        .set({
          financialHighlight1: highlight1 || null,
          financialHighlight2: highlight2 || null,
          financialHighlight3: highlight3 || null,
        })
        .where(eq(stocks.ticker, ticker));
      
      console.log(`✓ Updated ${ticker}`);
      console.log(`  1. ${highlight1}`);
      console.log(`  2. ${highlight2}`);
      console.log(`  3. ${highlight3}`);
      updated++;
    } catch (error) {
      console.error(`✗ Error updating ${ticker}:`, error);
      failed++;
    }
  }
  
  console.log("\n=== Import Complete ===");
  console.log(`Updated: ${updated} stocks`);
  console.log(`Not found: ${notFound} stocks`);
  console.log(`Failed: ${failed} stocks`);
}

// Run the import
importFinancialHighlights()
  .then(() => {
    console.log("\nFinancial highlights import completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nError importing financial highlights:", error);
    process.exit(1);
  });

