import { drizzle } from "drizzle-orm/mysql2";
import { mysqlTable, int, varchar, text, timestamp, mysqlEnum } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

// Define schema inline for the test
const savedPortfolios = mysqlTable("savedPortfolios", {
  id: int("id").autoincrement().primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  investmentAmount: varchar("investmentAmount", { length: 50 }).notNull(),
  portfolioType: mysqlEnum("portfolioType", ["demo", "live"]).default("demo").notNull(),
  portfolioData: text("portfolioData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set");
  }

  const db = drizzle(process.env.DATABASE_URL);

  console.log("[Test] Testing DB connection...");
  await db.execute(sql`SELECT 1`);
  console.log("[Test] DB connection OK");

  console.log("[Test] Inserting test portfolio...");
  const res = await db.insert(savedPortfolios).values({
    userId: 1, // Use numeric ID
    name: "Debug Insert",
    investmentAmount: "75000",
    portfolioType: "demo",
  });

  console.log("[Test] Insert result:", res);
  console.log("[Test] Success!");
}

main().catch(e => {
  console.error("[Test] ERROR:", e);
  process.exit(1);
});
