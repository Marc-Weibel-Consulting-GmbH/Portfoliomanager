CREATE TABLE `investor_profile_assessment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`capacityScore` int NOT NULL DEFAULT 0,
	`toleranceScore` int NOT NULL DEFAULT 0,
	`needScore` int,
	`bindingProfile` enum('konservativ','ausgewogen','wachstum','aggressiv') NOT NULL DEFAULT 'ausgewogen',
	`knowledgeLevel` enum('einsteiger','fortgeschritten','erfahren') NOT NULL DEFAULT 'fortgeschritten',
	`financialSituation` json,
	`answers` json,
	`strategicAllocation` json,
	`version` int NOT NULL DEFAULT 1,
	`completedAt` timestamp,
	`lastReviewedAt` timestamp,
	`nextReviewDueAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `investor_profile_assessment_id` PRIMARY KEY(`id`),
	CONSTRAINT `investor_profile_assessment_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `market_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportDate` varchar(10) NOT NULL,
	`title` varchar(500) NOT NULL,
	`content` text NOT NULL,
	`source` varchar(100) DEFAULT 'manus_task',
	`taskId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `market_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ix_investor_profile_assessment_user` ON `investor_profile_assessment` (`userId`);--> statement-breakpoint
CREATE INDEX `ix_market_reports_date` ON `market_reports` (`reportDate`);--> statement-breakpoint
CREATE INDEX `ix_saved_portfolios_userId` ON `savedPortfolios` (`userId`);