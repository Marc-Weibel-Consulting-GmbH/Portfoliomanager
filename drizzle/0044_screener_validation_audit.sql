CREATE TABLE `screener_validation_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`ticker` varchar(50) NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`currency` varchar(16),
	`internalSnapshot` json NOT NULL,
	`externalSnapshot` json NOT NULL,
	`comparison` json NOT NULL,
	`classification` varchar(64) NOT NULL,
	`isMaterial` tinyint NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `screener_validation_results_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_screener_validation_result_run_ticker` UNIQUE(`runId`,`ticker`)
);
--> statement-breakpoint
CREATE TABLE `screener_validation_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`weekKey` varchar(10) NOT NULL,
	`sampleSeed` varchar(64) NOT NULL,
	`sourceVersion` varchar(32) NOT NULL DEFAULT 'v1',
	`status` enum('running','completed','failed','skipped') NOT NULL DEFAULT 'running',
	`sampledCount` int NOT NULL DEFAULT 0,
	`comparedCount` int NOT NULL DEFAULT 0,
	`materialCount` int NOT NULL DEFAULT 0,
	`unavailableCount` int NOT NULL DEFAULT 0,
	`notifiedAt` timestamp,
	`error` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `screener_validation_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `screener_validation_runs_weekKey_unique` UNIQUE(`weekKey`)
);
--> statement-breakpoint
CREATE INDEX `ix_screener_validation_results_run` ON `screener_validation_results` (`runId`);--> statement-breakpoint
CREATE INDEX `ix_screener_validation_results_material` ON `screener_validation_results` (`isMaterial`);--> statement-breakpoint
CREATE INDEX `ix_screener_validation_runs_status` ON `screener_validation_runs` (`status`);--> statement-breakpoint
CREATE INDEX `ix_screener_validation_runs_started` ON `screener_validation_runs` (`startedAt`);
