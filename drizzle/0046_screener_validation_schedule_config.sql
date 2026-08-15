CREATE TABLE `screener_validation_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobKey` varchar(64) NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`cronExpression` varchar(64) NOT NULL DEFAULT '0 30 8 * * 1',
	`isActive` tinyint NOT NULL DEFAULT 1,
	`lastRunAt` timestamp,
	`lastRunStatus` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `screener_validation_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `screener_validation_config_jobKey_unique` UNIQUE(`jobKey`)
);
--> statement-breakpoint
CREATE INDEX `ix_screener_validation_config_task_uid` ON `screener_validation_config` (`scheduleCronTaskUid`);