// Ralph-Loop seed helper — füllt die lokale DB mit Demo-Stammdaten aus einem Export.
// Anders als scripts/import-data.ts ohne interaktiven readline-Prompt (ESM-clean).
// Usage: pnpm tsx scripts/ralph-seed.ts <export.json>
import { getDb } from "../server/db";
import { stocks, research, transactions } from "../drizzle/schema";
import * as fs from "fs";

async function main() {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) {
    console.error("❌ Export-Datei fehlt. Usage: pnpm tsx scripts/ralph-seed.ts <export.json>");
    process.exit(1);
  }
  const db = await getDb();
  if (!db) { console.error("❌ DB nicht verfügbar (DATABASE_URL?)"); process.exit(1); }

  const { data } = JSON.parse(fs.readFileSync(file, "utf-8"));
  const strip = (rows: any[], keys: string[]) =>
    rows.map((r) => { const c = { ...r }; keys.forEach((k) => delete c[k]); return c; });

  await db.delete(transactions);
  await db.delete(research);
  await db.delete(stocks);

  if (data.stocks?.length) {
    await db.insert(stocks).values(strip(data.stocks, ["id", "createdAt", "updatedAt"]));
    console.log(`✓ ${data.stocks.length} stocks`);
  }
  if (data.research?.length) {
    await db.insert(research).values(strip(data.research, ["id", "createdAt", "updatedAt"]));
    console.log(`✓ ${data.research.length} research`);
  }
  if (data.transactions?.length) {
    await db.insert(transactions).values(strip(data.transactions, ["id", "createdAt"]));
    console.log(`✓ ${data.transactions.length} transactions`);
  }
  console.log("✅ Seed fertig.");
  process.exit(0);
}
main().catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); });
