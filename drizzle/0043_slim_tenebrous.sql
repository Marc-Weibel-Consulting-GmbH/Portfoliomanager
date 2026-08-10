CREATE TABLE `hyperscaler_capex` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company` varchar(16) NOT NULL,
	`quarter` varchar(8) NOT NULL,
	`calendarYear` int NOT NULL,
	`calendarQuarter` int NOT NULL,
	`periodEndDate` varchar(10) NOT NULL,
	`capexBillionUsd` decimal(8,3) NOT NULL,
	`cashCapexBillionUsd` decimal(8,3),
	`financeLeasesBillionUsd` decimal(8,3),
	`dataSource` varchar(32) NOT NULL DEFAULT 'sec_10q',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `hyperscaler_capex_id` PRIMARY KEY(`id`),
	CONSTRAINT `company_quarter_unique` UNIQUE(`company`,`quarter`)
);
