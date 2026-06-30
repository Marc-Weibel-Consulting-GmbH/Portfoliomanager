CREATE TABLE `multiAgentSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`prompt` text NOT NULL,
	`context` text,
	`responses` json,
	`synthesis` text,
	`status` enum('pending','running','synthesizing','completed','error') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `multiAgentSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `researchDocuments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(500) NOT NULL,
	`filename` varchar(500) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileType` enum('pdf','word','ppt','excel','other') NOT NULL DEFAULT 'pdf',
	`fileSize` int,
	`extractedText` longtext,
	`summary` text,
	`keyInsights` json,
	`relevantTickers` json,
	`status` enum('uploading','extracting','analyzing','ready','error') NOT NULL DEFAULT 'uploading',
	`errorMessage` text,
	`uploadedBy` int,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	`analyzedAt` timestamp,
	CONSTRAINT `researchDocuments_id` PRIMARY KEY(`id`)
);
