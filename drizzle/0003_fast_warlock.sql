CREATE TABLE `news` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticker` varchar(20) NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`url` varchar(500),
	`imageUrl` varchar(500),
	`source` varchar(100),
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `news_id` PRIMARY KEY(`id`)
);
