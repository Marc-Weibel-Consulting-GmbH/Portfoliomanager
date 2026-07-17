import { date, decimal, index, int, json, longtext, mysqlEnum, mysqlTable, text, timestamp, tinyint, unique, varchar } from "drizzle-orm/mysql-core";

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
  // ── Kuratierungs-Facette (Merge watchlistStocks → stocks, STOCK_UNIVERSE_MERGE.md) ──
  // Alle nullable: listType=NULL ⇒ reines Portfolio-Stammdatum (nicht im Universum).
  listType: mysqlEnum("listType", ["empfehlung", "watchlist"]), // empfehlung ⇒ /aktien, watchlist ⇒ Staging
  source: mysqlEnum("stockSource", ["manual", "ai_recommended", "wikifolio"]), // Herkunft im Universum
  signalScore: int("signalScore"), // 0-100 Signal-Score (aus watchlistAlertsCron)
  signalType: mysqlEnum("signalType", ["buy", "sell", "hold"]),
  aiReason: text("aiReason"),
  rsi14: varchar("rsi14", { length: 50 }),
  industry: varchar("industry", { length: 150 }),
  country: varchar("country", { length: 50 }),
  notes: text("notes"), // Admin-Notizen / Import-Herkunft (z. B. Wikifolio-Code)
  isActive: tinyint("isActive").notNull().default(1),
  lastMetricsUpdate: timestamp("lastMetricsUpdate"),
  lastAlertSentAt: timestamp("lastAlertSentAt"), // Zeitpunkt des letzten Alert-Versands (für Cooldown)
  /**
   * Optional override for the EODHD API symbol.
   * Some exchanges use a different code in EODHD than the standard ticker.
   * E.g. ALV.DE (Xetra) must be fetched as ALV.XETRA in EODHD.
   * If NULL, the `ticker` column is used directly.
   */
  eodhdTicker: varchar("eodhdTicker", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  listTypeIdx: index("ix_stocks_list_type").on(t.listType),
  sourceIdx: index("ix_stocks_source").on(t.source),
}));

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
  portfolioData: text("portfolioData"), // JSON string with stocks and weights (optional during creation)
  portfolioType: mysqlEnum("portfolioType", ["demo", "live"]).notNull().default("demo"), // Portfolio type: demo or live
  status: mysqlEnum("status", ["planned", "live"]).notNull().default("planned"), // Portfolio status: planned or live
  investmentAmount: varchar("investmentAmount", { length: 50 }).notNull(), // Total investment amount in CHF (mandatory)
  startCapital: varchar("startCapital", { length: 50 }), // Initial capital when portfolio is activated (deprecated, use investmentAmount)
  benchmark: mysqlEnum("benchmark", ["SMI", "SP500", "MSCI_WORLD"]), // Benchmark for comparison
  isLive: tinyint("isLive").notNull().default(0), // 1 = Live tracking enabled, 0 = Test mode
  liveStartDate: timestamp("liveStartDate"), // Date when live tracking started
  livePerformance: varchar("livePerformance", { length: 50 }), // IRR/MWR performance (e.g., "12.5")
  cashBalance: varchar("cashBalance", { length: 50 }).default("0"), // Current cash/liquidity balance in CHF
  inceptionDate: timestamp("inceptionDate"), // Optional: manually set portfolio start date (overrides createdAt for display)
  isSnapshot: tinyint("isSnapshot").notNull().default(0), // 1 = Snapshot/Kopie eines anderen Portfolios
  snapshotOfPortfolioId: int("snapshotOfPortfolioId"), // ID des Original-Portfolios (falls isSnapshot=1)
  snapshotNote: varchar("snapshotNote", { length: 255 }), // Optionale Notiz zum Snapshot
  isAiOptimized: tinyint("isAiOptimized").notNull().default(0), // 1 = Portfolio aus KI-angepasstem Vorschlag (finalAdjustments angewendet)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  userIdIdx: index("ix_saved_portfolios_userId").on(t.userId),
}));

export type SavedPortfolio = typeof savedPortfolios.$inferSelect;
export type InsertSavedPortfolio = typeof savedPortfolios.$inferInsert;

// Portfolio transactions table - tracks buys, sells, dividends for live portfolios
export const portfolioTransactions = mysqlTable("portfolioTransactions", {
  id: int("id").autoincrement().primaryKey(),
  portfolioId: int("portfolioId").notNull(), // References savedPortfolios.id
  transactionType: mysqlEnum("transactionType", ["buy", "sell", "dividend", "deposit", "withdrawal", "entry"]).notNull(),
  ticker: varchar("ticker", { length: 50 }), // null for deposit/withdrawal
  shares: varchar("shares", { length: 50 }), // Number of shares (for buy/sell)
  pricePerShare: varchar("pricePerShare", { length: 50 }), // Price per share in original currency
  currency: varchar("currency", { length: 10 }).default("CHF"), // Currency of the transaction (USD, EUR, CHF, etc.)
  totalAmount: varchar("totalAmount", { length: 50 }).notNull(), // Total amount in original currency
  fxRate: varchar("fxRate", { length: 50 }), // Exchange rate to CHF (e.g., 0.88 for USD/CHF)
  totalAmountCHF: varchar("totalAmountCHF", { length: 50 }), // Total amount converted to CHF
  fees: varchar("fees", { length: 50 }).default("0"), // Transaction fees in CHF
  notes: text("notes"), // Optional user notes
  source: varchar("source", { length: 50 }).default("manual"), // Origin: "manual", "optimization", "deposit", "import"
  transactionDate: timestamp("transactionDate").notNull(), // Date of the transaction
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  portfolioIdIdx: index("ix_portfolio_transactions_portfolio_id").on(t.portfolioId),
  tickerIdx: index("ix_portfolio_transactions_ticker").on(t.ticker),
  sourceIdx: index("ix_portfolio_transactions_source").on(t.source),
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
export const historicalPrices = mysqlTable("historical_prices", {
  id: int("id").autoincrement().primaryKey(),
  ticker: varchar("ticker", { length: 50 }).notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD format
  close: decimal("close", { precision: 20, scale: 6 }).notNull(), // Decimal for precision (unadjusted)
  adjustedClose: decimal("adjustedClose", { precision: 20, scale: 6 }), // Split-adjusted close price
  currency: varchar("currency", { length: 10 }), // Optional: USD, CHF, EUR, etc.
  source: varchar("source", { length: 50 }).notNull().default("eodhd"), // "eodhd", "yahoo", "manual"
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  tickerDateUnique: unique("uq_historical_prices_ticker_date").on(t.ticker, t.date),
  tickerDateIdx: index("ix_historical_prices_ticker_date").on(t.ticker, t.date),
}));

export type HistoricalPrice = typeof historicalPrices.$inferSelect;
export type InsertHistoricalPrice = typeof historicalPrices.$inferInsert;

// Note: Table name is 'historical_prices' (snake_case) to follow MySQL conventions


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

// Portfolio snapshots table - tracks portfolio value over time for accurate performance calculation
// Stores daily snapshots of portfolio value and cash flows for TWR/MWR calculations
export const portfolioSnapshots = mysqlTable("portfolioSnapshots", {
  id: int("id").autoincrement().primaryKey(),
  portfolioId: int("portfolioId").notNull(), // References savedPortfolios.id
  snapshotDate: varchar("snapshotDate", { length: 10 }).notNull(), // YYYY-MM-DD format
  totalValue: varchar("totalValue", { length: 50 }).notNull(), // Total portfolio value in CHF
  cashFlow: varchar("cashFlow", { length: 50 }).notNull().default("0"), // Net cash flow on this date (deposits - withdrawals)
  isInitial: tinyint("isInitial").notNull().default(0), // 1 = Initial snapshot at portfolio creation
  notes: text("notes"), // Optional notes about this snapshot
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  portfolioDateIdx: index("ix_portfolio_snapshots_portfolio_date").on(t.portfolioId, t.snapshotDate),
}));

export type PortfolioSnapshot = typeof portfolioSnapshots.$inferSelect;
export type InsertPortfolioSnapshot = typeof portfolioSnapshots.$inferInsert;


// Logo cache table - stores company logos to avoid repeated API calls
export const logoCache = mysqlTable("logoCache", {
  id: int("id").autoincrement().primaryKey(),
  ticker: varchar("ticker", { length: 50 }).notNull().unique(), // Stock ticker (e.g., AAPL, NESN.SW)
  logoUrl: varchar("logoUrl", { length: 1000 }), // Cached logo URL (null if no logo found)
  source: varchar("source", { length: 50 }).notNull().default("eodhd"), // Data source (eodhd, fallback, etc.)
  lastFetched: timestamp("lastFetched").defaultNow().notNull(), // When the logo was last fetched
  expiresAt: timestamp("expiresAt"), // Optional expiry date for cache refresh
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  tickerIdx: index("ix_logo_cache_ticker").on(t.ticker),
}));

export type LogoCache = typeof logoCache.$inferSelect;
export type InsertLogoCache = typeof logoCache.$inferInsert;

// ============================================
// Admin Watchlist / Stock Universe
// ============================================
// Die frühere `watchlistStocks`-Tabelle wurde in die vereinte `stocks`-Tabelle
// zusammengeführt (STOCK_UNIVERSE_MERGE.md, Phase 3). Das kuratierte Universum
// lebt jetzt als Kuratierungs-Facette (listType/source/signalScore …) auf `stocks`.

// Signal optimizer weights table
export const signalWeights = mysqlTable("signalWeights", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().default("default"),
  weights: json("weights").notNull(), // JSON: { pe: 0.15, rsi: 0.2, macd: 0.1, peg: 0.1, dividend: 0.1, week52: 0.1, ytd: 0.1, rf: 0.1, sentiment: 0.05 }
  hitRate: decimal("hitRate", { precision: 5, scale: 2 }), // e.g. 67.50 = 67.5%
  totalBacktested: int("totalBacktested").default(0),
  correctSignals: int("correctSignals").default(0),
  isActive: tinyint("isActive").notNull().default(0), // Only one active config at a time
  optimizerLog: text("optimizerLog"), // JSON log of optimization run
  lastRunAt: timestamp("lastRunAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SignalWeight = typeof signalWeights.$inferSelect;
export type InsertSignalWeight = typeof signalWeights.$inferInsert;


// Copilot History table - tracks past recommendations and their outcomes
export const copilotHistory = mysqlTable("copilotHistory", {
  id: int("id").autoincrement().primaryKey(),
  portfolioId: int("portfolioId").notNull(),
  userId: int("userId").notNull(),
  ticker: varchar("ticker", { length: 50 }).notNull(),
  companyName: varchar("companyName", { length: 255 }),
  signal: mysqlEnum("signal", ["strong_buy", "buy", "hold", "sell", "strong_sell"]).notNull(),
  rankScore: int("rankScore").notNull(), // 0-100
  confidence: varchar("confidence", { length: 10 }), // e.g. "0.75"
  priceAtSignal: varchar("priceAtSignal", { length: 50 }).notNull(), // Price when recommendation was made
  currency: varchar("currency", { length: 10 }).default("USD"),
  targetWeight: varchar("targetWeight", { length: 10 }), // Suggested weight
  currentWeight: varchar("currentWeight", { length: 10 }), // Weight at time of signal
  // Outcome tracking (filled later)
  priceAfter30d: varchar("priceAfter30d", { length: 50 }),
  priceAfter60d: varchar("priceAfter60d", { length: 50 }),
  priceAfter90d: varchar("priceAfter90d", { length: 50 }),
  returnAfter30d: varchar("returnAfter30d", { length: 20 }), // e.g. "+5.2%"
  returnAfter60d: varchar("returnAfter60d", { length: 20 }),
  returnAfter90d: varchar("returnAfter90d", { length: 20 }),
  wasCorrect30d: tinyint("wasCorrect30d"), // 1 = correct, 0 = wrong, null = pending
  wasCorrect60d: tinyint("wasCorrect60d"),
  wasCorrect90d: tinyint("wasCorrect90d"),
  // Metadata
  source: mysqlEnum("source", ["copilot_analysis", "walk_forward", "rebalancing"]).notNull().default("copilot_analysis"),
  appliedAsTransaction: tinyint("appliedAsTransaction").notNull().default(0), // Was this actually executed?
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  portfolioIdx: index("ix_copilot_history_portfolio").on(t.portfolioId),
  userIdx: index("ix_copilot_history_user").on(t.userId),
  tickerIdx: index("ix_copilot_history_ticker").on(t.ticker),
  createdAtIdx: index("ix_copilot_history_created").on(t.createdAt),
}));

export type CopilotHistoryEntry = typeof copilotHistory.$inferSelect;
export type InsertCopilotHistoryEntry = typeof copilotHistory.$inferInsert;

// Walk-Forward results table - stores walk-forward validation results
export const walkForwardResults = mysqlTable("walkForwardResults", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  runName: varchar("runName", { length: 255 }).notNull(), // e.g. "US Large Cap Tech Screening 2026-05"
  universeSource: mysqlEnum("universeSource", ["watchlist", "screener", "combined"]).notNull(),
  // Screening criteria used
  screeningCriteria: json("screeningCriteria"), // JSON: { region, sector, minMarketCap, minScore, targetSharpe, ... }
  tickerCount: int("tickerCount").notNull(), // Number of tickers in universe
  tickers: json("tickers"), // JSON array of tickers used
  // Walk-Forward config
  trainWindow: int("trainWindow").notNull().default(6), // months
  testWindow: int("testWindow").notNull().default(1), // months
  totalPeriods: int("totalPeriods").notNull(), // number of WF periods
  // Results
  oosAlpha: varchar("oosAlpha", { length: 20 }), // Out-of-sample alpha
  oosHitRate: varchar("oosHitRate", { length: 20 }), // Out-of-sample hit rate
  oosSharpe: varchar("oosSharpe", { length: 20 }), // Out-of-sample Sharpe
  overfitRatio: varchar("overfitRatio", { length: 20 }), // IS Sharpe / OOS Sharpe
  topPerformers: json("topPerformers"), // JSON: [{ ticker, avgRank, consistency, oosReturn }]
  fullResults: json("fullResults"), // JSON: detailed period-by-period results
  // Metadata
  status: mysqlEnum("status", ["running", "completed", "failed"]).notNull().default("running"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("ix_wf_results_user").on(t.userId),
  statusIdx: index("ix_wf_results_status").on(t.status),
}));

export type WalkForwardResult = typeof walkForwardResults.$inferSelect;
export type InsertWalkForwardResult = typeof walkForwardResults.$inferInsert;

// ============ User Settings (LPPL threshold, broker fees, etc.) ============
export const userSettings = mysqlTable("userSettings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  lpplThreshold: int("lpplThreshold").notNull().default(70), // 50-95, default 70%
  // Broker fee structure
  brokerName: varchar("brokerName", { length: 100 }),
  feePerTrade: decimal("feePerTrade", { precision: 10, scale: 2 }),
  feePercent: decimal("feePercent", { precision: 6, scale: 4 }),
  minFeePerTrade: decimal("minFeePerTrade", { precision: 10, scale: 2 }),
  maxFeePerTrade: decimal("maxFeePerTrade", { precision: 10, scale: 2 }),
  stampDutyPercent: decimal("stampDutyPercent", { precision: 6, scale: 4 }),
  currencyConversionFee: decimal("currencyConversionFee", { precision: 6, scale: 4 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  userIdx: index("ix_user_settings_user").on(t.userId),
}));

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = typeof userSettings.$inferInsert;

// ============================================
// Anlageprofil (Konzept «Optimierung & Empfehlungen», Stufe F1): Risikoprofil +
// Anlageziele pro Nutzer. Speist später Optimizer/Empfehlungen und schaltet die
// automatische Portfolio-Erstellung frei.
// ============================================
export const userInvestmentProfile = mysqlTable("user_investment_profile", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  // Risikoprofil
  riskProfile: mysqlEnum("riskProfile", ["konservativ", "ausgewogen", "wachstum", "aggressiv"]).notNull().default("ausgewogen"),
  investmentHorizonYears: int("investmentHorizonYears").notNull().default(10),
  maxDrawdownTolerancePct: int("maxDrawdownTolerancePct").notNull().default(20),
  // Anlageziele
  investmentGoal: mysqlEnum("investmentGoal", ["dividends", "growth", "balanced"]).notNull().default("balanced"),
  targetReturnPct: decimal("targetReturnPct", { precision: 5, scale: 2 }),
  liquidityNeedPct: int("liquidityNeedPct").notNull().default(0),
  excludedSectors: json("excludedSectors"),
  esgOnly: tinyint("esgOnly").notNull().default(0),
  // Referenzwährung & Währungsrisiko
  referenceCurrency: varchar("referenceCurrency", { length: 3 }).notNull().default("CHF"), // CHF, EUR, USD
  maxFxExposurePct: int("maxFxExposurePct").notNull().default(50), // Max. Fremdwährungsanteil in % (0–100)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  userIdx: index("ix_user_investment_profile_user").on(t.userId),
}));

export type UserInvestmentProfile = typeof userInvestmentProfile.$inferSelect;
export type InsertUserInvestmentProfile = typeof userInvestmentProfile.$inferInsert;

// Anlegerprofil 2.0 (Konzept INVESTOR_PROFILE_CONCEPT.md): geführte Bewertung nach
// Beratungsstandard. Additiv zu user_investment_profile (dort bleibt das *aktive*
// Profil, das Optimizer/Builder lesen). Ein Datensatz je Nutzer.
export const investorProfileAssessment = mysqlTable("investor_profile_assessment", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  // Scores 0–100
  capacityScore: int("capacityScore").notNull().default(0),   // Risikofähigkeit (objektiv)
  toleranceScore: int("toleranceScore").notNull().default(0), // Risikobereitschaft (subjektiv)
  needScore: int("needScore"),                                // Risikobedarf (aus Zielrendite)
  // Bindendes Profil = min(Fähigkeit, Bereitschaft); Spiegel von user_investment_profile.riskProfile
  bindingProfile: mysqlEnum("bindingProfile", ["konservativ", "ausgewogen", "wachstum", "aggressiv"]).notNull().default("ausgewogen"),
  // Kenntnisse & Erfahrung (FIDLEG-Angemessenheit, leichte Variante)
  knowledgeLevel: mysqlEnum("knowledgeLevel", ["einsteiger", "fortgeschritten", "erfahren"]).notNull().default("fortgeschritten"),
  financialSituation: json("financialSituation"), // grobe Bänder
  answers: json("answers"),                        // Rohantworten des Fragebogens
  strategicAllocation: json("strategicAllocation"),// {equity,bond,cash} in %
  version: int("version").notNull().default(1),
  completedAt: timestamp("completedAt"),
  lastReviewedAt: timestamp("lastReviewedAt"),
  nextReviewDueAt: timestamp("nextReviewDueAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  userIdx: index("ix_investor_profile_assessment_user").on(t.userId),
}));

export type InvestorProfileAssessment = typeof investorProfileAssessment.$inferSelect;
export type InsertInvestorProfileAssessment = typeof investorProfileAssessment.$inferInsert;

// LPPL Bubble-Check Results (historische Persistierung)
export const lpplResults = mysqlTable("lppl_results", {
  id: int("id").autoincrement().primaryKey(),
  indexSymbol: varchar("indexSymbol", { length: 20 }).notNull(), // ^GSPC, ^IXIC
  indexName: varchar("indexName", { length: 100 }).notNull(), // S&P 500, NASDAQ Composite
  bubbleConfidence: int("bubbleConfidence").notNull(), // 0-100
  fitR2: decimal("fitR2", { precision: 5, scale: 3 }), // e.g. 0.946
  currentPrice: decimal("currentPrice", { precision: 12, scale: 2 }),
  predictedTurningPoint: date("predictedTurningPoint", { mode: 'string' }),
  momentum30d: decimal("momentum30d", { precision: 6, scale: 2 }), // %
  momentum90d: decimal("momentum90d", { precision: 6, scale: 2 }), // %
  validFits: int("validFits"),
  totalCombinations: int("totalCombinations"),
  warningLevel: varchar("warningLevel", { length: 20 }), // none, low, medium, high
  checkedAt: timestamp("checkedAt").defaultNow().notNull(),
}, (t) => ({
  indexIdx: index("ix_lppl_results_index").on(t.indexSymbol),
  checkedAtIdx: index("ix_lppl_results_checked_at").on(t.checkedAt),
}));

export type LpplResult = typeof lpplResults.$inferSelect;
export type InsertLpplResult = typeof lpplResults.$inferInsert;

// ============================================
// ML model artifacts (pre-trained, walk-forward-validated models)
// Training runs offline in the Python analytics_service (GB), exports ONNX;
// the TS server serves inference from the active artifact. The ONNX bytes live
// in object storage / Redis (referenced by artifactUri); the DB row holds the
// metadata, feature contract and validation metrics. Only one row per `kind`
// may be status='active'.
// ============================================
export const modelArtifacts = mysqlTable("modelArtifacts", {
  id: int("id").autoincrement().primaryKey(),
  kind: mysqlEnum("kind", ["rf_signal", "gb_signal", "ranking", "ensemble_weights"]).notNull(),
  version: int("version").notNull(), // monotonically increasing per kind
  status: mysqlEnum("status", ["candidate", "active", "archived", "failed"]).notNull().default("candidate"),
  format: varchar("format", { length: 20 }).notNull().default("onnx"), // onnx | json
  // Where the model bytes live (object-store key / URL); inline JSON only for tiny models.
  artifactUri: varchar("artifactUri", { length: 512 }), // optional external store (S3) for very large models
  modelBlob: longtext("modelBlob"), // base64 ONNX bytes — DB is the source of truth; Redis caches
  // Feature contract: ordered feature names + per-feature normalization (mean/std).
  featureSpec: json("featureSpec").notNull(),
  trainStart: varchar("trainStart", { length: 10 }), // YYYY-MM-DD
  trainEnd: varchar("trainEnd", { length: 10 }),
  universeSize: int("universeSize"),
  // Out-of-sample validation: { hitRate, alpha, sharpe, overfitRatio, perHorizon: {30,60,90} }
  metrics: json("metrics"),
  promotedAt: timestamp("promotedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  kindStatusIdx: index("ix_model_artifacts_kind_status").on(t.kind, t.status),
  kindVersionUnique: unique("uq_model_artifacts_kind_version").on(t.kind, t.version),
}));

export type ModelArtifact = typeof modelArtifacts.$inferSelect;
export type InsertModelArtifact = typeof modelArtifacts.$inferInsert;

// ============================================
// Signal History — Persistierte Signale für Lookback-Evaluation
// ============================================
export const signalHistory = mysqlTable("signal_history", {
  id: int("id").autoincrement().primaryKey(),
  ticker: varchar("ticker", { length: 20 }).notNull(),
  action: varchar("action", { length: 20 }).notNull(),
  selectedEngine: varchar("selectedEngine", { length: 30 }).notNull(),
  regime: varchar("regime", { length: 30 }).notNull(),
  regimeConfidence: decimal("regimeConfidence", { precision: 5, scale: 3 }),
  conviction: decimal("conviction", { precision: 5, scale: 3 }).notNull(),
  rawScore: decimal("rawScore", { precision: 6, scale: 4 }).notNull(),
  adjustedScore: decimal("adjustedScore", { precision: 6, scale: 4 }).notNull(),
  direction: int("direction").notNull(),
  holdingPeriodHint: int("holdingPeriodHint"),
  stopLossPct: decimal("stopLossPct", { precision: 6, scale: 3 }),
  takeProfitPct: decimal("takeProfitPct", { precision: 6, scale: 3 }),
  priceAtSignal: decimal("priceAtSignal", { precision: 12, scale: 4 }),
  priceAtEvaluation: decimal("priceAtEvaluation", { precision: 12, scale: 4 }),
  engineScores: json("engineScores"),
  evaluatedAt: timestamp("evaluatedAt"),
  actualReturnPct: decimal("actualReturnPct", { precision: 7, scale: 4 }),
  // F-14: Alpha-Messung — Benchmark-Return (SMI) über dasselbe Fenster,
  // Alpha = actualReturnPct − benchmarkReturnPct. Daten akkumulieren erst
  // ab Deployment (bestehende Zeilen bleiben NULL).
  benchmarkReturnPct: decimal("benchmarkReturnPct", { precision: 7, scale: 4 }),
  alphaPct: decimal("alphaPct", { precision: 7, scale: 4 }),
  directionCorrect: tinyint("directionCorrect"),
  riskDecision: varchar("riskDecision", { length: 20 }),
  computedAt: timestamp("computedAt").defaultNow().notNull(),
}, (t) => ({
  tickerIdx: index("ix_signal_history_ticker").on(t.ticker),
  computedAtIdx: index("ix_signal_history_computed_at").on(t.computedAt),
  engineRegimeIdx: index("ix_signal_history_engine_regime").on(t.selectedEngine, t.regime),
}));

export type SignalHistoryRow = typeof signalHistory.$inferSelect;
export type InsertSignalHistory = typeof signalHistory.$inferInsert;

// ============================================
// Market Analysis — KI-Tages/Wochenbericht (Dashboard)
// ============================================
export const marketAnalysis = mysqlTable("market_analysis", {
  id: int("id").autoincrement().primaryKey(),
  period: mysqlEnum("period", ["day", "week"]).notNull(),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  // MarketTake: Gesamtbild
  regime: varchar("regime", { length: 60 }).notNull(),
  regimeTone: mysqlEnum("regimeTone", ["good", "warn", "bad"]).notNull().default("warn"),
  headline: text("headline").notNull(),
  body: text("body").notNull(),
  scenarios: json("scenarios").notNull(), // { label, prob, tone }[]
  // SectorNews: je Sektor eine Karte
  sectorData: json("sectorData").notNull(), // SectorNews[]
  // Meta
  dataDate: varchar("dataDate", { length: 10 }).notNull(), // YYYY-MM-DD
}, (t) => ({
  periodDateIdx: index("ix_market_analysis_period_date").on(t.period, t.dataDate),
}));
export type MarketAnalysisRow = typeof marketAnalysis.$inferSelect;
export type InsertMarketAnalysis = typeof marketAnalysis.$inferInsert;

// ============================================
// Market Regime History — täglicher Snapshot des Gesamt-Scores (R4)
// Speist die 90-Tage-Regime-Verlauf-Sparkline auf der Markt-Regime-Seite.
// Ein Eintrag pro Handelstag (Upsert per date), befüllt vom regimeHistoryCron.
// ============================================
export const marketRegimeHistory = mysqlTable("market_regime_history", {
  id: int("id").autoincrement().primaryKey(),
  date: varchar("date", { length: 10 }).notNull().unique(), // YYYY-MM-DD (UTC)
  overallScore: decimal("overallScore", { precision: 6, scale: 4 }).notNull(), // -1..+1
  regime: varchar("regime", { length: 30 }).notNull(),
  equityAllocation: int("equityAllocation").notNull(),
  regimeMultiplier: decimal("regimeMultiplier", { precision: 4, scale: 2 }).notNull(),
  engineScores: json("engineScores").notNull(), // { trend, breadth, volatility, ... }: score
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  dateIdx: index("ix_market_regime_history_date").on(t.date),
}));
export type MarketRegimeHistoryRow = typeof marketRegimeHistory.$inferSelect;
export type InsertMarketRegimeHistory = typeof marketRegimeHistory.$inferInsert;


// ============================================
// App Settings (Admin-configurable diversification rules, fee structure, etc.)
// Key-value store for application-wide settings
// ============================================
export const appSettings = mysqlTable("appSettings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: json("value").notNull(), // JSON value for flexibility
  description: text("description"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AppSetting = typeof appSettings.$inferSelect;
export type InsertAppSetting = typeof appSettings.$inferInsert;

// ============================================
// Research Documents (Admin uploads for KI-Empfehlungen context)
// ============================================
export const researchDocuments = mysqlTable("researchDocuments", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  filename: varchar("filename", { length: 500 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileType: mysqlEnum("fileType", ["pdf", "word", "ppt", "excel", "other"]).notNull().default("pdf"),
  fileSize: int("fileSize"),
  extractedText: longtext("extractedText"),
  summary: text("summary"),
  keyInsights: json("keyInsights"),
  relevantTickers: json("relevantTickers"),
  status: mysqlEnum("status", ["uploading", "extracting", "analyzing", "ready", "error"]).notNull().default("uploading"),
  errorMessage: text("errorMessage"),
  uploadedBy: int("uploadedBy"),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
  analyzedAt: timestamp("analyzedAt"),
});
export type ResearchDocument = typeof researchDocuments.$inferSelect;
export type InsertResearchDocument = typeof researchDocuments.$inferInsert;

// ============================================
// Multi-Agent Sessions (Orchestrated LLM queries)
// ============================================
export const multiAgentSessions = mysqlTable("multiAgentSessions", {
  id: int("id").autoincrement().primaryKey(),
  prompt: text("prompt").notNull(),
  context: text("context"),
  responses: json("responses"),
  synthesis: text("synthesis"),
  status: mysqlEnum("status", ["pending", "running", "synthesizing", "completed", "error"]).notNull().default("pending"),
  errorMessage: text("errorMessage"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});
export type MultiAgentSession = typeof multiAgentSessions.$inferSelect;
export type InsertMultiAgentSession = typeof multiAgentSessions.$inferInsert;

// ============================================
// Wikifolio als zusätzliche Signalquelle (Track B, AI_ALPHA_ROADMAP.md)
// Erfolgreiche, real investierte Wikifolios + ihre Transaktionen. Fließt als EINE
// gewichtete Quelle in das Signal-Aggregat ein — nicht als Fundament.
// ============================================

// Verfolgte Wikifolios inkl. Erfolgs-Kennzahlen (Basis fürs Ranking "erfolgreich").
export const wikifolios = mysqlTable("wikifolios", {
  id: int("id").autoincrement().primaryKey(),
  // Wikifolio-Symbol (z. B. "wfglobalnt") — stabiler Schlüssel.
  symbol: varchar("symbol", { length: 60 }).notNull().unique(),
  // Interne Wikifolio-GUID (für den tradehistory-Endpunkt); erst nach erstem Detail-Abruf bekannt.
  wikifolioId: varchar("wikifolioId", { length: 64 }),
  title: varchar("title", { length: 255 }),
  traderName: varchar("traderName", { length: 150 }),
  isin: varchar("isin", { length: 20 }),
  // Erfolgs-Kennzahlen (aus der Such-/Detail-API). NULL, solange nicht abgerufen.
  sharpeRatio: decimal("sharpeRatio", { precision: 8, scale: 4 }),
  performance1y: decimal("performance1y", { precision: 10, scale: 4 }),
  performanceEver: decimal("performanceEver", { precision: 10, scale: 4 }),
  maxDrawdown: decimal("maxDrawdown", { precision: 10, scale: 4 }),
  aum: decimal("aum", { precision: 16, scale: 2 }),
  // Ob dieses Wikifolio aktiv für Trades gepollt wird (Top-N nach Erfolg).
  isTracked: tinyint("isTracked").notNull().default(0),
  lastTradesSyncAt: timestamp("lastTradesSyncAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  symbolIdx: index("ix_wikifolios_symbol").on(t.symbol),
  trackedIdx: index("ix_wikifolios_tracked").on(t.isTracked),
}));

export type Wikifolio = typeof wikifolios.$inferSelect;
export type InsertWikifolio = typeof wikifolios.$inferInsert;

// Einzelne Transaktionen (Trades) verfolgter Wikifolios. Quelle für das Konsens-Signal.
export const wikifolioTrades = mysqlTable("wikifolio_trades", {
  id: int("id").autoincrement().primaryKey(),
  wikifolioId: int("wikifolioId").notNull(), // FK → wikifolios.id
  // Wikifolios eigene Order-ID zur Deduplizierung wiederholter Abrufe.
  externalTradeId: varchar("externalTradeId", { length: 80 }),
  isin: varchar("isin", { length: 20 }),
  // ISIN→eigenes Ticker-Universum aufgelöst (isinResolver); NULL, wenn nicht auflösbar.
  resolvedTicker: varchar("resolvedTicker", { length: 50 }),
  name: varchar("name", { length: 255 }),
  side: mysqlEnum("side", ["buy", "sell", "other"]).notNull().default("other"),
  executionPrice: decimal("executionPrice", { precision: 14, scale: 4 }),
  // Gewicht der Position im Wikifolio nach dem Trade (%) — Signalstärke.
  weightage: decimal("weightage", { precision: 8, scale: 4 }),
  executedAt: timestamp("executedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  wikifolioIdx: index("ix_wikifolio_trades_wikifolio").on(t.wikifolioId),
  tickerIdx: index("ix_wikifolio_trades_ticker").on(t.resolvedTicker),
  executedAtIdx: index("ix_wikifolio_trades_executed_at").on(t.executedAt),
  dedupeIdx: unique("ux_wikifolio_trades_dedupe").on(t.wikifolioId, t.externalTradeId),
}));

export type WikifolioTrade = typeof wikifolioTrades.$inferSelect;
export type InsertWikifolioTrade = typeof wikifolioTrades.$inferInsert;

// ============================================
// Regime-abhängige Signal-Konfiguration (Track A, P1+P2 — AI_ALPHA_ROADMAP.md)
// Je Marktregime: (P1) admin-editierbares Verhältnis Qualität/Trading + (P2) aus dem
// gemessenen Alpha GELERNTE Engine-Gewichte (Gedächtnis-Schleife).
// ============================================
export const regimeSignalConfig = mysqlTable("regime_signal_config", {
  id: int("id").autoincrement().primaryKey(),
  regime: varchar("regime", { length: 40 }).notNull().unique(),
  // P1 — Admin-Gewichte (Titelwahl vs. Timing). NULL = Default aus signalBlend verwenden.
  qualityWeight: decimal("qualityWeight", { precision: 5, scale: 4 }),
  tradingWeight: decimal("tradingWeight", { precision: 5, scale: 4 }),
  // P2 — gelernte Engine-Gewichte { engine: weight } (Summe 1). NULL, bis erstmals gelernt.
  engineWeights: json("engineWeights"),
  // Anzahl ausgewerteter Signale, auf denen die gelernten Gewichte beruhen (Evidenz).
  sampleSize: int("sampleSize").default(0),
  lastLearnedAt: timestamp("lastLearnedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  regimeIdx: index("ix_regime_signal_config_regime").on(t.regime),
}));

export type RegimeSignalConfig = typeof regimeSignalConfig.$inferSelect;
export type InsertRegimeSignalConfig = typeof regimeSignalConfig.$inferInsert;

// ============================================
// Wiederkehrende Transaktions-Empfehlungen je Portfolio (Track D / P3)
// Kadenz-Konfiguration; die Generierung nutzt die bestehende Copilot-Analyse.
// ============================================
export const portfolioRecommendationConfig = mysqlTable("portfolio_recommendation_config", {
  id: int("id").autoincrement().primaryKey(),
  portfolioId: int("portfolioId").notNull().unique(),
  cadence: mysqlEnum("cadence", ["off", "weekly", "monthly", "quarterly"]).notNull().default("off"),
  // Automatische Ausführung — Default AUS (Vorschlag mit Bestätigung). Opt-in mit Audit-Trail.
  autoExecute: tinyint("autoExecute").notNull().default(0),
  lastGeneratedAt: timestamp("lastGeneratedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  portfolioIdx: index("ix_portfolio_rec_config_portfolio").on(t.portfolioId),
}));

export type PortfolioRecommendationConfig = typeof portfolioRecommendationConfig.$inferSelect;
export type InsertPortfolioRecommendationConfig = typeof portfolioRecommendationConfig.$inferInsert;

// ============================================
// Signal-Cache: Vorberechnete Signale für alle Watchlist-Aktien
// Wird stündlich via Cron aktualisiert. Die generate-Prozedur liest
// aus diesem Cache statt live zu berechnen → Antwortzeit < 1s.
// ============================================
export const stockSignalCache = mysqlTable("stock_signal_cache", {
  id: int("id").autoincrement().primaryKey(),
  ticker: varchar("ticker", { length: 50 }).notNull().unique(),
  companyName: varchar("companyName", { length: 255 }).notNull(),
  signalType: mysqlEnum("signalType", ["buy", "sell", "hold"]).notNull().default("hold"),
  signalStrength: mysqlEnum("signalStrength", ["strong", "moderate", "weak"]).notNull().default("weak"),
  currentPrice: varchar("currentPrice", { length: 50 }),
  targetPrice: varchar("targetPrice", { length: 50 }),
  peRatio: varchar("peRatio", { length: 50 }),
  pegRatio: varchar("pegRatio", { length: 50 }),
  dividendYield: varchar("dividendYield", { length: 50 }),
  ytdPerformance: varchar("ytdPerformance", { length: 50 }),
  fiftyTwoWeekHigh: varchar("fiftyTwoWeekHigh", { length: 50 }),
  fiftyTwoWeekLow: varchar("fiftyTwoWeekLow", { length: 50 }),
  rsi14: varchar("rsi14", { length: 50 }),
  reason: text("reason"),
  criteria: json("criteria"),
  rfSignal: varchar("rfSignal", { length: 50 }),
  rfScore: int("rfScore"),
  qualityGrade: varchar("qualityGrade", { length: 5 }),
  qualityScore: int("qualityScore"),
  momentumGrade: varchar("momentumGrade", { length: 5 }),
  momentumScore: int("momentumScore"),
  combinedScore: varchar("combinedScore", { length: 20 }),
  combinedSignal: varchar("combinedSignal", { length: 50 }),
  overallGrade: varchar("overallGrade", { length: 5 }),
  bubbleScore: varchar("bubbleScore", { length: 20 }),
  bubbleRegime: varchar("bubbleRegime", { length: 50 }),
  sentimentScore: int("sentimentScore"),
  sentimentLabel: varchar("sentimentLabel", { length: 50 }),
  computedAt: timestamp("computedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  tickerIdx: index("ix_signal_cache_ticker").on(t.ticker),
  updatedIdx: index("ix_signal_cache_updated").on(t.updatedAt),
}));
export type StockSignalCache = typeof stockSignalCache.$inferSelect;
export type InsertStockSignalCache = typeof stockSignalCache.$inferInsert;

// ============================================
// Score Snapshot History (daily score tracking)
// ============================================
export const stockScoreSnapshot = mysqlTable("stock_score_snapshot", {
  id: int("id").autoincrement().primaryKey(),
  ticker: varchar("ticker", { length: 50 }).notNull(),
  snapshotDate: varchar("snapshotDate", { length: 10 }).notNull(), // YYYY-MM-DD
  qualityScore: int("qualityScore"),
  momentumScore: int("momentumScore"),
  combinedScore: int("combinedScore"),
  signalType: mysqlEnum("signalType", ["buy", "sell", "hold"]).default("hold"),
  signalStrength: mysqlEnum("signalStrength", ["strong", "moderate", "weak"]).default("weak"),
  overallGrade: varchar("overallGrade", { length: 5 }),
  currentPrice: varchar("currentPrice", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  tickerDateIdx: index("ix_score_snapshot_ticker_date").on(t.ticker, t.snapshotDate),
  tickerIdx: index("ix_score_snapshot_ticker").on(t.ticker),
}));
export type StockScoreSnapshot = typeof stockScoreSnapshot.$inferSelect;
export type InsertStockScoreSnapshot = typeof stockScoreSnapshot.$inferInsert;

// ============================================
// Tägliche Market-Update Berichte
// Empfängt Berichte von Manus-Tasks via POST /api/market-report
// und stellt sie in der Marktübersicht dar.
// ============================================
export const marketReports = mysqlTable("market_reports", {
  id: int("id").autoincrement().primaryKey(),
  reportDate: varchar("reportDate", { length: 10 }).notNull(), // YYYY-MM-DD
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content").notNull(), // Markdown-Inhalt des Berichts
  source: varchar("source", { length: 100 }).default("manus_task"), // Quelle (manus_task, manual, etc.)
  taskId: varchar("taskId", { length: 255 }), // Manus Task ID für Deduplizierung
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  reportDateIdx: index("ix_market_reports_date").on(t.reportDate),
}));
export type MarketReport = typeof marketReports.$inferSelect;
export type InsertMarketReport = typeof marketReports.$inferInsert;

// Optimization subscription — weekly check if portfolio drifted from optimum
export const optimizationSubscriptions = mysqlTable("optimizationSubscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  portfolioId: int("portfolioId").notNull(),
  /** 6-field cron (with seconds): "0 0 8 * * 1" = every Monday 08:00 UTC */
  cronExpression: varchar("cronExpression", { length: 64 }).notNull().default("0 0 8 * * 1"),
  /** Drift threshold in percentage points (e.g. 5 = alert when any position drifts >5pp) */
  driftThresholdPp: int("driftThresholdPp").notNull().default(5),
  /** Heartbeat task UID from Forge scheduler */
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  isActive: tinyint("isActive").notNull().default(1),
  lastRunAt: timestamp("lastRunAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  userPortfolioIdx: index("ix_optim_sub_user_portfolio").on(t.userId, t.portfolioId),
  taskUidIdx: index("ix_optim_sub_task_uid").on(t.scheduleCronTaskUid),
}));

export type OptimizationSubscription = typeof optimizationSubscriptions.$inferSelect;
export type InsertOptimizationSubscription = typeof optimizationSubscriptions.$inferInsert;
// ── KI-Boom Metrics History ────────────────────────────────────────────────
// Speichert täglich alle KI-Boom-Signalwerte für historische Charts
export const kiBoomMetricsHistory = mysqlTable("ki_boom_metrics_history", {
  id: int("id").autoincrement().primaryKey(),
  recordedAt: timestamp("recordedAt").notNull(),
  nvidiaPrice: decimal("nvidiaPrice", { precision: 10, scale: 2 }),
  mag7AvgYtd: decimal("mag7AvgYtd", { precision: 8, scale: 2 }),
  openAiVerlustquote: decimal("openAiVerlustquote", { precision: 6, scale: 2 }),
  hyperscalerCapexWachstum: decimal("hyperscalerCapexWachstum", { precision: 8, scale: 2 }),
  vcAnteilKI: decimal("vcAnteilKI", { precision: 6, scale: 2 }),
  pilotProjektROIQuote: decimal("pilotProjektROIQuote", { precision: 6, scale: 2 }),
  // Market-based metrics (backfillable via EODHD)
  soxPrice: decimal("soxPrice", { precision: 10, scale: 2 }),
  arkkPrice: decimal("arkkPrice", { precision: 10, scale: 2 }),
  nvdaPE: decimal("nvdaPE", { precision: 8, scale: 2 }),
  vixLevel: decimal("vixLevel", { precision: 6, scale: 2 }),
  // Credit Spread proxies: HYG = High Yield Bond ETF, LQD = Investment Grade Bond ETF
  creditSpreadHY: decimal("creditSpreadHY", { precision: 10, scale: 2 }),
  creditSpreadIG: decimal("creditSpreadIG", { precision: 10, scale: 2 }),
  overallZone: varchar("overallZone", { length: 10 }),
  activeWarnings: int("activeWarnings").default(0),
  activeCritical: int("activeCritical").default(0),
  scenarioSanfte: int("scenarioSanfte"),
  scenarioCrash: int("scenarioCrash"),
  scenarioBoom: int("scenarioBoom"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  recordedAtIdx: index("ix_ki_boom_recorded_at").on(t.recordedAt),
}));
export type KiBoomMetricsHistory = typeof kiBoomMetricsHistory.$inferSelect;
export type InsertKiBoomMetricsHistory = typeof kiBoomMetricsHistory.$inferInsert;

// ── KI-Boom Dynamic Metrics Cache ─────────────────────────────────────────
// Speichert via Perplexity abgerufene aktuelle Metriken (OpenAI-Bewertung,
// Hyperscaler CapEx, VC-Anteil, ROI-Quote) mit Quellenangabe und Datum.
export const kiBoomDynamicMetrics = mysqlTable("ki_boom_dynamic_metrics", {
  id: int("id").autoincrement().primaryKey(),
  metricKey: varchar("metricKey", { length: 64 }).notNull(),
  numericValue: decimal("numericValue", { precision: 12, scale: 2 }),
  displayValue: varchar("displayValue", { length: 128 }),
  unit: varchar("unit", { length: 32 }),
  source: varchar("source", { length: 512 }),
  description: text("description"),
  fetchedAt: timestamp("fetchedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  metricKeyIdx: index("ix_ki_boom_dyn_key").on(t.metricKey),
  fetchedAtIdx: index("ix_ki_boom_dyn_fetched").on(t.fetchedAt),
}));
export type KiBoomDynamicMetric = typeof kiBoomDynamicMetrics.$inferSelect;
export type InsertKiBoomDynamicMetric = typeof kiBoomDynamicMetrics.$inferInsert;

// ============================================
// Alert-Konfiguration (Watchlist Alert Criteria)
// Speichert die konfigurierbaren Schwellenwerte für den Watchlist-Alert-Cron.
// Singleton-Tabelle: immer nur ein Eintrag (id = 1), via upsert verwaltet.
// ============================================
export const alertConfig = mysqlTable("alertConfig", {
  id: int("id").primaryKey().default(1),
  // Scoring: P/E Thresholds
  peLow: decimal("peLow", { precision: 6, scale: 1 }).notNull().default("15"),
  peMedium: decimal("peMedium", { precision: 6, scale: 1 }).notNull().default("20"),
  peHigh: decimal("peHigh", { precision: 6, scale: 1 }).notNull().default("40"),
  peVeryHigh: decimal("peVeryHigh", { precision: 6, scale: 1 }).notNull().default("60"),
  peLowPoints: int("peLowPoints").notNull().default(12),
  peMediumPoints: int("peMediumPoints").notNull().default(6),
  peHighPoints: int("peHighPoints").notNull().default(-8),
  peVeryHighPoints: int("peVeryHighPoints").notNull().default(-15),
  // Scoring: Dividend Thresholds
  divHigh: decimal("divHigh", { precision: 5, scale: 3 }).notNull().default("0.04"),
  divMedium: decimal("divMedium", { precision: 5, scale: 3 }).notNull().default("0.025"),
  divHighPoints: int("divHighPoints").notNull().default(12),
  divMediumPoints: int("divMediumPoints").notNull().default(6),
  // Scoring: 52W Position Thresholds
  week52NearLow: decimal("week52NearLow", { precision: 4, scale: 2 }).notNull().default("0.20"),
  week52BelowMid: decimal("week52BelowMid", { precision: 4, scale: 2 }).notNull().default("0.35"),
  week52NearHigh: decimal("week52NearHigh", { precision: 4, scale: 2 }).notNull().default("0.95"),
  week52NearLowPoints: int("week52NearLowPoints").notNull().default(15),
  week52BelowMidPoints: int("week52BelowMidPoints").notNull().default(8),
  week52NearHighPoints: int("week52NearHighPoints").notNull().default(-10),
  // Scoring: PEG Thresholds
  pegVeryLow: decimal("pegVeryLow", { precision: 5, scale: 2 }).notNull().default("0.80"),
  pegModerate: decimal("pegModerate", { precision: 5, scale: 2 }).notNull().default("1.20"),
  pegHigh: decimal("pegHigh", { precision: 5, scale: 2 }).notNull().default("3.00"),
  pegVeryLowPoints: int("pegVeryLowPoints").notNull().default(12),
  pegModeratePoints: int("pegModeratePoints").notNull().default(5),
  pegHighPoints: int("pegHighPoints").notNull().default(-8),
  // Alert Trigger Thresholds
  buyTriggerScore: int("buyTriggerScore").notNull().default(75),
  sellTriggerScore: int("sellTriggerScore").notNull().default(25),
  buyPreviousScoreThreshold: int("buyPreviousScoreThreshold").notNull().default(70),
  sellPreviousScoreThreshold: int("sellPreviousScoreThreshold").notNull().default(35),
  scoreChangeTrigger: int("scoreChangeTrigger").notNull().default(10),
  // Alert Cooldown: suppress repeated alerts for the same stock
  alertCooldownDays: int("alertCooldownDays").notNull().default(7),
  // Metadata
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedBy: varchar("updatedBy", { length: 64 }),
});
export type AlertConfig = typeof alertConfig.$inferSelect;
export type InsertAlertConfig = typeof alertConfig.$inferInsert;

// ─── Gap-Fill Log ────────────────────────────────────────────────────────────
// Tracks each EODHD Gap-Filling run: which gaps were found and which stocks added.
export const gapFillLog = mysqlTable("gapFillLog", {
  id: int("id").autoincrement().primaryKey(),
  runAt: timestamp("runAt").defaultNow().notNull(),
  triggeredBy: varchar("triggeredBy", { length: 32 }).notNull().default("cron"), // "cron" | "manual"
  gapsFound: json("gapsFound").notNull(), // Array<{ type: string; label: string; count: number; needed: number }>
  stocksAdded: json("stocksAdded").notNull(), // Array<{ ticker: string; name: string; sector: string; gapType: string }>
  stocksSkipped: int("stocksSkipped").notNull().default(0), // already in DB or API error
  durationMs: int("durationMs"),
  error: text("error"), // non-null if the run failed
});
export type GapFillLog = typeof gapFillLog.$inferSelect;
export type InsertGapFillLog = typeof gapFillLog.$inferInsert;

// ─── Portfolio Proposal Log ───────────────────────────────────────────────────
// Stores every buildProposal result (deterministisch + Multi-Agent-Analyse)
// für Admin-Auswertung und kontinuierliches Training des Algorithmus.
// Nicht sichtbar für Endnutzer — nur im Admin-Bereich abrufbar.
export const portfolioProposalLog = mysqlTable("portfolioProposalLog", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  riskProfile: varchar("riskProfile", { length: 32 }),
  investmentGoal: varchar("investmentGoal", { length: 32 }),
  referenceCurrency: varchar("referenceCurrency", { length: 8 }),
  maxFxExposurePct: int("maxFxExposurePct"),
  investmentAmount: int("investmentAmount"),
  // Deterministisches Ergebnis
  positionCount: int("positionCount"),
  method: varchar("method", { length: 32 }),
  qualityTier: varchar("qualityTier", { length: 16 }),
  sharpe: decimal("sharpe", { precision: 6, scale: 3 }),
  expectedReturnPct: decimal("expectedReturnPct", { precision: 6, scale: 2 }),
  volatilityPct: decimal("volatilityPct", { precision: 6, scale: 2 }),
  fxWeightPct: decimal("fxWeightPct", { precision: 6, scale: 2 }),
  positions: json("positions"), // Array of position objects
  // Multi-Agent Analyse
  challengerCritique: text("challengerCritique"),
  challengerRejectedCount: int("challengerRejectedCount"),
  synthesizerVerdict: text("synthesizerVerdict"),
  overallConfidence: mysqlEnum("overallConfidence", ["hoch", "mittel", "niedrig"]),
  finalAdjustments: json("finalAdjustments"),
  agentDurationMs: int("agentDurationMs"),
  // Kennzahlen-Filter Ergebnis
  meetsKennzahlenFilter: mysqlEnum("meetsKennzahlenFilter", ["ja", "nein", "n/a"]).default("n/a"),
  kennzahlenFilterReason: text("kennzahlenFilterReason"),
  // Wurde der Vorschlag übernommen?
  accepted: mysqlEnum("accepted", ["ja", "nein", "unbekannt"]).default("unbekannt"),
  // Training-Feedback: Differenz zwischen Original- und Admin-Version
  adminFeedback: json("adminFeedback"), // { changes: [{ticker, action, originalWeight, adminWeight, reason}], summary: string }
  // Admin-Review Workflow
  adminReviewedPositions: json("adminReviewedPositions"), // Positions after admin review
  adminComments: json("adminComments"), // { [ticker]: string } per-ticker comments
  reviewStatus: mysqlEnum("reviewStatus", ["pending", "reviewed", "approved"]).default("pending"),
  reviewedAt: timestamp("reviewedAt"),
  returnToWizardToken: varchar("returnToWizardToken", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PortfolioProposalLog = typeof portfolioProposalLog.$inferSelect;
export type InsertPortfolioProposalLog = typeof portfolioProposalLog.$inferInsert;

// ─── Makro-Indikatoren (FRED, SNB, World Bank) ───────────────────────────────
// Gespeicherte Zeitreihen für Marktregime-Analyse und Markt-Charts.
// Wird automatisch per Admin-Button oder Cron aktualisiert.
export const macroIndicators = mysqlTable("macroIndicators", {
  id: int("id").autoincrement().primaryKey(),
  /** Eindeutiger Schlüssel, z.B. "FRED_T10Y2Y", "FRED_CPIAUCSL", "SNB_USDCHF" */
  seriesKey: varchar("seriesKey", { length: 64 }).notNull().unique(),
  /** Anzeigename, z.B. "10Y-2Y Spread (USA)" */
  label: varchar("label", { length: 128 }).notNull(),
  /** Kategorie: "yield_curve" | "inflation" | "rates" | "employment" | "fx" | "credit" */
  category: varchar("category", { length: 32 }).notNull(),
  /** Datenquelle: "FRED" | "SNB" | "WORLDBANK" | "ECB" */
  source: varchar("source", { length: 16 }).notNull(),
  /** Letzter bekannter Wert */
  latestValue: decimal("latestValue", { precision: 12, scale: 4 }),
  /** Datum des letzten Wertes */
  latestDate: varchar("latestDate", { length: 16 }),
  /** Vorheriger Wert (für Delta-Berechnung) */
  previousValue: decimal("previousValue", { precision: 12, scale: 4 }),
  /** Vollständige Zeitreihe als JSON-Array [{date, value}] — letzten 2 Jahre */
  timeseries: json("timeseries"),
  /** Interpretations-Hinweis für Marktregime */
  interpretation: text("interpretation"),
  /** Zuletzt abgerufen */
  lastFetchedAt: timestamp("lastFetchedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MacroIndicator = typeof macroIndicators.$inferSelect;
export type InsertMacroIndicator = typeof macroIndicators.$inferInsert;

// ─── Portfolio Metrics Snapshot ───────────────────────────────────────────────
// Täglicher Snapshot der durchschnittlichen Portfolio-Kennzahlen.
// Ermöglicht historische Charts für Sharpe, PEG, Dividende, Beta in der Übersicht.
export const portfolioMetricsSnapshot = mysqlTable("portfolioMetricsSnapshot", {
  id: int("id").autoincrement().primaryKey(),
  /** Referenz auf savedPortfolios.id */
  portfolioId: int("portfolioId").notNull(),
  /** Datum des Snapshots (YYYY-MM-DD) */
  snapshotDate: date("snapshotDate").notNull(),
  /** Durchschnittliche Sharpe Ratio des Portfolios */
  avgSharpe: decimal("avgSharpe", { precision: 8, scale: 4 }),
  /** Durchschnittliches PEG Ratio (gewichtet nach Portfolio-Anteil) */
  avgPEG: decimal("avgPEG", { precision: 8, scale: 4 }),
  /** Durchschnittliche Dividendenrendite in % */
  avgDividendYield: decimal("avgDividendYield", { precision: 8, scale: 4 }),
  /** Durchschnittliches Beta */
  avgBeta: decimal("avgBeta", { precision: 8, scale: 4 }),
  /** Durchschnittliches KGV (P/E) */
  avgPE: decimal("avgPE", { precision: 8, scale: 4 }),
  /** Anzahl Positionen zum Zeitpunkt des Snapshots */
  positionCount: int("positionCount"),
  /** Gesamtwert des Portfolios in CHF zum Zeitpunkt des Snapshots */
  totalValueCHF: decimal("totalValueCHF", { precision: 16, scale: 2 }),
  /** Annualisierte Volatilität (aus Portfolio-Wertreihe, rollierend 252 Tage) */
  volatility: decimal("volatility", { precision: 8, scale: 4 }),
  /** Sortino Ratio (rf = 2 %, aus Portfolio-Wertreihe) */
  sortino: decimal("sortino", { precision: 8, scale: 4 }),
  /** Max Drawdown (aus Portfolio-Wertreihe, rollierend) */
  maxDrawdown: decimal("maxDrawdown", { precision: 8, scale: 4 }),
  /** Quelle: 'live' (täglicher Cron) oder 'backfill' (Rekonstruktion aus Kursen) */
  source: varchar("source", { length: 16 }).default("live"),
  /** Quality Score 0–100 (E1, NULL bis berechnet) */
  qualityScore: int("qualityScore"),
  /** JSON: Punktzahl + Inputs je Score-Komponente */
  qualityComponents: text("qualityComponents"),
  /** Datenabdeckung in % (wie viele Kennzahlen verfügbar waren) */
  dataCoveragePct: int("dataCoveragePct"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  unique().on(t.portfolioId, t.snapshotDate),
  index("idx_pms_portfolio_date").on(t.portfolioId, t.snapshotDate),
]);
export type PortfolioMetricsSnapshot = typeof portfolioMetricsSnapshot.$inferSelect;
export type InsertPortfolioMetricsSnapshot = typeof portfolioMetricsSnapshot.$inferInsert;


// ============================================================
// ALGO-BACKTESTING SELF-LEARNING SYSTEM
// ============================================================

/**
 * algoBacktestRuns: Ein monatlicher Backtesting-Run.
 * Jeder Run erstellt 6 Standard-Portfolios (3 Risikoprofile × 2 Ziele).
 * Nach 30 Tagen wird die Performance gemessen und eine LLM-Analyse erstellt.
 */
export const algoBacktestRuns = mysqlTable("algo_backtest_runs", {
  id: int("id").autoincrement().primaryKey(),
  /** Monat des Runs (YYYY-MM-01) */
  runMonth: date("runMonth").notNull(),
  /** Status: 'creating' | 'active' | 'evaluating' | 'completed' | 'error' */
  status: varchar("status", { length: 32 }).notNull().default("creating"),
  /** Algorithmus-Version (Semver oder Git-Hash) für Vergleichbarkeit */
  algoVersion: varchar("algoVersion", { length: 64 }),
  /** Aktive Markt-Hub-Signale zum Zeitpunkt der Erstellung (JSON) */
  marktHubSnapshot: text("marktHubSnapshot"),
  /** Aktive Sektor-Tilts zum Zeitpunkt der Erstellung (JSON) */
  sectorTiltsSnapshot: text("sectorTiltsSnapshot"),
  /** MSCI führender Faktor zum Zeitpunkt der Erstellung */
  leadingFactor: varchar("leadingFactor", { length: 64 }),
  /** Marktregime zum Zeitpunkt der Erstellung */
  marktRegime: varchar("marktRegime", { length: 64 }),
  /** LLM-Analyse nach 30 Tagen (JSON: { summary, strengths, weaknesses, tuningRecommendations }) */
  llmAnalysis: text("llmAnalysis"),
  /** Durchschnittliche Performance aller 6 Portfolios nach 30 Tagen (%) */
  avgPerf30dPct: decimal("avgPerf30dPct", { precision: 8, scale: 4 }),
  /** Benchmark-Performance im gleichen Zeitraum (SPY/SMI, %) */
  benchmarkPerf30dPct: decimal("benchmarkPerf30dPct", { precision: 8, scale: 4 }),
  /** Anzahl erstellter Portfolios */
  portfolioCount: int("portfolioCount").default(0),
  /** Datum der Evaluation (30 Tage nach runMonth) */
  evaluatedAt: timestamp("evaluatedAt"),
  /** Fehler-Details falls status='error' */
  errorDetails: text("errorDetails"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  unique().on(t.runMonth),
  index("idx_abt_runs_status").on(t.status),
]);
export type AlgoBacktestRun = typeof algoBacktestRuns.$inferSelect;
export type InsertAlgoBacktestRun = typeof algoBacktestRuns.$inferInsert;

/**
 * algoBacktestPortfolios: Ein einzelnes Test-Portfolio innerhalb eines Runs.
 * 6 pro Run: konservativ/ausgewogen/aggressiv × dividenden/wachstum
 */
export const algoBacktestPortfolios = mysqlTable("algo_backtest_portfolios", {
  id: int("id").autoincrement().primaryKey(),
  /** Referenz auf algoBacktestRuns.id */
  runId: int("runId").notNull(),
  /** Risikoprofil: 'konservativ' | 'ausgewogen' | 'aggressiv' */
  riskProfile: varchar("riskProfile", { length: 32 }).notNull(),
  /** Anlageziel: 'dividends' | 'growth' | 'balanced' */
  goal: varchar("goal", { length: 32 }).notNull(),
  /** Positionen zum Erstellungszeitpunkt (JSON-Array) */
  positionsSnapshot: text("positionsSnapshot").notNull(),
  /** Erwartete Kennzahlen zum Erstellungszeitpunkt (JSON: expectedReturn, volatility, sharpe) */
  proposalMetrics: text("proposalMetrics"),
  /** Aktive Sektor-Tilts die dieses Portfolio beeinflusst haben (JSON) */
  appliedSectorTilts: text("appliedSectorTilts"),
  /** MSCI-Faktor-Tilts die dieses Portfolio beeinflusst haben (JSON) */
  appliedFactorTilts: text("appliedFactorTilts"),
  /** Challenger-Kritik (JSON) */
  challengerCritique: text("challengerCritique"),
  /** Synthesizer-Empfehlung (JSON) */
  synthesizerRecommendation: text("synthesizerRecommendation"),
  /** Tatsächliche Performance nach 30 Tagen (%) — NULL bis evaluiert */
  actualPerf30dPct: decimal("actualPerf30dPct", { precision: 8, scale: 4 }),
  /** Tatsächliche Sharpe Ratio nach 30 Tagen — NULL bis evaluiert */
  actualSharpe30d: decimal("actualSharpe30d", { precision: 8, scale: 4 }),
  /** Tatsächliche Volatilität nach 30 Tagen — NULL bis evaluiert */
  actualVolatility30d: decimal("actualVolatility30d", { precision: 8, scale: 4 }),
  /** Max Drawdown nach 30 Tagen — NULL bis evaluiert */
  actualMaxDrawdown30d: decimal("actualMaxDrawdown30d", { precision: 8, scale: 4 }),
  /** Benchmark-Performance im gleichen Zeitraum (%) */
  benchmarkPerf30dPct: decimal("benchmarkPerf30dPct", { precision: 8, scale: 4 }),
  /** Alpha gegenüber Benchmark (actualPerf - benchmarkPerf) */
  alpha30dPct: decimal("alpha30dPct", { precision: 8, scale: 4 }),
  /** LLM-Analyse für dieses spezifische Portfolio (Text) */
  portfolioAnalysis: text("portfolioAnalysis"),
  /** Fehler bei der Erstellung (falls Portfolio nicht erstellt werden konnte) */
  creationError: text("creationError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_abp_run_profile").on(t.runId, t.riskProfile, t.goal),
]);
export type AlgoBacktestPortfolio = typeof algoBacktestPortfolios.$inferSelect;
export type InsertAlgoBacktestPortfolio = typeof algoBacktestPortfolios.$inferInsert;

/**
 * algoTuningLog: Protokoll der Algorithmus-Feinajustierungen.
 * Jede Änderung am Algorithmus wird hier dokumentiert mit Begründung,
 * erwarteter Wirkung und Overfitting-Schutz-Bewertung.
 */
export const algoTuningLog = mysqlTable("algo_tuning_log", {
  id: int("id").autoincrement().primaryKey(),
  /** Referenz auf algoBacktestRuns.id der die Änderung ausgelöst hat */
  triggeredByRunId: int("triggeredByRunId"),
  /** Algorithmus-Version VOR der Änderung */
  fromVersion: varchar("fromVersion", { length: 64 }),
  /** Algorithmus-Version NACH der Änderung */
  toVersion: varchar("toVersion", { length: 64 }),
  /** Welcher Parameter wurde geändert (z.B. 'sectorTilt.Technologie', 'momentumAdj.threshold') */
  parameterChanged: varchar("parameterChanged", { length: 128 }).notNull(),
  /** Alter Wert (als String) */
  oldValue: varchar("oldValue", { length: 256 }),
  /** Neuer Wert (als String) */
  newValue: varchar("newValue", { length: 256 }),
  /** Begründung der Änderung (LLM-generiert oder manuell) */
  rationale: text("rationale").notNull(),
  /** Overfitting-Risiko: 'low' | 'medium' | 'high' */
  overfittingRisk: varchar("overfittingRisk", { length: 16 }).default("low"),
  /** Erwartete Wirkung der Änderung */
  expectedImpact: text("expectedImpact"),
  /** Tatsächliche Wirkung nach nächstem Run (NULL bis bekannt) */
  actualImpact: text("actualImpact"),
  /** Wurde die Änderung rückgängig gemacht? */
  reverted: int("reverted").default(0),
  /** Wer hat die Änderung gemacht: 'llm_auto' | 'admin_manual' */
  source: varchar("source", { length: 32 }).default("llm_auto"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_atl_run").on(t.triggeredByRunId),
]);
export type AlgoTuningLog = typeof algoTuningLog.$inferSelect;
export type InsertAlgoTuningLog = typeof algoTuningLog.$inferInsert;
