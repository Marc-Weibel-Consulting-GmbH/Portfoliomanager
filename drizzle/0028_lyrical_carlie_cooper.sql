CREATE TABLE `macroIndicators` (
	`id` int AUTO_INCREMENT NOT NULL,
	`seriesKey` varchar(64) NOT NULL,
	`label` varchar(128) NOT NULL,
	`category` varchar(32) NOT NULL,
	`source` varchar(16) NOT NULL,
	`latestValue` decimal(12,4),
	`latestDate` varchar(16),
	`previousValue` decimal(12,4),
	`timeseries` json,
	`interpretation` text,
	`lastFetchedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `macroIndicators_id` PRIMARY KEY(`id`),
	CONSTRAINT `macroIndicators_seriesKey_unique` UNIQUE(`seriesKey`)
);
