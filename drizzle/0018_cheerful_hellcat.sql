CREATE TABLE `market_regime_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` varchar(10) NOT NULL,
	`overallScore` decimal(6,4) NOT NULL,
	`regime` varchar(30) NOT NULL,
	`equityAllocation` int NOT NULL,
	`regimeMultiplier` decimal(4,2) NOT NULL,
	`engineScores` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `market_regime_history_id` PRIMARY KEY(`id`),
	CONSTRAINT `market_regime_history_date_unique` UNIQUE(`date`)
);
--> statement-breakpoint
CREATE INDEX `ix_market_regime_history_date` ON `market_regime_history` (`date`);