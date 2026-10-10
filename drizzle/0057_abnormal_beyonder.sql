CREATE TABLE `corporate_action_audit_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`monthKey` varchar(7) NOT NULL,
	`asOfDate` varchar(10) NOT NULL,
	`status` enum('running','completed','failed','skipped') NOT NULL DEFAULT 'running',
	`activeInstrumentCount` int NOT NULL DEFAULT 0,
	`verifiedActionCount` int NOT NULL DEFAULT 0,
	`candidateCount` int NOT NULL DEFAULT 0,
	`missingSnapshotCount` int NOT NULL DEFAULT 0,
	`ytdBasisMismatchCount` int NOT NULL DEFAULT 0,
	`rangeBasisMismatchCount` int NOT NULL DEFAULT 0,
	`summary` json,
	`error` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `corporate_action_audit_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `corporate_action_audit_runs_monthKey_unique` UNIQUE(`monthKey`)
);
--> statement-breakpoint
CREATE INDEX `ix_corporate_action_audit_runs_status` ON `corporate_action_audit_runs` (`status`);--> statement-breakpoint
CREATE INDEX `ix_corporate_action_audit_runs_started` ON `corporate_action_audit_runs` (`startedAt`);