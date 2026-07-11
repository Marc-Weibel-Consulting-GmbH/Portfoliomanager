ALTER TABLE `savedPortfolios` ADD `isSnapshot` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `savedPortfolios` ADD `snapshotOfPortfolioId` int;--> statement-breakpoint
ALTER TABLE `savedPortfolios` ADD `snapshotNote` varchar(255);