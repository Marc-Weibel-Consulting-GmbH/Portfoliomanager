CREATE TABLE `stocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`ticker` varchar(50) NOT NULL,
	`currentPrice` varchar(50),
	`currency` varchar(10),
	`peRatio` varchar(50),
	`pegRatio` varchar(50),
	`dividendYield` varchar(50),
	`exchangeRateToChf` varchar(50),
	`category` varchar(100),
	`moat1` text,
	`moat2` text,
	`moat3` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stocks_id` PRIMARY KEY(`id`),
	CONSTRAINT `stocks_ticker_unique` UNIQUE(`ticker`)
);
