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
CREATE INDEX `ix_historical_metrics_ticker_date` ON `historicalMetrics` (`ticker`,`recordedAt`);