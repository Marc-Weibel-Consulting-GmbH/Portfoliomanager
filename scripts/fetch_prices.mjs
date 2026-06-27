/**
 * Fetch historical prices from DB and save to CSV for Python evaluation
 */
import { createConnection } from "mysql2/promise";
import { createWriteStream } from "fs";
import { resolve } from "path";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) { console.error("No DATABASE_URL"); process.exit(1); }

const conn = await createConnection(dbUrl);
console.log("Connected. Fetching prices...");

const [rows] = await conn.execute(
  "SELECT ticker, date, adjustedClose FROM historicalPrices WHERE adjustedClose > 0 ORDER BY ticker, date ASC"
);
await conn.end();

console.log(`Fetched ${rows.length} rows. Writing CSV...`);

const out = createWriteStream("/tmp/prices.csv");
out.write("ticker,date,close\n");
for (const r of rows) {
  const d = r.date instanceof Date ? r.date.toISOString().slice(0,10) : String(r.date);
  out.write(`${r.ticker},${d},${r.adjustedClose}\n`);
}
out.end();
out.on("finish", () => console.log("Done: /tmp/prices.csv"));
