CREATE TABLE `modelArtifacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kind` enum('rf_signal','gb_signal','ranking','ensemble_weights') NOT NULL,
	`version` int NOT NULL,
	`status` enum('candidate','active','archived','failed') NOT NULL DEFAULT 'candidate',
	`format` varchar(20) NOT NULL DEFAULT 'onnx',
	`artifactUri` varchar(512),
	`modelBlob` longtext,
	`featureSpec` json NOT NULL,
	`trainStart` varchar(10),
	`trainEnd` varchar(10),
	`universeSize` int,
	`metrics` json,
	`promotedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `modelArtifacts_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_model_artifacts_kind_version` UNIQUE(`kind`,`version`)
);
--> statement-breakpoint
CREATE TABLE `signal_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticker` varchar(20) NOT NULL,
	`action` varchar(20) NOT NULL,
	`selectedEngine` varchar(30) NOT NULL,
	`regime` varchar(30) NOT NULL,
	`regimeConfidence` decimal(5,3),
	`conviction` decimal(5,3) NOT NULL,
	`rawScore` decimal(6,4) NOT NULL,
	`adjustedScore` decimal(6,4) NOT NULL,
	`direction` int NOT NULL,
	`holdingPeriodHint` int,
	`stopLossPct` decimal(6,3),
	`takeProfitPct` decimal(6,3),
	`priceAtSignal` decimal(12,4),
	`priceAtEvaluation` decimal(12,4),
	`engineScores` json,
	`evaluatedAt` timestamp,
	`actualReturnPct` decimal(7,4),
	`directionCorrect` tinyint,
	`riskDecision` varchar(20),
	`computedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `signal_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ix_model_artifacts_kind_status` ON `modelArtifacts` (`kind`,`status`);--> statement-breakpoint
CREATE INDEX `ix_signal_history_ticker` ON `signal_history` (`ticker`);--> statement-breakpoint
CREATE INDEX `ix_signal_history_computed_at` ON `signal_history` (`computedAt`);--> statement-breakpoint
CREATE INDEX `ix_signal_history_engine_regime` ON `signal_history` (`selectedEngine`,`regime`);--> statement-breakpoint
ALTER TABLE `stocks` DROP COLUMN `previousClose`;--> statement-breakpoint
ALTER TABLE `stocks` DROP COLUMN `dailyChangePercent`;