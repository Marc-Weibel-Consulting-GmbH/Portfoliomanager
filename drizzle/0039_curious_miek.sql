CREATE TABLE `combined_score_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticker` varchar(20) NOT NULL,
	`snapshotDate` varchar(10) NOT NULL,
	`combinedScore` decimal(6,2),
	`signalType` varchar(16),
	`priceAtSnapshot` decimal(12,4),
	`horizonDays` int NOT NULL DEFAULT 30,
	`computedAt` timestamp NOT NULL DEFAULT (now()),
	`evaluatedAt` timestamp,
	`priceAtEvaluation` decimal(12,4),
	`actualReturnPct` decimal(7,4),
	`benchmarkReturnPct` decimal(7,4),
	`alphaPct` decimal(7,4),
	`directionCorrect` tinyint,
	CONSTRAINT `combined_score_history_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_combined_score_history_ticker_date` UNIQUE(`ticker`,`snapshotDate`)
);
--> statement-breakpoint
ALTER TABLE `stock_signal_cache` ADD `wikifolioScore` int;--> statement-breakpoint
ALTER TABLE `stock_signal_cache` ADD `wikifolioSignal` varchar(50);--> statement-breakpoint
ALTER TABLE `stock_signal_cache` ADD `wikifolioBuyCount` int;--> statement-breakpoint
ALTER TABLE `stock_signal_cache` ADD `wikifolioSellCount` int;--> statement-breakpoint
CREATE INDEX `ix_combined_score_history_computed_at` ON `combined_score_history` (`computedAt`);