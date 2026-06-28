CREATE TABLE `market_analysis` (
	`id` int AUTO_INCREMENT NOT NULL,
	`period` enum('day','week') NOT NULL,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`regime` varchar(60) NOT NULL,
	`regimeTone` enum('good','warn','bad') NOT NULL DEFAULT 'warn',
	`headline` text NOT NULL,
	`body` text NOT NULL,
	`scenarios` json NOT NULL,
	`sectorData` json NOT NULL,
	`dataDate` varchar(10) NOT NULL,
	CONSTRAINT `market_analysis_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ix_market_analysis_period_date` ON `market_analysis` (`period`,`dataDate`);