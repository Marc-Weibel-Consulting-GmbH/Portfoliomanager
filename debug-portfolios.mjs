import { drizzle } from "drizzle-orm/mysql2";
import { eq, desc } from "drizzle-orm";
import { savedPortfolios, users } from "./drizzle/schema.js";

const db = drizzle(process.env.DATABASE_URL);

// Get all users
const allUsers = await db.select().from(users);
console.log("\n=== ALL USERS ===");
allUsers.forEach(u => {
  console.log(`ID: ${u.id}, Name: ${u.name}, Email: ${u.email}, OpenID: ${u.openId}`);
});

// Get all portfolios
const allPortfolios = await db.select().from(savedPortfolios).orderBy(desc(savedPortfolios.createdAt)).limit(15);
console.log("\n=== ALL PORTFOLIOS ===");
allPortfolios.forEach(p => {
  console.log(`ID: ${p.id}, UserID: ${p.userId}, Name: ${p.name}, IsLive: ${p.isLive}, Created: ${p.createdAt}`);
});

// Get portfolios for user ID 1
const user1Portfolios = await db.select().from(savedPortfolios).where(eq(savedPortfolios.userId, 1));
console.log("\n=== PORTFOLIOS FOR USER 1 ===");
console.log(`Count: ${user1Portfolios.length}`);
user1Portfolios.forEach(p => {
  console.log(`ID: ${p.id}, Name: ${p.name}, IsLive: ${p.isLive}`);
});

process.exit(0);
