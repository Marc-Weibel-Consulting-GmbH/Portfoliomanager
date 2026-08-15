CREATE TABLE `scheduled_task_bindings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`handlerKey` varchar(64) NOT NULL,
	`scheduleCronTaskUid` varchar(65) NOT NULL,
	`minIntervalMinutes` int NOT NULL DEFAULT 15,
	`isActive` tinyint NOT NULL DEFAULT 1,
	`lastStartedAt` timestamp,
	`lastCompletedAt` timestamp,
	`lastStatus` varchar(32),
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheduled_task_bindings_id` PRIMARY KEY(`id`),
	CONSTRAINT `scheduled_task_bindings_handlerKey_unique` UNIQUE(`handlerKey`),
	CONSTRAINT `scheduled_task_bindings_scheduleCronTaskUid_unique` UNIQUE(`scheduleCronTaskUid`)
);
--> statement-breakpoint
CREATE INDEX `ix_scheduled_task_bindings_task_uid` ON `scheduled_task_bindings` (`scheduleCronTaskUid`);