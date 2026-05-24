CREATE TABLE `lppl_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`indexSymbol` varchar(20) NOT NULL,
	`indexName` varchar(100) NOT NULL,
	`bubbleConfidence` int NOT NULL,
	`fitR2` decimal(5,3),
	`currentPrice` decimal(12,2),
	`predictedTurningPoint` date,
	`momentum30d` decimal(6,2),
	`momentum90d` decimal(6,2),
	`validFits` int,
	`totalCombinations` int,
	`warningLevel` varchar(20),
	`checkedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lppl_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ix_lppl_results_index` ON `lppl_results` (`indexSymbol`);--> statement-breakpoint
CREATE INDEX `ix_lppl_results_checked_at` ON `lppl_results` (`checkedAt`);