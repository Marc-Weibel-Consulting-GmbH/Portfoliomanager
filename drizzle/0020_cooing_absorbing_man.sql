CREATE TABLE `analyzer_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`payload` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analyzer_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `correlations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`a` varchar(16) NOT NULL,
	`b` varchar(16) NOT NULL,
	`rho` decimal(10,6) NOT NULL,
	CONSTRAINT `correlations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `holdings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`symbol` varchar(16) NOT NULL,
	`quantity` decimal(18,6) NOT NULL,
	`market_value` decimal(18,6) NOT NULL,
	CONSTRAINT `holdings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`symbol` varchar(16) NOT NULL,
	`date` date NOT NULL,
	`close` decimal(18,6) NOT NULL,
	CONSTRAINT `prices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `securities` (
	`symbol` varchar(16) NOT NULL,
	`name` varchar(256) NOT NULL,
	`sector` varchar(64) NOT NULL,
	`industry` varchar(128) NOT NULL,
	`currency` varchar(8) NOT NULL,
	CONSTRAINT `securities_symbol` PRIMARY KEY(`symbol`)
);
--> statement-breakpoint
CREATE INDEX `ix_prices_symbol_date` ON `prices` (`symbol`,`date`);