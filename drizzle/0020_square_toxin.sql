ALTER TABLE `stocks` ADD `listType` enum('empfehlung','watchlist');--> statement-breakpoint
ALTER TABLE `stocks` ADD `stockSource` enum('manual','ai_recommended','wikifolio');--> statement-breakpoint
ALTER TABLE `stocks` ADD `signalScore` int;--> statement-breakpoint
ALTER TABLE `stocks` ADD `signalType` enum('buy','sell','hold');--> statement-breakpoint
ALTER TABLE `stocks` ADD `aiReason` text;--> statement-breakpoint
ALTER TABLE `stocks` ADD `rsi14` varchar(50);--> statement-breakpoint
ALTER TABLE `stocks` ADD `industry` varchar(150);--> statement-breakpoint
ALTER TABLE `stocks` ADD `country` varchar(50);--> statement-breakpoint
ALTER TABLE `stocks` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `stocks` ADD `isActive` tinyint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `stocks` ADD `lastMetricsUpdate` timestamp;--> statement-breakpoint
CREATE INDEX `ix_stocks_list_type` ON `stocks` (`listType`);--> statement-breakpoint
CREATE INDEX `ix_stocks_source` ON `stocks` (`stockSource`);