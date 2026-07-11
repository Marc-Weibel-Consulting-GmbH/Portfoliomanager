CREATE TABLE `optimizationSubscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`portfolioId` int NOT NULL,
	`cronExpression` varchar(64) NOT NULL DEFAULT '0 0 8 * * 1',
	`driftThresholdPp` int NOT NULL DEFAULT 5,
	`scheduleCronTaskUid` varchar(65),
	`isActive` tinyint NOT NULL DEFAULT 1,
	`lastRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `optimizationSubscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ix_optim_sub_user_portfolio` ON `optimizationSubscriptions` (`userId`,`portfolioId`);--> statement-breakpoint
CREATE INDEX `ix_optim_sub_task_uid` ON `optimizationSubscriptions` (`scheduleCronTaskUid`);