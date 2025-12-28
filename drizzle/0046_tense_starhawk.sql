CREATE TABLE `userPreferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`investmentGoal` enum('dividends','growth','balanced'),
	`riskTolerance` enum('low','medium','high'),
	`investmentHorizon` enum('short','medium','long'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userPreferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `userPreferences_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE INDEX `ix_user_preferences_userId` ON `userPreferences` (`userId`);