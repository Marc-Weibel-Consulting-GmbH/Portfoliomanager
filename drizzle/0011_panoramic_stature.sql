CREATE TABLE `user_investment_profile` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`riskProfile` enum('konservativ','ausgewogen','wachstum','aggressiv') NOT NULL DEFAULT 'ausgewogen',
	`investmentHorizonYears` int NOT NULL DEFAULT 10,
	`maxDrawdownTolerancePct` int NOT NULL DEFAULT 20,
	`investmentGoal` enum('dividends','growth','balanced') NOT NULL DEFAULT 'balanced',
	`targetReturnPct` decimal(5,2),
	`liquidityNeedPct` int NOT NULL DEFAULT 0,
	`excludedSectors` json,
	`esgOnly` tinyint NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_investment_profile_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_investment_profile_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE INDEX `ix_user_investment_profile_user` ON `user_investment_profile` (`userId`);