CREATE TABLE `research_signals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`signalId` varchar(128) NOT NULL,
	`title` text NOT NULL,
	`url` varchar(1024),
	`sourceName` varchar(255),
	`sourceCategory` varchar(128),
	`contentType` varchar(64),
	`evidenceType` varchar(64),
	`relevanceScore` int,
	`topics` json,
	`followUpRequired` tinyint NOT NULL DEFAULT 0,
	`publishedAt` timestamp,
	`classifiedAt` timestamp,
	`fetchedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `research_signals_id` PRIMARY KEY(`id`),
	CONSTRAINT `research_signals_signalId_unique` UNIQUE(`signalId`)
);
