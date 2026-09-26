ALTER TABLE `stocks` ADD `dividendYieldBasis` varchar(32);--> statement-breakpoint
ALTER TABLE `stocks` ADD `dividendAnnualAmount` varchar(50);--> statement-breakpoint
ALTER TABLE `stocks` ADD `dividendCurrency` varchar(3);--> statement-breakpoint
ALTER TABLE `stocks` ADD `dividendEventCount` int;--> statement-breakpoint
ALTER TABLE `stocks` ADD `dividendAsOfDate` varchar(10);--> statement-breakpoint
ALTER TABLE `stocks` ADD `dividendYieldSource` varchar(80);