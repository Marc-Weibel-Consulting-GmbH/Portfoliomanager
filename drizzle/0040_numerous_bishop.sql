CREATE TABLE `stock_briefing_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticker` varchar(32) NOT NULL,
	`briefing` longtext NOT NULL,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`meta` json,
	CONSTRAINT `stock_briefing_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_briefing_cache_ticker_unique` UNIQUE(`ticker`)
);
