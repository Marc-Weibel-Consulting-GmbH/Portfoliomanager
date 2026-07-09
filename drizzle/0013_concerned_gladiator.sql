CREATE TABLE `stock_score_snapshot` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticker` varchar(50) NOT NULL,
	`snapshotDate` varchar(10) NOT NULL,
	`qualityScore` int,
	`momentumScore` int,
	`combinedScore` int,
	`signalType` enum('buy','sell','hold') DEFAULT 'hold',
	`signalStrength` enum('strong','moderate','weak') DEFAULT 'weak',
	`overallGrade` varchar(5),
	`currentPrice` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stock_score_snapshot_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ix_score_snapshot_ticker_date` ON `stock_score_snapshot` (`ticker`,`snapshotDate`);--> statement-breakpoint
CREATE INDEX `ix_score_snapshot_ticker` ON `stock_score_snapshot` (`ticker`);