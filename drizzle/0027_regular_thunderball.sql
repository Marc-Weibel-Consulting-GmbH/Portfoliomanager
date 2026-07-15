CREATE TABLE `gapFillLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runAt` timestamp NOT NULL DEFAULT (now()),
	`triggeredBy` varchar(32) NOT NULL DEFAULT 'cron',
	`gapsFound` json NOT NULL,
	`stocksAdded` json NOT NULL,
	`stocksSkipped` int NOT NULL DEFAULT 0,
	`durationMs` int,
	`error` text,
	CONSTRAINT `gapFillLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portfolioProposalLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`riskProfile` varchar(32),
	`investmentGoal` varchar(32),
	`referenceCurrency` varchar(8),
	`maxFxExposurePct` int,
	`investmentAmount` int,
	`positionCount` int,
	`method` varchar(32),
	`qualityTier` varchar(16),
	`sharpe` decimal(6,3),
	`expectedReturnPct` decimal(6,2),
	`volatilityPct` decimal(6,2),
	`fxWeightPct` decimal(6,2),
	`positions` json,
	`challengerCritique` text,
	`challengerRejectedCount` int,
	`synthesizerVerdict` text,
	`overallConfidence` enum('hoch','mittel','niedrig'),
	`finalAdjustments` json,
	`agentDurationMs` int,
	`meetsKennzahlenFilter` enum('ja','nein','n/a') DEFAULT 'n/a',
	`kennzahlenFilterReason` text,
	`accepted` enum('ja','nein','unbekannt') DEFAULT 'unbekannt',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `portfolioProposalLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `alertConfig` ADD `alertCooldownDays` int DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE `stocks` ADD `lastAlertSentAt` timestamp;