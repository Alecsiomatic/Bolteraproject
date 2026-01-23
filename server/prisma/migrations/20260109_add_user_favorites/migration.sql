-- Add phone column and expand role enum for end-user accounts
ALTER TABLE `User`
  ADD COLUMN IF NOT EXISTS `phone` VARCHAR(50) NULL AFTER `email`,
  ADD COLUMN IF NOT EXISTS `avatarUrl` VARCHAR(191) NULL AFTER `phone`;

ALTER TABLE `User`
  MODIFY COLUMN `role` ENUM('ADMIN','OPERATOR','VIEWER','USER') NOT NULL DEFAULT 'USER';

-- Create user favorites table for wishlist functionality
CREATE TABLE IF NOT EXISTS `UserFavorite` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `eventId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY `UserFavorite_userId_eventId_key` (`userId`, `eventId`),
  KEY `UserFavorite_userId_idx` (`userId`),
  KEY `UserFavorite_eventId_idx` (`eventId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `UserFavorite_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `UserFavorite_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
