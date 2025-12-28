CREATE TABLE `appSecrets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(255) NOT NULL,
	`encryptedValue` text NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appSecrets_id` PRIMARY KEY(`id`),
	CONSTRAINT `appSecrets_key_unique` UNIQUE(`key`)
);
