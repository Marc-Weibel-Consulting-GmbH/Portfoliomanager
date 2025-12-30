import { date, decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, tinyint, varchar } from "drizzle-orm/mysql-core";

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
   * Optional OAuth identifier (openId) for OAuth-based authentication.
   * For email/password auth, this field can be null.
   */
  openId: varchar("openId", { length: 64 }).unique(),
  username: varchar("username", { length: 50 }),
  name: text("name"),
  firstName: varchar("firstName", { length: 255 }),
  lastName: varchar("lastName", { length: 255 }),
  email: varchar("email", { length: 320 }).unique(),
  password: varchar("password", { length: 255 }),
  mobile: varchar("mobile", { length: 50 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  hasPaid: tinyint("hasPaid").notNull().default(0),
  paymentDate: timestamp("paymentDate"),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  whatsappAlerts: tinyint("whatsappAlerts").notNull().default(0),
  emailVerified: tinyint("emailVerified").notNull().default(0),
  hasSeenOnboarding: tinyint("hasSeenOnboarding").notNull().default(0),
  hasDemoPortfolio: tinyint("hasDemoPortfolio").notNull().default(0),
  hasCompletedRegistration: tinyint("hasCompletedRegistration").notNull().default(0),
  hasCompletedOnboarding: tinyint("hasCompletedOnboarding").notNull().default(0),
  subscriptionTier: mysqlEnum("subscriptionTier", ["free", "premium"]).default("free").notNull(),
  investmentGoal: mysqlEnum("investmentGoal", ["dividends", "growth", "balanced"]),
  riskTolerance: mysqlEnum("riskTolerance", ["low", "medium", "high"]),
  investmentHorizon: mysqlEnum("investmentHorizon", ["short", "medium", "long"]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Password reset tokens table
export const passwordResetTokens = mysqlTable("passwordResetTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

// Email verification tokens table
export const emailVerificationTokens = mysqlTable("emailVerificationTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type InsertEmailVerificationToken = typeof emailVerificationTokens.$inferInsert;

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
  sharpeRatio: varchar("sharpeRatio", { length: 50 }),
  volatility: varchar("volatility", { length: 50 }),
  beta: varchar("beta", { length: 50 }),
  marketCap: varchar("marketCap", { length: 50 }),
  week52High: varchar("week52High", { length: 50 }),
  week52Low: varchar("week52Low", { length: 50 }),
  lastDataRefresh: timestamp("lastDataRefresh"),
  exchangeRateToChf: varchar("exchangeRateToChf", { length: 50 }),
  category: varchar("category", { length: 100 }), // Investment type: Dividendenaktien, Wachstumsaktien, ETF
  sector: varchar("sector", { length: 100 }), // Industry sector: Automotive, Healthcare, Technology, etc.
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
  factsheetUrl: varchar("factsheetUrl", { length: 500 }), // ETF factsheet PDF URL
  logoUrl: varchar("logoUrl", { length: 500 }), // Company logo URL
  score: int("score").default(0), // Calculated score based on metrics (0-100)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Stock = typeof stocks.$inferSelect;
export type InsertStock = typeof stocks.$inferInsert;

// Categories table for managing stock categories
export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  color: varchar("color", { length: 50 }), // Optional color for UI (e.g., "bg-blue-500")
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

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
  comment: text("comment"), // User comment explaining the transaction
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



// Saved portfolios table - allows users to save multiple portfolio variants
export const savedPortfolios = mysqlTable("savedPortfolios", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // References users.id
  name: varchar("name", { length: 255 }).notNull(), // User-defined portfolio name
  description: text("description"), // Optional description
  portfolioData: text("portfolioData").notNull(), // JSON string with stocks and weights
  portfolioType: varchar("portfolioType", { length: 50 }), // Portfolio type: dividends, growth, balanced, etf
  status: mysqlEnum("status", ["planned", "live"]).notNull().default("planned"), // Portfolio status: planned or live
  startCapital: varchar("startCapital", { length: 50 }), // Initial capital when portfolio is activated
  benchmark: mysqlEnum("benchmark", ["SMI", "SP500", "MSCI_WORLD"]), // Benchmark for comparison
  isLive: tinyint("isLive").notNull().default(0), // 1 = Live tracking enabled, 0 = Test mode
  liveStartDate: timestamp("liveStartDate"), // Date when live tracking started
  livePerformance: varchar("livePerformance", { length: 50 }), // IRR/MWR performance (e.g., "12.5")
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SavedPortfolio = typeof savedPortfolios.$inferSelect;
export type InsertSavedPortfolio = typeof savedPortfolios.$inferInsert;

// Portfolio transactions table - tracks buys, sells, dividends for live portfolios
export const portfolioTransactions = mysqlTable("portfolioTransactions", {
  id: int("id").autoincrement().primaryKey(),
  portfolioId: int("portfolioId").notNull(), // References savedPortfolios.id
  transactionType: mysqlEnum("transactionType", ["buy", "sell", "dividend", "deposit", "withdrawal"]).notNull(),
  ticker: varchar("ticker", { length: 50 }), // null for deposit/withdrawal
  shares: varchar("shares", { length: 50 }), // Number of shares (for buy/sell)
  pricePerShare: varchar("pricePerShare", { length: 50 }), // Price per share in original currency
  currency: varchar("currency", { length: 10 }).default("CHF"), // Currency of the transaction (USD, EUR, CHF, etc.)
  totalAmount: varchar("totalAmount", { length: 50 }).notNull(), // Total amount in original currency
  fxRate: varchar("fxRate", { length: 50 }), // Exchange rate to CHF (e.g., 0.88 for USD/CHF)
  totalAmountCHF: varchar("totalAmountCHF", { length: 50 }), // Total amount converted to CHF
  fees: varchar("fees", { length: 50 }).default("0"), // Transaction fees in CHF
  notes: text("notes"), // Optional user notes
  transactionDate: timestamp("transactionDate").notNull(), // Date of the transaction
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  portfolioIdIdx: index("ix_portfolio_transactions_portfolio_id").on(t.portfolioId),
  tickerIdx: index("ix_portfolio_transactions_ticker").on(t.ticker),
}));

export type PortfolioTransaction = typeof portfolioTransactions.$inferSelect;
export type InsertPortfolioTransaction = typeof portfolioTransactions.$inferInsert;

// Realized gains/losses table - tracks realized gains/losses from sell transactions
export const realizedGains = mysqlTable("realizedGains", {
  id: int("id").autoincrement().primaryKey(),
  portfolioId: int("portfolioId").notNull(), // References savedPortfolios.id
  transactionId: int("transactionId").notNull(), // References portfolioTransactions.id (the sell transaction)
  ticker: varchar("ticker", { length: 50 }).notNull(),
  shares: varchar("shares", { length: 50 }).notNull(), // Number of shares sold
  avgCostBasis: varchar("avgCostBasis", { length: 50 }).notNull(), // Average purchase price per share
  sellPrice: varchar("sellPrice", { length: 50 }).notNull(), // Sell price per share
  realizedGain: varchar("realizedGain", { length: 50 }).notNull(), // Total realized gain/loss in CHF (can be negative)
  realizedGainPercent: varchar("realizedGainPercent", { length: 50 }).notNull(), // Gain/loss as percentage
  transactionDate: timestamp("transactionDate").notNull(), // Date of the sell transaction
  stockGainLocal: varchar("stockGainLocal", { length: 50 }), // Stock gain in local currency (USD, EUR, etc.)
  fxGain: varchar("fxGain", { length: 50 }), // FX gain/loss from currency conversion to CHF
  currency: varchar("currency", { length: 10 }), // Currency of the stock (USD, EUR, etc.)
  buyFxRate: varchar("buyFxRate", { length: 50 }), // FX rate at time of purchase
  sellFxRate: varchar("sellFxRate", { length: 50 }), // FX rate at time of sale
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  portfolioIdx: index("ix_realized_gains_portfolio").on(t.portfolioId),
  tickerIdx: index("ix_realized_gains_ticker").on(t.ticker),
}));

export type RealizedGain = typeof realizedGains.$inferSelect;
export type InsertRealizedGain = typeof realizedGains.$inferInsert;

// Historical metrics table - tracks Sharpe Ratio, PE, and other metrics over time
export const historicalMetrics = mysqlTable("historicalMetrics", {
  id: int("id").autoincrement().primaryKey(),
  ticker: varchar("ticker", { length: 50 }).notNull(),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
  sharpeRatio: varchar("sharpeRatio", { length: 50 }),
  peRatio: varchar("peRatio", { length: 50 }),
  pegRatio: varchar("pegRatio", { length: 50 }),
  dividendYield: varchar("dividendYield", { length: 50 }),
  beta: varchar("beta", { length: 50 }),
  volatility: varchar("volatility", { length: 50 }),
  currentPrice: varchar("currentPrice", { length: 50 }),
}, (t) => ({
  tickerDateIdx: index("ix_historical_metrics_ticker_date").on(t.ticker, t.recordedAt),
}));

export type HistoricalMetric = typeof historicalMetrics.$inferSelect;
export type InsertHistoricalMetric = typeof historicalMetrics.$inferInsert;

// Alert rules table - defines thresholds for metric changes
export const alertRules = mysqlTable("alertRules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // References users.id
  ticker: varchar("ticker", { length: 50 }), // null = applies to all stocks
  metricName: varchar("metricName", { length: 50 }).notNull(), // "sharpeRatio", "peRatio", "dividendYield"
  condition: mysqlEnum("condition", ["above", "below", "change"]).notNull(),
  threshold: varchar("threshold", { length: 50 }).notNull(),
  isActive: tinyint("isActive").notNull().default(1),
  notificationMethod: mysqlEnum("notificationMethod", ["email", "whatsapp", "both"]).notNull().default("email"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AlertRule = typeof alertRules.$inferSelect;
export type InsertAlertRule = typeof alertRules.$inferInsert;

// Alert history table - logs triggered alerts
export const alertHistory = mysqlTable("alertHistory", {
  id: int("id").autoincrement().primaryKey(),
  alertRuleId: int("alertRuleId").notNull(),
  ticker: varchar("ticker", { length: 50 }).notNull(),
  metricName: varchar("metricName", { length: 50 }).notNull(),
  oldValue: varchar("oldValue", { length: 50 }),
  newValue: varchar("newValue", { length: 50 }).notNull(),
  message: text("message").notNull(),
  notificationSent: tinyint("notificationSent").notNull().default(0),
  triggeredAt: timestamp("triggeredAt").defaultNow().notNull(),
});

export type AlertHistory = typeof alertHistory.$inferSelect;
export type InsertAlertHistory = typeof alertHistory.$inferInsert;

// Exchange Rates Table (for currency conversion)
export const exchangeRates = mysqlTable("exchangeRates", {
  id: int("id").autoincrement().primaryKey(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD format
  currencyPair: varchar("currencyPair", { length: 16 }).notNull(), // e.g., "USDCHF", "EURCHF"
  rate: decimal("rate", { precision: 10, scale: 6 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  datePairIdx: index("ix_exchangeRates_date_pair").on(t.date, t.currencyPair),
}));

export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type InsertExchangeRate = typeof exchangeRates.$inferInsert;


// ============================================
// Analyzer_Test Tables (Nov 7, 2024)
// ================================================

export const securities = mysqlTable("securities", {
  symbol: varchar("symbol", { length: 16 }).primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  sector: varchar("sector", { length: 64 }).notNull(),
  industry: varchar("industry", { length: 128 }).notNull(),
  currency: varchar("currency", { length: 8 }).notNull(),
});

export const prices = mysqlTable("prices", {
  id: int("id").autoincrement().primaryKey(),
  symbol: varchar("symbol", { length: 16 }).notNull(),
  date: date("date").notNull(),
  close: decimal("close", { precision: 18, scale: 6 }).notNull(),
}, (t) => ({
  symbolDateIdx: index("ix_prices_symbol_date").on(t.symbol, t.date),
}));

export const holdings = mysqlTable("holdings", {
  id: int("id").autoincrement().primaryKey(),
  symbol: varchar("symbol", { length: 16 }).notNull(),
  quantity: decimal("quantity", { precision: 18, scale: 6 }).notNull(),
  marketValue: decimal("market_value", { precision: 18, scale: 6 }).notNull(),
});

export const correlations = mysqlTable("correlations", {
  id: int("id").autoincrement().primaryKey(),
  a: varchar("a", { length: 16 }).notNull(),
  b: varchar("b", { length: 16 }).notNull(),
  rho: decimal("rho", { precision: 10, scale: 6 }).notNull(),
});

export const analyzerReports = mysqlTable("analyzer_reports", {
  id: int("id").autoincrement().primaryKey(),
  payload: text("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Type exports
export type Security = typeof securities.$inferSelect;
export type InsertSecurity = typeof securities.$inferInsert;
export type Price = typeof prices.$inferSelect;
export type InsertPrice = typeof prices.$inferInsert;
export type Holding = typeof holdings.$inferSelect;
export type InsertHolding = typeof holdings.$inferInsert;
export type Correlation = typeof correlations.$inferSelect;
export type InsertCorrelation = typeof correlations.$inferInsert;
export type AnalyzerReport = typeof analyzerReports.$inferSelect;
export type InsertAnalyzerReport = typeof analyzerReports.$inferInsert;

// Historical prices cache table - stores daily closing prices for chart performance
export const historicalPrices = mysqlTable("historicalPrices", {
  id: int("id").autoincrement().primaryKey(),
  ticker: varchar("ticker", { length: 50 }).notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD format
  close: varchar("close", { length: 50 }).notNull(), // Store as string for precision
  source: varchar("source", { length: 50 }).notNull().default("yahoo"), // "yahoo", "eodhd", "manual"
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  tickerDateIdx: index("ix_historical_prices_ticker_date").on(t.ticker, t.date),
}));

export type HistoricalPrice = typeof historicalPrices.$inferSelect;
export type InsertHistoricalPrice = typeof historicalPrices.$inferInsert;


// App secrets table for encrypted storage of API keys and credentials
export const appSecrets = mysqlTable("appSecrets", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  encryptedValue: text("encryptedValue").notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AppSecret = typeof appSecrets.$inferSelect;
export type InsertAppSecret = typeof appSecrets.$inferInsert;

// Price alerts table - user-defined price alerts for stocks
export const priceAlerts = mysqlTable("priceAlerts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  ticker: varchar("ticker", { length: 50 }).notNull(),
  alertType: mysqlEnum("alertType", ["above_price", "below_price", "percent_change"]).notNull(),
  targetPrice: varchar("targetPrice", { length: 50 }), // For above_price and below_price
  percentChange: varchar("percentChange", { length: 50 }), // For percent_change (e.g., "5" for 5%)
  notificationMethod: mysqlEnum("notificationMethod", ["email", "whatsapp", "both"]).notNull().default("email"),
  status: mysqlEnum("status", ["active", "triggered", "disabled"]).notNull().default("active"),
  isActive: tinyint("isActive").notNull().default(1),
  lastTriggered: timestamp("lastTriggered"),
  triggeredAt: timestamp("triggeredAt"), // When the alert was last triggered
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  userIdIdx: index("ix_price_alerts_userId").on(t.userId),
  tickerIdx: index("ix_price_alerts_ticker").on(t.ticker),
}));

export type PriceAlert = typeof priceAlerts.$inferSelect;
export type InsertPriceAlert = typeof priceAlerts.$inferInsert;

// ============================================
// AI Chat Bot Tables (Nov 16, 2025)
// ============================================

// Chat conversations table - stores chat sessions
export const chatConversations = mysqlTable("chatConversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  portfolioId: int("portfolioId"), // Optional: link to specific portfolio for context
  title: varchar("title", { length: 255 }).notNull().default("Neue Konversation"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  userIdIdx: index("ix_chat_conversations_userId").on(t.userId),
}));

export type ChatConversation = typeof chatConversations.$inferSelect;
export type InsertChatConversation = typeof chatConversations.$inferInsert;

// Chat messages table - stores individual messages in conversations
export const chatMessages = mysqlTable("chatMessages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  metadata: text("metadata"), // JSON string for additional data (e.g., portfolio snapshot, stock data)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  conversationIdIdx: index("ix_chat_messages_conversationId").on(t.conversationId),
}));

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

// ============================================
// User Preferences & Onboarding (Dec 26, 2025)
// ============================================

// User preferences table - stores investment preferences from onboarding
export const userPreferences = mysqlTable("userPreferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  investmentGoal: mysqlEnum("investmentGoal", ["dividends", "growth", "balanced"]),
  riskTolerance: mysqlEnum("riskTolerance", ["low", "medium", "high"]),
  investmentHorizon: mysqlEnum("investmentHorizon", ["short", "medium", "long"]), // short: <3 years, medium: 3-10 years, long: >10 years
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  userIdIdx: index("ix_user_preferences_userId").on(t.userId),
}));

export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = typeof userPreferences.$inferInsert;

// Benchmark data table - stores historical prices for benchmarks (SMI, S&P 500, MSCI World)
export const benchmarkData = mysqlTable("benchmarkData", {
  id: int("id").autoincrement().primaryKey(),
  benchmark: mysqlEnum("benchmark", ["SMI", "SP500", "MSCI_WORLD"]).notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD format
  close: varchar("close", { length: 50 }).notNull(), // Closing price
  source: varchar("source", { length: 50 }).notNull().default("eodhd"), // Data source
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  benchmarkDateIdx: index("ix_benchmark_data_benchmark_date").on(t.benchmark, t.date),
}));

export type BenchmarkData = typeof benchmarkData.$inferSelect;
export type InsertBenchmarkData = typeof benchmarkData.$inferInsert;
