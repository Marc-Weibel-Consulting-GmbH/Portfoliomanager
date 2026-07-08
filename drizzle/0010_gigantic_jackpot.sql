CREATE TABLE `portfolio_recommendation_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`portfolioId` int NOT NULL,
	`cadence` enum('off','weekly','monthly','quarterly') NOT NULL DEFAULT 'off',
	`autoExecute` tinyint NOT NULL DEFAULT 0,
	`lastGeneratedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portfolio_recommendation_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `portfolio_recommendation_config_portfolioId_unique` UNIQUE(`portfolioId`)
);
--> statement-breakpoint
CREATE TABLE `regime_signal_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`regime` varchar(40) NOT NULL,
	`qualityWeight` decimal(5,4),
	`tradingWeight` decimal(5,4),
	`engineWeights` json,
	`sampleSize` int DEFAULT 0,
	`lastLearnedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `regime_signal_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `regime_signal_config_regime_unique` UNIQUE(`regime`)
);
--> statement-breakpoint
CREATE TABLE `wikifolio_trades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`wikifolioId` int NOT NULL,
	`externalTradeId` varchar(80),
	`isin` varchar(20),
	`resolvedTicker` varchar(50),
	`name` varchar(255),
	`side` enum('buy','sell','other') NOT NULL DEFAULT 'other',
	`executionPrice` decimal(14,4),
	`weightage` decimal(8,4),
	`executedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wikifolio_trades_id` PRIMARY KEY(`id`),
	CONSTRAINT `ux_wikifolio_trades_dedupe` UNIQUE(`wikifolioId`,`externalTradeId`)
);
--> statement-breakpoint
CREATE TABLE `wikifolios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`symbol` varchar(60) NOT NULL,
	`wikifolioId` varchar(64),
	`title` varchar(255),
	`traderName` varchar(150),
	`isin` varchar(20),
	`sharpeRatio` decimal(8,4),
	`performance1y` decimal(10,4),
	`performanceEver` decimal(10,4),
	`maxDrawdown` decimal(10,4),
	`aum` decimal(16,2),
	`isTracked` tinyint NOT NULL DEFAULT 0,
	`lastTradesSyncAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wikifolios_id` PRIMARY KEY(`id`),
	CONSTRAINT `wikifolios_symbol_unique` UNIQUE(`symbol`)
);
--> statement-breakpoint
CREATE INDEX `ix_portfolio_rec_config_portfolio` ON `portfolio_recommendation_config` (`portfolioId`);--> statement-breakpoint
CREATE INDEX `ix_regime_signal_config_regime` ON `regime_signal_config` (`regime`);--> statement-breakpoint
CREATE INDEX `ix_wikifolio_trades_wikifolio` ON `wikifolio_trades` (`wikifolioId`);--> statement-breakpoint
CREATE INDEX `ix_wikifolio_trades_ticker` ON `wikifolio_trades` (`resolvedTicker`);--> statement-breakpoint
CREATE INDEX `ix_wikifolio_trades_executed_at` ON `wikifolio_trades` (`executedAt`);--> statement-breakpoint
CREATE INDEX `ix_wikifolios_symbol` ON `wikifolios` (`symbol`);--> statement-breakpoint
CREATE INDEX `ix_wikifolios_tracked` ON `wikifolios` (`isTracked`);