ALTER TABLE `portfolioMetricsSnapshot` ADD `volatility` decimal(8,4);--> statement-breakpoint
ALTER TABLE `portfolioMetricsSnapshot` ADD `sortino` decimal(8,4);--> statement-breakpoint
ALTER TABLE `portfolioMetricsSnapshot` ADD `maxDrawdown` decimal(8,4);--> statement-breakpoint
ALTER TABLE `portfolioMetricsSnapshot` ADD `source` varchar(16) DEFAULT 'live';--> statement-breakpoint
ALTER TABLE `portfolioMetricsSnapshot` ADD `qualityScore` int;--> statement-breakpoint
ALTER TABLE `portfolioMetricsSnapshot` ADD `qualityComponents` text;--> statement-breakpoint
ALTER TABLE `portfolioMetricsSnapshot` ADD `dataCoveragePct` int;