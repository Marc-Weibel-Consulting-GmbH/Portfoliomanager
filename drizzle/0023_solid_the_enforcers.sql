ALTER TABLE `portfolioTransactions` ADD `source` varchar(50) DEFAULT 'manual';--> statement-breakpoint
CREATE INDEX `ix_portfolio_transactions_source` ON `portfolioTransactions` (`source`);