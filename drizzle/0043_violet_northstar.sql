DROP TABLE `alertHistory`;--> statement-breakpoint
DROP TABLE `alertRules`;--> statement-breakpoint
DROP TABLE `analyzer_reports`;--> statement-breakpoint
DROP TABLE `appSecrets`;--> statement-breakpoint
DROP TABLE `categories`;--> statement-breakpoint
DROP TABLE `chatConversations`;--> statement-breakpoint
DROP TABLE `chatMessages`;--> statement-breakpoint
DROP TABLE `correlations`;--> statement-breakpoint
DROP TABLE `exchangeRates`;--> statement-breakpoint
DROP TABLE `historicalMetrics`;--> statement-breakpoint
DROP TABLE `historicalPrices`;--> statement-breakpoint
DROP TABLE `holdings`;--> statement-breakpoint
DROP TABLE `news`;--> statement-breakpoint
DROP TABLE `newsletter`;--> statement-breakpoint
DROP TABLE `payments`;--> statement-breakpoint
DROP TABLE `portfolioTransactions`;--> statement-breakpoint
DROP TABLE `priceAlerts`;--> statement-breakpoint
DROP TABLE `prices`;--> statement-breakpoint
DROP TABLE `realizedGains`;--> statement-breakpoint
DROP TABLE `research`;--> statement-breakpoint
DROP TABLE `savedPortfolios`;--> statement-breakpoint
DROP TABLE `securities`;--> statement-breakpoint
DROP TABLE `stocks`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `users` DROP INDEX `users_email_unique`;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `openId` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `username`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `firstName`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `lastName`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `password`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `mobile`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `hasPaid`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `paymentDate`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `stripeCustomerId`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `whatsappAlerts`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `hasSeenOnboarding`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `hasDemoPortfolio`;