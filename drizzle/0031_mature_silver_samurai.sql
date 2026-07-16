CREATE TABLE `portfolioMetricsSnapshot` (
	`id` int AUTO_INCREMENT NOT NULL,
	`portfolioId` int NOT NULL,
	`snapshotDate` date NOT NULL,
	`avgSharpe` decimal(8,4),
	`avgPEG` decimal(8,4),
	`avgDividendYield` decimal(8,4),
	`avgBeta` decimal(8,4),
	`avgPE` decimal(8,4),
	`positionCount` int,
	`totalValueCHF` decimal(16,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `portfolioMetricsSnapshot_id` PRIMARY KEY(`id`),
	CONSTRAINT `portfolioMetricsSnapshot_portfolioId_snapshotDate_unique` UNIQUE(`portfolioId`,`snapshotDate`)
);
--> statement-breakpoint
CREATE INDEX `idx_pms_portfolio_date` ON `portfolioMetricsSnapshot` (`portfolioId`,`snapshotDate`);