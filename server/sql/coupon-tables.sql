-- Create Coupon table
CREATE TABLE IF NOT EXISTS `Coupon` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT,
  `discountType` ENUM('PERCENTAGE', 'FIXED') NOT NULL DEFAULT 'PERCENTAGE',
  `discountValue` DECIMAL(10, 2) NOT NULL,
  `minPurchase` DECIMAL(10, 2) DEFAULT NULL,
  `maxDiscount` DECIMAL(10, 2) DEFAULT NULL,
  `usageLimit` INT DEFAULT NULL,
  `usedCount` INT NOT NULL DEFAULT 0,
  `perUserLimit` INT DEFAULT 1,
  `eventId` VARCHAR(191) DEFAULT NULL,
  `startsAt` DATETIME(3) DEFAULT NULL,
  `expiresAt` DATETIME(3) DEFAULT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdBy` VARCHAR(191) DEFAULT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `Coupon_code_key` (`code`),
  KEY `Coupon_eventId_idx` (`eventId`),
  KEY `Coupon_code_isActive_idx` (`code`, `isActive`),
  KEY `Coupon_expiresAt_idx` (`expiresAt`),
  CONSTRAINT `Coupon_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `Coupon_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create CouponUsage table to track which users used which coupons
CREATE TABLE IF NOT EXISTS `CouponUsage` (
  `id` VARCHAR(191) NOT NULL,
  `couponId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) DEFAULT NULL,
  `discountApplied` DECIMAL(10, 2) NOT NULL,
  `usedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  
  PRIMARY KEY (`id`),
  KEY `CouponUsage_couponId_idx` (`couponId`),
  KEY `CouponUsage_userId_idx` (`userId`),
  KEY `CouponUsage_orderId_idx` (`orderId`),
  CONSTRAINT `CouponUsage_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `Coupon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CouponUsage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CouponUsage_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add couponId and couponDiscount to Order table
ALTER TABLE `Order` 
ADD COLUMN IF NOT EXISTS `couponId` VARCHAR(191) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS `couponCode` VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS `couponDiscount` DECIMAL(10, 2) DEFAULT NULL;
