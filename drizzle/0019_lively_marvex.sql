CREATE TABLE `ki_boom_metrics_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recordedAt` timestamp NOT NULL,
	`nvidiaPrice` decimal(10,2),
	`mag7AvgYtd` decimal(8,2),
	`openAiVerlustquote` decimal(6,2),
	`hyperscalerCapexWachstum` decimal(8,2),
	`vcAnteilKI` decimal(6,2),
	`pilotProjektROIQuote` decimal(6,2),
	`overallZone` varchar(10),
	`activeWarnings` int DEFAULT 0,
	`activeCritical` int DEFAULT 0,
	`scenarioSanfte` int,
	`scenarioCrash` int,
	`scenarioBoom` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ki_boom_metrics_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ix_ki_boom_recorded_at` ON `ki_boom_metrics_history` (`recordedAt`);