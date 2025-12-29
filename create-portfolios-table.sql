-- Create portfolios table if it doesn't exist
CREATE TABLE IF NOT EXISTS `portfolios` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `portfolioData` text NOT NULL,
  `portfolioType` varchar(50),
  `isLive` boolean DEFAULT false,
  `liveStartDate` timestamp,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
);

-- Add index on userId for faster queries
CREATE INDEX IF NOT EXISTS `idx_portfolios_userId` ON `portfolios` (`userId`);
