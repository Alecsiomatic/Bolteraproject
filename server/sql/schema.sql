SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `SeatStatusHistory`;
DROP TABLE IF EXISTS `Ticket`;
DROP TABLE IF EXISTS `EventPriceTier`;
DROP TABLE IF EXISTS `SeatHold`;
DROP TABLE IF EXISTS `EventSession`;
DROP TABLE IF EXISTS `Event`;
DROP TABLE IF EXISTS `Seat`;
DROP TABLE IF EXISTS `VenueZone`;
DROP TABLE IF EXISTS `VenueLayout`;
DROP TABLE IF EXISTS `Venue`;
DROP TABLE IF EXISTS `Order`;
DROP TABLE IF EXISTS `UserFavorite`;
DROP TABLE IF EXISTS `User`;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE IF NOT EXISTS `User` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(50) NULL,
    `password` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NULL,
    `avatarUrl` VARCHAR(191) NULL,
    `role` ENUM('ADMIN', 'OPERATOR', 'VIEWER', 'USER') NOT NULL DEFAULT 'USER',
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `last_login` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Venue` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `postalCode` VARCHAR(191) NULL,
    `capacity` INTEGER NULL,
    `description` TEXT NULL,
    `layoutJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `Venue_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

  CREATE TABLE IF NOT EXISTS `VenueLayout` (
    `id` VARCHAR(191) NOT NULL,
    `venueId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `layoutJson` JSON NOT NULL,
    `metadata` JSON NULL,
    `isDefault` TINYINT(1) NOT NULL DEFAULT 0,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`),
    INDEX `VenueLayout_venueId_version_idx`(`venueId`, `version`),
    CONSTRAINT `VenueLayout_venueId_fkey`
      FOREIGN KEY (`venueId`) REFERENCES `Venue`(`id`)
      ON DELETE CASCADE ON UPDATE CASCADE
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `VenueZone` (
    `id` VARCHAR(191) NOT NULL,
    `venueId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NULL,
    `basePrice` DECIMAL(10, 2) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`),
    INDEX `VenueZone_venueId_idx`(`venueId`),
    CONSTRAINT `VenueZone_venueId_fkey`
      FOREIGN KEY (`venueId`) REFERENCES `Venue`(`id`)
      ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Seat` (
    `id` VARCHAR(191) NOT NULL,
    `venueId` VARCHAR(191) NOT NULL,
    `zoneId` VARCHAR(191) NULL,
    `label` VARCHAR(191) NOT NULL,
    `rowLabel` VARCHAR(191) NULL,
    `columnNumber` INTEGER NULL,
  `seatType` ENUM('STANDARD', 'VIP', 'ACCESSIBLE', 'COMPANION') NULL,
  `basePrice` DECIMAL(10, 2) NULL,
    `status` ENUM('AVAILABLE', 'RESERVED', 'SOLD', 'BLOCKED') NOT NULL DEFAULT 'AVAILABLE',
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `Seat_venueId_label_idx`(`venueId`, `label`),
    UNIQUE INDEX `Seat_venueId_label_key`(`venueId`, `label`),
    PRIMARY KEY (`id`),
    CONSTRAINT `Seat_venueId_fkey`
      FOREIGN KEY (`venueId`) REFERENCES `Venue`(`id`)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `Seat_zoneId_fkey`
      FOREIGN KEY (`zoneId`) REFERENCES `VenueZone`(`id`)
      ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Event` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `venueId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `Event_slug_key`(`slug`),
    PRIMARY KEY (`id`),
    CONSTRAINT `Event_venueId_fkey`
      FOREIGN KEY (`venueId`) REFERENCES `Venue`(`id`)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `Event_createdById_fkey`
      FOREIGN KEY (`createdById`) REFERENCES `User`(`id`)
      ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `UserFavorite` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE INDEX `UserFavorite_userId_eventId_key`(`userId`, `eventId`),
    INDEX `UserFavorite_userId_idx`(`userId`),
    INDEX `UserFavorite_eventId_idx`(`eventId`),
    CONSTRAINT `UserFavorite_userId_fkey`
      FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `UserFavorite_eventId_fkey`
      FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`)
      ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `EventSession` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `layoutId` VARCHAR(191) NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NULL,
    `status` ENUM('SCHEDULED', 'SALES_OPEN', 'SOLD_OUT', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `capacity` INTEGER NULL,
    `doorsOpenAt` DATETIME(3) NULL,
    `salesOpenAt` DATETIME(3) NULL,
    `salesCloseAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `EventSession_eventId_startsAt_idx`(`eventId`, `startsAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `EventSession_eventId_fkey`
      FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `EventSession_layoutId_fkey`
      FOREIGN KEY (`layoutId`) REFERENCES `VenueLayout`(`id`)
      ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Order` (
    `id` VARCHAR(191) NOT NULL,
    `buyerName` VARCHAR(191) NOT NULL,
    `buyerEmail` VARCHAR(191) NOT NULL,
    `buyerPhone` VARCHAR(191) NULL,
    `total` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'CANCELLED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `paymentReference` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `Order_userId_fkey`
      FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
      ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SeatHold` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `seatId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'EXPIRED', 'RELEASED', 'CONVERTED') NOT NULL DEFAULT 'ACTIVE',
    `expiresAt` DATETIME(3) NOT NULL,
    `releasedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `SeatHold_session_seat_active_idx`(`sessionId`, `seatId`, `status`),
    CONSTRAINT `SeatHold_sessionId_fkey`
      FOREIGN KEY (`sessionId`) REFERENCES `EventSession`(`id`)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `SeatHold_seatId_fkey`
      FOREIGN KEY (`seatId`) REFERENCES `Seat`(`id`)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `SeatHold_userId_fkey`
      FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
      ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `EventPriceTier` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NULL,
    `zoneId` VARCHAR(191) NULL,
    `seatType` ENUM('STANDARD', 'VIP', 'ACCESSIBLE', 'COMPANION') NULL,
    `label` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `fee` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'MXN',
    `minQuantity` INTEGER NULL,
    `maxQuantity` INTEGER NULL,
    `capacity` INTEGER NULL,
    `isDefault` TINYINT(1) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`),
    INDEX `EventPriceTier_event_session_idx`(`eventId`, `sessionId`),
    INDEX `EventPriceTier_zone_idx`(`zoneId`),
    CONSTRAINT `EventPriceTier_eventId_fkey`
      FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `EventPriceTier_sessionId_fkey`
      FOREIGN KEY (`sessionId`) REFERENCES `EventSession`(`id`)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `EventPriceTier_zoneId_fkey`
      FOREIGN KEY (`zoneId`) REFERENCES `VenueZone`(`id`)
      ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Ticket` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `seatId` VARCHAR(191) NULL,
    `tierId` VARCHAR(191) NULL,
    `holdId` VARCHAR(191) NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'MXN',
    `status` ENUM('PENDING', 'RESERVED', 'SOLD', 'CANCELLED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `purchasedAt` DATETIME(3) NULL,
    `orderId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `Ticket_sessionId_status_idx`(`sessionId`, `status`),
    PRIMARY KEY (`id`),
    CONSTRAINT `Ticket_sessionId_fkey`
      FOREIGN KEY (`sessionId`) REFERENCES `EventSession`(`id`)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `Ticket_seatId_fkey`
      FOREIGN KEY (`seatId`) REFERENCES `Seat`(`id`)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `Ticket_tierId_fkey`
      FOREIGN KEY (`tierId`) REFERENCES `EventPriceTier`(`id`)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `Ticket_holdId_fkey`
      FOREIGN KEY (`holdId`) REFERENCES `SeatHold`(`id`)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `Ticket_orderId_fkey`
      FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`)
      ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SeatStatusHistory` (
    `id` VARCHAR(191) NOT NULL,
    `seatId` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NULL,
    `fromStatus` ENUM('AVAILABLE', 'RESERVED', 'SOLD', 'BLOCKED') NULL,
    `toStatus` ENUM('AVAILABLE', 'RESERVED', 'SOLD', 'BLOCKED') NOT NULL,
    `reason` VARCHAR(191) NULL,
    `changedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    CONSTRAINT `SeatStatusHistory_seatId_fkey`
      FOREIGN KEY (`seatId`) REFERENCES `Seat`(`id`)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `SeatStatusHistory_sessionId_fkey`
      FOREIGN KEY (`sessionId`) REFERENCES `EventSession`(`id`)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `SeatStatusHistory_changedById_fkey`
      FOREIGN KEY (`changedById`) REFERENCES `User`(`id`)
      ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
