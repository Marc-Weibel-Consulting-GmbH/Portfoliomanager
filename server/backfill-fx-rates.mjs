import { drizzle } from "drizzle-orm/mysql2";
import { portfolioTransactions } from "../drizzle/schema.ts";
import { eq } from "drizzle-orm";

const db = drizzle(process.env.DATABASE_URL);

async function getFxRate(date, currencyPair) {
  const { fxRates } = await import("../drizzle/schema.ts");
  const dateStr = new Date(date).toISOString().split('T')[0];
  
  const result = await db
    .select()
    .from(fxRates)
    .where(eq(fxRates.date, dateStr))
    .where(eq(fxRates.currencyPair, currencyPair))
    .limit(1);
  
  return result.length > 0 ? parseFloat(result[0].rate) : 1.0;
}

async function backfillFxRates() {
  console.log("=== Backfilling FX Rates and CHF Amounts ===");
  
  // Get all transactions
  const transactions = await db.select().from(portfolioTransactions);
  console.log(`Found ${transactions.length} transactions`);
  
  for (const tx of transactions) {
    const currency = tx.currency || "CHF";
    let fxRate = 1.0;
    
    if (currency !== "CHF") {
      fxRate = await getFxRate(tx.transactionDate, `${currency}CHF`);
    }
    
    const totalAmount = parseFloat(tx.totalAmount || "0");
    const totalAmountCHF = totalAmount * fxRate;
    
    console.log(`Transaction ${tx.id} (${tx.ticker || 'N/A'}): ${currency} ${totalAmount.toFixed(2)} × ${fxRate.toFixed(4)} = CHF ${totalAmountCHF.toFixed(2)}`);
    
    await db
      .update(portfolioTransactions)
      .set({
        fxRate: fxRate.toString(),
        totalAmountCHF: totalAmountCHF.toString()
      })
      .where(eq(portfolioTransactions.id, tx.id));
  }
  
  console.log("=== Backfill Complete ===");
  process.exit(0);
}

backfillFxRates().catch(console.error);
