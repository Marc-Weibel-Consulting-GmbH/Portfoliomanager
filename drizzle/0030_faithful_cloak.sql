ALTER TABLE `portfolioProposalLog` ADD `adminFeedback` json;--> statement-breakpoint
ALTER TABLE `portfolioProposalLog` ADD `adminReviewedPositions` json;--> statement-breakpoint
ALTER TABLE `portfolioProposalLog` ADD `adminComments` json;--> statement-breakpoint
ALTER TABLE `portfolioProposalLog` ADD `reviewStatus` enum('pending','reviewed','approved') DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `portfolioProposalLog` ADD `reviewedAt` timestamp;--> statement-breakpoint
ALTER TABLE `portfolioProposalLog` ADD `returnToWizardToken` varchar(64);