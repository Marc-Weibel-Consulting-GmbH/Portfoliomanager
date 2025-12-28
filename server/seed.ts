import { getDb, insertStock } from "./db.js";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function seedDatabase() {
  try {
    const dataPath = __dirname + "/stock_data.json";
    const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

    const db = await getDb();
    if (!db) {
      console.error("Database not available");
      return;
    }

    for (const stock of data) {
      try {
        await insertStock({
          companyName: stock.company_name,
          ticker: stock.ticker,
          currentPrice: stock.current_price?.toString(),
          currency: stock.currency,
          peRatio: stock.pe_ratio?.toString(),
          pegRatio: stock.peg_ratio?.toString(),
          dividendYield: stock.dividend_yield?.toString(),
          exchangeRateToChf: stock.exchange_rate_to_chf?.toString(),
          category: stock.category,
          moat1: stock.moats?.[0],
          moat2: stock.moats?.[1],
          moat3: stock.moats?.[2],
        });
        console.log(`✓ Inserted: ${stock.ticker}`);
      } catch (error) {
        console.warn(`⚠ Skipped ${stock.ticker}:`, (error as any).message);
      }
    }

    console.log("✓ Database seeding completed");
  } catch (error) {
    console.error("Seeding failed:", error);
  }
}

seedDatabase();
