import { int, mysqlEnum, mysqlTable, text, timestamp, tinyint, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /**
   * Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user.
   * This mirrors the Manus account and should be used for authentication lookups.
   */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  hasPaid: tinyint("hasPaid").notNull().default(0),
  paymentDate: timestamp("paymentDate"),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Portfolio stocks table
export const stocks = mysqlTable("stocks", {
  id: int("id").autoincrement().primaryKey(),
  companyName: varchar("companyName", { length: 255 }).notNull(),
  ticker: varchar("ticker", { length: 50 }).notNull().unique(),
  currentPrice: varchar("currentPrice", { length: 50 }),
  currency: varchar("currency", { length: 10 }),
  peRatio: varchar("peRatio", { length: 50 }),
  pegRatio: varchar("pegRatio", { length: 50 }),
  dividendYield: varchar("dividendYield", { length: 50 }),
  exchangeRateToChf: varchar("exchangeRateToChf", { length: 50 }),
  category: varchar("category", { length: 100 }),
  moat1: text("moat1"),
  moat2: text("moat2"),
  moat3: text("moat3"),
  portfolioWeight: varchar("portfolioWeight", { length: 50 }).default("0"),
  isManualWeight: tinyint("isManualWeight").notNull().default(0),
  chartData: text("chartData"),
  ytdStartPrice: varchar("ytdStartPrice", { length: 50 }),
  ytdPerformance: varchar("ytdPerformance", { length: 50 }),
  financialHighlight1: text("financialHighlight1"),
  financialHighlight2: text("financialHighlight2"),
  financialHighlight3: text("financialHighlight3"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Stock = typeof stocks.$inferSelect;
export type InsertStock = typeof stocks.$inferInsert;

export const news = mysqlTable("news", {
  id: int("id").autoincrement().primaryKey(),
  ticker: varchar("ticker", { length: 20 }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  url: varchar("url", { length: 500 }),
  imageUrl: varchar("imageUrl", { length: 500 }),
  source: varchar("source", { length: 100 }),
  priority: mysqlEnum("priority", ["Wichtig", "Mittel", "Niedrig"]).default("Mittel"),
  publishedAt: timestamp("publishedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type News = typeof news.$inferSelect;
export type InsertNews = typeof news.$inferInsert;

// Transaction log table
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  action: mysqlEnum("action", ["add", "delete", "update_weight", "update_data"]).notNull(),
  ticker: varchar("ticker", { length: 50 }).notNull(),
  companyName: varchar("companyName", { length: 255 }),
  details: text("details"), // JSON string with change details
  oldValue: text("oldValue"),
  newValue: text("newValue"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;



// Research content table
export const research = mysqlTable("research", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  fileUrl: varchar("fileUrl", { length: 500 }),
  fileType: varchar("fileType", { length: 50 }),
  fileName: varchar("fileName", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Research = typeof research.$inferSelect;
export type InsertResearch = typeof research.$inferInsert;



// Newsletter subscribers table
export const newsletter = mysqlTable("newsletter", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  subscribedAt: timestamp("subscribedAt").defaultNow().notNull(),
  isActive: tinyint("isActive").notNull().default(1),
});

export type Newsletter = typeof newsletter.$inferSelect;
export type InsertNewsletter = typeof newsletter.$inferInsert;

// Payments table
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  stripePaymentId: varchar("stripePaymentId", { length: 255 }),
  amount: int("amount").notNull(), // Amount in cents (CHF 10.00 = 1000)
  currency: varchar("currency", { length: 3 }).notNull().default("CHF"),
  status: mysqlEnum("status", ["pending", "completed", "failed", "refunded"]).notNull().default("pending"),
  paymentMethod: varchar("paymentMethod", { length: 50 }), // e.g., "twint", "card"
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

