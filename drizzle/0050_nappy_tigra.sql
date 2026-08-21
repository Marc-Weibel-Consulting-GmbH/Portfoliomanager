CREATE TABLE `research_desk_evidence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`evidenceKey` varchar(192) NOT NULL,
	`runId` int NOT NULL,
	`ticker` varchar(32) NOT NULL,
	`isin` varchar(16),
	`cik` varchar(10) NOT NULL,
	`eventType` varchar(48) NOT NULL,
	`formType` varchar(16) NOT NULL,
	`sourceUrl` varchar(1024) NOT NULL,
	`sourcePublishedAt` timestamp,
	`fetchedAt` timestamp NOT NULL,
	`sourceVersion` varchar(64) NOT NULL,
	`rawHash` varchar(64) NOT NULL,
	`rawPayload` json NOT NULL,
	`isShadowMode` tinyint NOT NULL DEFAULT 1,
	`decisionImpact` varchar(16) NOT NULL DEFAULT 'none',
	`completenessStatus` varchar(32) NOT NULL,
	`checkerStatus` varchar(32) NOT NULL DEFAULT 'pending',
	`validationReasons` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `research_desk_evidence_id` PRIMARY KEY(`id`),
	CONSTRAINT `research_desk_evidence_evidenceKey_unique` UNIQUE(`evidenceKey`)
);
--> statement-breakpoint
CREATE TABLE `research_desk_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runKey` varchar(192) NOT NULL,
	`runDate` date NOT NULL,
	`universeVersion` varchar(64) NOT NULL,
	`sourceVersion` varchar(64) NOT NULL,
	`isShadowMode` tinyint NOT NULL DEFAULT 1,
	`status` varchar(32) NOT NULL DEFAULT 'running',
	`tickersRequested` int NOT NULL DEFAULT 0,
	`tickersFetched` int NOT NULL DEFAULT 0,
	`evidenceObserved` int NOT NULL DEFAULT 0,
	`evidenceIncomplete` int NOT NULL DEFAULT 0,
	`errors` json,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `research_desk_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `research_desk_runs_runKey_unique` UNIQUE(`runKey`)
);
--> statement-breakpoint
CREATE INDEX `ix_research_desk_evidence_run` ON `research_desk_evidence` (`runId`);--> statement-breakpoint
CREATE INDEX `ix_research_desk_evidence_ticker_published` ON `research_desk_evidence` (`ticker`,`sourcePublishedAt`);--> statement-breakpoint
CREATE INDEX `ix_research_desk_evidence_checker` ON `research_desk_evidence` (`checkerStatus`,`completenessStatus`);--> statement-breakpoint
CREATE INDEX `ix_research_desk_runs_date` ON `research_desk_runs` (`runDate`);