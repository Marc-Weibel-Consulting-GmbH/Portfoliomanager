CREATE TABLE `historicalPrices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticker` varchar(50) NOT NULL,
	`date` date NOT NULL,
	`close` decimal(18,6) NOT NULL,
	`source` varchar(50) NOT NULL DEFAULT 'yahoo',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `historicalPrices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ix_historical_prices_ticker_date` ON `historicalPrices` (`ticker`,`date`);