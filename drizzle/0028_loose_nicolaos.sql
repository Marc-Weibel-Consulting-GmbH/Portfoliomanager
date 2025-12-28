ALTER TABLE `savedPortfolios` ADD `isLive` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `savedPortfolios` ADD `liveStartDate` timestamp;--> statement-breakpoint
ALTER TABLE `savedPortfolios` ADD `livePerformance` varchar(50);