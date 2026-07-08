import { getStockByTicker } from "../../server/db";

async function main() {
  const result = await getStockByTicker("LVMUY");
  if (result) {
    console.log("FOUND:", JSON.stringify({ id: result.id, ticker: result.ticker, name: result.companyName, price: result.currentPrice }));
  } else {
    console.log("NOT FOUND - checking with .US suffix...");
    const result2 = await getStockByTicker("LVMUY.US");
    if (result2) {
      console.log("FOUND with .US:", JSON.stringify({ id: result2.id, ticker: result2.ticker }));
    } else {
      console.log("NOT FOUND with .US either");
    }
  }
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
