CREATE TABLE `algo_backtest_portfolios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`riskProfile` varchar(32) NOT NULL,
	`goal` varchar(32) NOT NULL,
	`positionsSnapshot` text NOT NULL,
	`proposalMetrics` text,
	`appliedSectorTilts` text,
	`appliedFactorTilts` text,
	`challengerCritique` text,
	`synthesizerRecommendation` text,
	`actualPerf30dPct` decimal(8,4),
	`actualSharpe30d` decimal(8,4),
	`actualVolatility30d` decimal(8,4),
	`actualMaxDrawdown30d` decimal(8,4),
	`benchmarkPerf30dPct` decimal(8,4),
	`alpha30dPct` decimal(8,4),
	`portfolioAnalysis` text,
	`creationError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `algo_backtest_portfolios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `algo_backtest_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runMonth` date NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'creating',
	`algoVersion` varchar(64),
	`marktHubSnapshot` text,
	`sectorTiltsSnapshot` text,
	`leadingFactor` varchar(64),
	`marktRegime` varchar(64),
	`llmAnalysis` text,
	`avgPerf30dPct` decimal(8,4),
	`benchmarkPerf30dPct` decimal(8,4),
	`portfolioCount` int DEFAULT 0,
	`evaluatedAt` timestamp,
	`errorDetails` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `algo_backtest_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `algo_backtest_runs_runMonth_unique` UNIQUE(`runMonth`)
);
--> statement-breakpoint
CREATE TABLE `algo_tuning_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`triggeredByRunId` int,
	`fromVersion` varchar(64),
	`toVersion` varchar(64),
	`parameterChanged` varchar(128) NOT NULL,
	`oldValue` varchar(256),
	`newValue` varchar(256),
	`rationale` text NOT NULL,
	`overfittingRisk` varchar(16) DEFAULT 'low',
	`expectedImpact` text,
	`actualImpact` text,
	`reverted` int DEFAULT 0,
	`source` varchar(32) DEFAULT 'llm_auto',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `algo_tuning_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_abp_run_profile` ON `algo_backtest_portfolios` (`runId`,`riskProfile`,`goal`);--> statement-breakpoint
CREATE INDEX `idx_abt_runs_status` ON `algo_backtest_runs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_atl_run` ON `algo_tuning_log` (`triggeredByRunId`);