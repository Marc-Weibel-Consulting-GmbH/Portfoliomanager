ALTER TABLE `portfolioProposalLog` ADD `realizedReturn30dPct` decimal(8,2);--> statement-breakpoint
ALTER TABLE `portfolioProposalLog` ADD `benchmarkReturn30dPct` decimal(8,2);--> statement-breakpoint
ALTER TABLE `portfolioProposalLog` ADD `realizedAlpha30dPct` decimal(8,2);--> statement-breakpoint
ALTER TABLE `portfolioProposalLog` ADD `outcomeCoveragePct` decimal(6,2);--> statement-breakpoint
ALTER TABLE `portfolioProposalLog` ADD `outcomeEvaluatedAt` timestamp;