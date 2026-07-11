CREATE TABLE `ki_boom_dynamic_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`metricKey` varchar(64) NOT NULL,
	`numericValue` decimal(12,2),
	`displayValue` varchar(128),
	`unit` varchar(32),
	`source` varchar(512),
	`description` text,
	`fetchedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ki_boom_dynamic_metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ix_ki_boom_dyn_key` ON `ki_boom_dynamic_metrics` (`metricKey`);--> statement-breakpoint
CREATE INDEX `ix_ki_boom_dyn_fetched` ON `ki_boom_dynamic_metrics` (`fetchedAt`);