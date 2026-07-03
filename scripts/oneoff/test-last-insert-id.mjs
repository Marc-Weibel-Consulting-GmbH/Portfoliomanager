import { drizzle } from "drizzle-orm/mysql2";
import { savedPortfolios } from "./drizzle/schema.js";
import { sql, eq } from "drizzle-orm";

async function main() {
  const db = drizzle(process.env.DATABASE_URL);
  
  console.log("[Test] Starting LAST_INSERT_ID test...");
  
  // 1) DB Ping
  await db.execute(sql`SELECT 1`);
  console.log("[Test] DB connection OK");
  
  // 2) Insert portfolio
  const portfolioData = {
    userId: 1,
    name: "LAST_INSERT_ID Test",
    investmentAmount: "50000",
    portfolioType: "demo",
  };
  
  console.log("[Test] Inserting portfolio:", portfolioData);
  await db.insert(savedPortfolios).values(portfolioData);
  console.log("[Test] Insert completed");
  
  // 3) Get LAST_INSERT_ID
  const lastIdResult = await db.execute(sql`SELECT LAST_INSERT_ID() as id`);
  console.log("[Test] LAST_INSERT_ID result:", JSON.stringify(lastIdResult, null, 2));
  
  const lastId = lastIdResult[0][0]?.id;
  console.log("[Test] Extracted lastId:", lastId);
  
  if (!lastId) {
    console.error("[Test] ERROR: Failed to get LAST_INSERT_ID!");
    process.exit(1);
  }
  
  // 4) Fetch the inserted portfolio
  const inserted = await db
    .select()
    .from(savedPortfolios)
    .where(eq(savedPortfolios.id, Number(lastId)))
    .limit(1);
  
  console.log("[Test] Fetched portfolio:", JSON.stringify(inserted, null, 2));
  
  if (!inserted || inserted.length === 0) {
    console.error("[Test] ERROR: Failed to fetch inserted portfolio!");
    process.exit(1);
  }
  
  console.log("[Test] SUCCESS! Portfolio ID:", inserted[0].id);
  console.log("[Test] Return format:", JSON.stringify({ ok: true, portfolio: inserted[0] }, null, 2));
}

main().catch(e => {
  console.error("[Test] ERROR:", e);
  process.exit(1);
});
