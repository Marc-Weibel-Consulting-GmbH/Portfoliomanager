ALTER TABLE `users` ADD `plan` enum('free','plus','pro') DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `planStatus` enum('active','past_due','canceled') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `planRenewsAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `stripeSubscriptionId` varchar(255);--> statement-breakpoint
-- K-A1 Grandfathering: bisherige CHF-10-Käufer (hasPaid=1) erhalten dauerhaft Plus.
UPDATE `users` SET `plan` = 'plus' WHERE `hasPaid` = 1;
