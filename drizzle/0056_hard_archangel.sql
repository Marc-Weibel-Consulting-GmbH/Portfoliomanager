CREATE TABLE `split_adjusted_historical_prices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticker` varchar(50) NOT NULL,
	`date` varchar(10) NOT NULL,
	`adjustedClose` decimal(20,6) NOT NULL,
	`currency` varchar(10) NOT NULL,
	`source` varchar(50) NOT NULL,
	`sourceSymbol` varchar(50) NOT NULL,
	`retrievedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `split_adjusted_historical_prices_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_split_adjusted_prices_source_date` UNIQUE(`ticker`,`source`,`date`)
);
--> statement-breakpoint
CREATE INDEX `ix_split_adjusted_prices_ticker_date` ON `split_adjusted_historical_prices` (`ticker`,`date`);