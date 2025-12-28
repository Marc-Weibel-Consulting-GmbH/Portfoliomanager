CREATE TABLE `portfolioTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`portfolioId` int NOT NULL,
	`transactionType` enum('buy','sell','dividend','deposit','withdrawal') NOT NULL,
	`ticker` varchar(50),
	`shares` varchar(50),
	`pricePerShare` varchar(50),
	`totalAmount` varchar(50) NOT NULL,
	`fees` varchar(50) DEFAULT '0',
	`notes` text,
	`transactionDate` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `portfolioTransactions_id` PRIMARY KEY(`id`)
);
