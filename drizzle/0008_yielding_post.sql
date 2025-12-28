CREATE TABLE `research` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text,
	`file_url` varchar(500),
	`file_type` varchar(50),
	`file_name` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `research_id` PRIMARY KEY(`id`)
);
