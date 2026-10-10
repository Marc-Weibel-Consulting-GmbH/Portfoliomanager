CREATE TABLE `momentum_monitor_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshotDate` varchar(10) NOT NULL,
	`status` enum('running','completed','failed','skipped') NOT NULL DEFAULT 'running',
	`activeInstrumentCount` int NOT NULL DEFAULT 0,
	`qualifiedCount` int NOT NULL DEFAULT 0,
	`dataGapCount` int NOT NULL DEFAULT 0,
	`excludedCount` int NOT NULL DEFAULT 0,
	`crashRiskCount` int NOT NULL DEFAULT 0,
	`summary` json,
	`error` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `momentum_monitor_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `momentum_monitor_runs_snapshotDate_unique` UNIQUE(`snapshotDate`)
);
--> statement-breakpoint
CREATE TABLE `momentum_monitor_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticker` varchar(50) NOT NULL,
	`snapshotDate` varchar(10) NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`sector` varchar(100),
	`region` varchar(80),
	`sourceSymbol` varchar(50),
	`priceBasis` varchar(80) NOT NULL,
	`coverageDays` int NOT NULL DEFAULT 0,
	`return6mBps` int,
	`return12mBps` int,
	`compositeBps` int,
	`universePercentile` int,
	`sectorPercentile` int,
	`benchmarkKey` varchar(32),
	`benchmarkReturn6mBps` int,
	`benchmarkReturn12mBps` int,
	`relative6mBps` int,
	`relative12mBps` int,
	`trendState` varchar(32),
	`trendDistanceBps` int,
	`crashRiskActive` tinyint NOT NULL DEFAULT 0,
	`crashRiskReason` text,
	`dataQuality` varchar(32) NOT NULL,
	`dataQualityReason` text,
	`methodVersion` varchar(20) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `momentum_monitor_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_momentum_monitor_snapshot_ticker_date` UNIQUE(`ticker`,`snapshotDate`)
);
--> statement-breakpoint
CREATE INDEX `ix_momentum_monitor_runs_status` ON `momentum_monitor_runs` (`status`);--> statement-breakpoint
CREATE INDEX `ix_momentum_monitor_snapshot_date_quality` ON `momentum_monitor_snapshots` (`snapshotDate`,`dataQuality`);--> statement-breakpoint
CREATE INDEX `ix_momentum_monitor_snapshot_sector_date` ON `momentum_monitor_snapshots` (`sector`,`snapshotDate`);