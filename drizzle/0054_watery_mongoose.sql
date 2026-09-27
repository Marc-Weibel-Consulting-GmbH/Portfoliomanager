CREATE TABLE `native_historical_prices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticker` varchar(50) NOT NULL,
	`date` varchar(10) NOT NULL,
	`close` decimal(20,6) NOT NULL,
	`currency` varchar(10) NOT NULL,
	`source` varchar(50) NOT NULL,
	`sourceSymbol` varchar(50) NOT NULL,
	`identity` varchar(40) NOT NULL,
	`conversionRatio` decimal(20,8) NOT NULL DEFAULT '1',
	`retrievedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `native_historical_prices_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_native_historical_prices_source_date` UNIQUE(`ticker`,`source`,`date`)
);
--> statement-breakpoint
CREATE INDEX `ix_native_historical_prices_ticker_date` ON `native_historical_prices` (`ticker`,`date`);