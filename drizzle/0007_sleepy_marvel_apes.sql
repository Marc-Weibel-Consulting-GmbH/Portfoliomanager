CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`action` enum('add','delete','update_weight','update_data') NOT NULL,
	`ticker` varchar(50) NOT NULL,
	`companyName` varchar(255),
	`details` text,
	`oldValue` text,
	`newValue` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
