CREATE TABLE `appSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` json NOT NULL,
	`description` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `appSettings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
ALTER TABLE `userSettings` ADD `brokerName` varchar(100);--> statement-breakpoint
ALTER TABLE `userSettings` ADD `feePerTrade` decimal(10,2);--> statement-breakpoint
ALTER TABLE `userSettings` ADD `feePercent` decimal(6,4);--> statement-breakpoint
ALTER TABLE `userSettings` ADD `minFeePerTrade` decimal(10,2);--> statement-breakpoint
ALTER TABLE `userSettings` ADD `maxFeePerTrade` decimal(10,2);--> statement-breakpoint
ALTER TABLE `userSettings` ADD `stampDutyPercent` decimal(6,4);--> statement-breakpoint
ALTER TABLE `userSettings` ADD `currencyConversionFee` decimal(6,4);