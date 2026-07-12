ALTER TABLE `ki_boom_metrics_history` ADD `soxPrice` decimal(10,2);--> statement-breakpoint
ALTER TABLE `ki_boom_metrics_history` ADD `arkkPrice` decimal(10,2);--> statement-breakpoint
ALTER TABLE `ki_boom_metrics_history` ADD `nvdaPE` decimal(8,2);--> statement-breakpoint
ALTER TABLE `ki_boom_metrics_history` ADD `vixLevel` decimal(6,2);--> statement-breakpoint
ALTER TABLE `stocks` ADD `eodhdTicker` varchar(50);