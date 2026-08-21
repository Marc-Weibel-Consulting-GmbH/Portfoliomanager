ALTER TABLE `stocks` ADD `isin` varchar(12);--> statement-breakpoint
ALTER TABLE `stocks` ADD `primaryTicker` varchar(24);--> statement-breakpoint
ALTER TABLE `stocks` ADD `dataQualityStatus` varchar(16);--> statement-breakpoint
ALTER TABLE `stocks` ADD `dataQualityNotes` text;--> statement-breakpoint
ALTER TABLE `stocks` ADD `dataQualityUpdatedAt` timestamp;