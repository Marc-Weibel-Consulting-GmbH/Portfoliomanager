CREATE TABLE `alertHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alertRuleId` int NOT NULL,
	`ticker` varchar(50) NOT NULL,
	`metricName` varchar(50) NOT NULL,
	`oldValue` varchar(50),
	`newValue` varchar(50) NOT NULL,
	`message` text NOT NULL,
	`notificationSent` tinyint NOT NULL DEFAULT 0,
	`triggeredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alertHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `alertRules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`ticker` varchar(50),
	`metricName` varchar(50) NOT NULL,
	`condition` enum('above','below','change') NOT NULL,
	`threshold` varchar(50) NOT NULL,
	`isActive` tinyint NOT NULL DEFAULT 1,
	`notificationMethod` enum('email','whatsapp','both') NOT NULL DEFAULT 'email',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `alertRules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `analyzer_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`payload` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analyzer_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `appSecrets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(255) NOT NULL,
	`encryptedValue` text NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appSecrets_id` PRIMARY KEY(`id`),
	CONSTRAINT `appSecrets_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`color` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `chatConversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`portfolioId` int,
	`title` varchar(255) NOT NULL DEFAULT 'Neue Konversation',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chatConversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chatMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`role` enum('user','assistant','system') NOT NULL,
	`content` text NOT NULL,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chatMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `correlations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`a` varchar(16) NOT NULL,
	`b` varchar(16) NOT NULL,
	`rho` decimal(10,6) NOT NULL,
	CONSTRAINT `correlations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exchangeRates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` date NOT NULL,
	`currencyPair` varchar(16) NOT NULL,
	`rate` decimal(10,6) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exchangeRates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `historicalMetrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticker` varchar(50) NOT NULL,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	`sharpeRatio` varchar(50),
	`peRatio` varchar(50),
	`pegRatio` varchar(50),
	`dividendYield` varchar(50),
	`beta` varchar(50),
	`volatility` varchar(50),
	`currentPrice` varchar(50),
	CONSTRAINT `historicalMetrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `historicalPrices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticker` varchar(50) NOT NULL,
	`date` varchar(10) NOT NULL,
	`close` varchar(50) NOT NULL,
	`source` varchar(50) NOT NULL DEFAULT 'yahoo',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `historicalPrices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `holdings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`symbol` varchar(16) NOT NULL,
	`quantity` decimal(18,6) NOT NULL,
	`market_value` decimal(18,6) NOT NULL,
	CONSTRAINT `holdings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `news` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticker` varchar(20) NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`url` varchar(500),
	`imageUrl` varchar(500),
	`source` varchar(100),
	`priority` enum('Wichtig','Mittel','Niedrig') DEFAULT 'Mittel',
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `news_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `newsletter` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`subscribedAt` timestamp NOT NULL DEFAULT (now()),
	`isActive` tinyint NOT NULL DEFAULT 1,
	CONSTRAINT `newsletter_id` PRIMARY KEY(`id`),
	CONSTRAINT `newsletter_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stripePaymentId` varchar(255),
	`amount` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'CHF',
	`status` enum('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
	`paymentMethod` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portfolioTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`portfolioId` int NOT NULL,
	`transactionType` enum('buy','sell','dividend','deposit','withdrawal') NOT NULL,
	`ticker` varchar(50),
	`shares` varchar(50),
	`pricePerShare` varchar(50),
	`currency` varchar(10) DEFAULT 'CHF',
	`totalAmount` varchar(50) NOT NULL,
	`fxRate` varchar(50),
	`totalAmountCHF` varchar(50),
	`fees` varchar(50) DEFAULT '0',
	`notes` text,
	`transactionDate` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `portfolioTransactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `priceAlerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`ticker` varchar(50) NOT NULL,
	`alertType` enum('above_price','below_price','percent_change') NOT NULL,
	`targetPrice` varchar(50),
	`percentChange` varchar(50),
	`isActive` tinyint NOT NULL DEFAULT 1,
	`lastTriggered` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `priceAlerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`symbol` varchar(16) NOT NULL,
	`date` date NOT NULL,
	`close` decimal(18,6) NOT NULL,
	CONSTRAINT `prices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `realizedGains` (
	`id` int AUTO_INCREMENT NOT NULL,
	`portfolioId` int NOT NULL,
	`transactionId` int NOT NULL,
	`ticker` varchar(50) NOT NULL,
	`shares` varchar(50) NOT NULL,
	`avgCostBasis` varchar(50) NOT NULL,
	`sellPrice` varchar(50) NOT NULL,
	`realizedGain` varchar(50) NOT NULL,
	`realizedGainPercent` varchar(50) NOT NULL,
	`transactionDate` timestamp NOT NULL,
	`stockGainLocal` varchar(50),
	`fxGain` varchar(50),
	`currency` varchar(10),
	`buyFxRate` varchar(50),
	`sellFxRate` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `realizedGains_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `research` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text,
	`fileUrl` varchar(500),
	`fileType` varchar(50),
	`fileName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `research_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `savedPortfolios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`portfolioData` text NOT NULL,
	`portfolioType` varchar(50),
	`isLive` tinyint NOT NULL DEFAULT 0,
	`liveStartDate` timestamp,
	`livePerformance` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `savedPortfolios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `securities` (
	`symbol` varchar(16) NOT NULL,
	`name` varchar(256) NOT NULL,
	`sector` varchar(64) NOT NULL,
	`industry` varchar(128) NOT NULL,
	`currency` varchar(8) NOT NULL,
	CONSTRAINT `securities_symbol` PRIMARY KEY(`symbol`)
);
--> statement-breakpoint
CREATE TABLE `stocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`ticker` varchar(50) NOT NULL,
	`currentPrice` varchar(50),
	`currency` varchar(10),
	`peRatio` varchar(50),
	`pegRatio` varchar(50),
	`dividendYield` varchar(50),
	`sharpeRatio` varchar(50),
	`volatility` varchar(50),
	`beta` varchar(50),
	`marketCap` varchar(50),
	`week52High` varchar(50),
	`week52Low` varchar(50),
	`lastDataRefresh` timestamp,
	`exchangeRateToChf` varchar(50),
	`category` varchar(100),
	`sector` varchar(100),
	`moat1` text,
	`moat2` text,
	`moat3` text,
	`portfolioWeight` varchar(50) DEFAULT '0',
	`isManualWeight` tinyint NOT NULL DEFAULT 0,
	`chartData` text,
	`ytdStartPrice` varchar(50),
	`ytdPerformance` varchar(50),
	`financialHighlight1` text,
	`financialHighlight2` text,
	`financialHighlight3` text,
	`factsheetUrl` varchar(500),
	`logoUrl` varchar(500),
	`score` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stocks_id` PRIMARY KEY(`id`),
	CONSTRAINT `stocks_ticker_unique` UNIQUE(`ticker`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`action` enum('add','delete','update_weight','update_data') NOT NULL,
	`ticker` varchar(50) NOT NULL,
	`companyName` varchar(255),
	`details` text,
	`oldValue` text,
	`newValue` text,
	`comment` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `openId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `username` varchar(50);--> statement-breakpoint
ALTER TABLE `users` ADD `firstName` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `lastName` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `password` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `mobile` varchar(50);--> statement-breakpoint
ALTER TABLE `users` ADD `hasPaid` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `paymentDate` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `stripeCustomerId` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `whatsappAlerts` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `hasSeenOnboarding` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `hasDemoPortfolio` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);--> statement-breakpoint
CREATE INDEX `ix_chat_conversations_userId` ON `chatConversations` (`userId`);--> statement-breakpoint
CREATE INDEX `ix_chat_messages_conversationId` ON `chatMessages` (`conversationId`);--> statement-breakpoint
CREATE INDEX `ix_exchangeRates_date_pair` ON `exchangeRates` (`date`,`currencyPair`);--> statement-breakpoint
CREATE INDEX `ix_historical_metrics_ticker_date` ON `historicalMetrics` (`ticker`,`recordedAt`);--> statement-breakpoint
CREATE INDEX `ix_historical_prices_ticker_date` ON `historicalPrices` (`ticker`,`date`);--> statement-breakpoint
CREATE INDEX `ix_prices_symbol_date` ON `prices` (`symbol`,`date`);--> statement-breakpoint
CREATE INDEX `ix_realized_gains_portfolio` ON `realizedGains` (`portfolioId`);--> statement-breakpoint
CREATE INDEX `ix_realized_gains_ticker` ON `realizedGains` (`ticker`);