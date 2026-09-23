CREATE TABLE `portfolioShares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`portfolioId` int NOT NULL,
	`userId` int NOT NULL,
	`permission` enum('view') NOT NULL DEFAULT 'view',
	`grantedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`revokedAt` timestamp,
	CONSTRAINT `portfolioShares_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_portfolio_shares_portfolio_user` UNIQUE(`portfolioId`,`userId`)
);
--> statement-breakpoint
CREATE INDEX `ix_portfolio_shares_portfolio` ON `portfolioShares` (`portfolioId`);--> statement-breakpoint
CREATE INDEX `ix_portfolio_shares_user` ON `portfolioShares` (`userId`);