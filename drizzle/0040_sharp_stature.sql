CREATE TABLE `priceAlerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`ticker` varchar(50) NOT NULL,
	`alertType` enum('above_price','below_price','percent_change') NOT NULL,
	`targetPrice` varchar(50),
	`percentChange` varchar(50),
	`isActive` tinyint NOT NULL DEFAULT 1,
	`lastTriggered` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `priceAlerts_id` PRIMARY KEY(`id`)
);
