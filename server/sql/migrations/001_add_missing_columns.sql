-- ============================================
-- MIGRACIÓN 001: Agregar columnas faltantes
-- Ejecutar después de schema.sql si se usa SQL manual
-- ============================================

SET NAMES utf8mb4;

-- ============================================
-- 1. AGREGAR COLUMNAS FALTANTES EN Order
-- ============================================

-- Verificar y agregar orderNumber
ALTER TABLE `Order` 
  ADD COLUMN IF NOT EXISTS `orderNumber` VARCHAR(50) UNIQUE AFTER `id`;

-- Verificar y agregar campos de billing/pricing
ALTER TABLE `Order`
  ADD COLUMN IF NOT EXISTS `subtotal` DECIMAL(10, 2) NULL AFTER `total`,
  ADD COLUMN IF NOT EXISTS `serviceFee` DECIMAL(10, 2) NULL AFTER `subtotal`,
  ADD COLUMN IF NOT EXISTS `couponCode` VARCHAR(50) NULL AFTER `serviceFee`,
  ADD COLUMN IF NOT EXISTS `couponDiscount` DECIMAL(10, 2) NULL AFTER `couponCode`,
  ADD COLUMN IF NOT EXISTS `currency` VARCHAR(10) DEFAULT 'MXN' AFTER `couponDiscount`,
  ADD COLUMN IF NOT EXISTS `paymentMethod` VARCHAR(50) NULL AFTER `paymentReference`,
  ADD COLUMN IF NOT EXISTS `paidAt` DATETIME(3) NULL AFTER `paymentMethod`,
  ADD COLUMN IF NOT EXISTS `cancelledAt` DATETIME(3) NULL AFTER `paidAt`,
  ADD COLUMN IF NOT EXISTS `refundedAt` DATETIME(3) NULL AFTER `cancelledAt`;

-- Índices para Order
CREATE INDEX IF NOT EXISTS `Order_orderNumber_idx` ON `Order` (`orderNumber`);
CREATE INDEX IF NOT EXISTS `Order_buyerEmail_idx` ON `Order` (`buyerEmail`);
CREATE INDEX IF NOT EXISTS `Order_status_idx` ON `Order` (`status`);

-- ============================================
-- 2. AGREGAR COLUMNAS FALTANTES EN Ticket
-- ============================================

ALTER TABLE `Ticket`
  ADD COLUMN IF NOT EXISTS `ticketCode` VARCHAR(20) UNIQUE AFTER `orderId`,
  ADD COLUMN IF NOT EXISTS `holderName` VARCHAR(191) NULL AFTER `ticketCode`,
  ADD COLUMN IF NOT EXISTS `holderEmail` VARCHAR(191) NULL AFTER `holderName`,
  ADD COLUMN IF NOT EXISTS `checkedInAt` DATETIME(3) NULL AFTER `holderEmail`,
  ADD COLUMN IF NOT EXISTS `checkedInBy` VARCHAR(191) NULL AFTER `checkedInAt`;

-- Índices para Ticket
CREATE INDEX IF NOT EXISTS `Ticket_ticketCode_idx` ON `Ticket` (`ticketCode`);
CREATE INDEX IF NOT EXISTS `Ticket_holderEmail_idx` ON `Ticket` (`holderEmail`);
CREATE INDEX IF NOT EXISTS `Ticket_orderId_idx` ON `Ticket` (`orderId`);

-- ============================================
-- 3. AGREGAR COLUMNAS FALTANTES EN Event
-- ============================================

ALTER TABLE `Event`
  ADD COLUMN IF NOT EXISTS `categoryId` VARCHAR(191) NULL AFTER `venueId`,
  ADD COLUMN IF NOT EXISTS `shortDescription` VARCHAR(255) NULL AFTER `description`,
  ADD COLUMN IF NOT EXISTS `coverImage` VARCHAR(500) NULL AFTER `shortDescription`,
  ADD COLUMN IF NOT EXISTS `thumbnailImage` VARCHAR(500) NULL AFTER `coverImage`,
  ADD COLUMN IF NOT EXISTS `galleryImages` JSON NULL AFTER `thumbnailImage`,
  ADD COLUMN IF NOT EXISTS `videoUrl` VARCHAR(500) NULL AFTER `galleryImages`,
  ADD COLUMN IF NOT EXISTS `organizer` VARCHAR(191) NULL AFTER `videoUrl`,
  ADD COLUMN IF NOT EXISTS `organizerLogo` VARCHAR(500) NULL AFTER `organizer`,
  ADD COLUMN IF NOT EXISTS `artistName` VARCHAR(191) NULL AFTER `organizerLogo`,
  ADD COLUMN IF NOT EXISTS `ageRestriction` VARCHAR(50) NULL AFTER `artistName`,
  ADD COLUMN IF NOT EXISTS `doorTime` VARCHAR(100) NULL AFTER `ageRestriction`,
  ADD COLUMN IF NOT EXISTS `duration` VARCHAR(100) NULL AFTER `doorTime`,
  ADD COLUMN IF NOT EXISTS `policies` JSON NULL AFTER `duration`,
  ADD COLUMN IF NOT EXISTS `terms` TEXT NULL AFTER `policies`,
  ADD COLUMN IF NOT EXISTS `refundPolicy` TEXT NULL AFTER `terms`,
  ADD COLUMN IF NOT EXISTS `socialLinks` JSON NULL AFTER `refundPolicy`,
  ADD COLUMN IF NOT EXISTS `hashtag` VARCHAR(100) NULL AFTER `socialLinks`,
  ADD COLUMN IF NOT EXISTS `isFeatured` TINYINT(1) DEFAULT 0 AFTER `hashtag`,
  ADD COLUMN IF NOT EXISTS `publishedAt` DATETIME(3) NULL AFTER `isFeatured`,
  ADD COLUMN IF NOT EXISTS `salesStartAt` DATETIME(3) NULL AFTER `publishedAt`,
  ADD COLUMN IF NOT EXISTS `salesEndAt` DATETIME(3) NULL AFTER `salesStartAt`,
  ADD COLUMN IF NOT EXISTS `eventType` VARCHAR(20) DEFAULT 'seated' AFTER `salesEndAt`,
  ADD COLUMN IF NOT EXISTS `serviceFeeType` VARCHAR(20) NULL AFTER `eventType`,
  ADD COLUMN IF NOT EXISTS `serviceFeeValue` DECIMAL(10,2) NULL AFTER `serviceFeeType`,
  ADD COLUMN IF NOT EXISTS `showRemainingTickets` TINYINT(1) DEFAULT 0 AFTER `serviceFeeValue`;

-- ============================================
-- 4. CREAR TABLA Category SI NO EXISTE
-- ============================================

CREATE TABLE IF NOT EXISTS `Category` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `icon` VARCHAR(50) NULL,
  `color` VARCHAR(20) NULL,
  `coverImage` VARCHAR(500) NULL,
  `sortOrder` INT DEFAULT 0,
  `isActive` TINYINT(1) DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `Category_name_key` (`name`),
  UNIQUE INDEX `Category_slug_key` (`slug`),
  INDEX `Category_isActive_sortOrder_idx` (`isActive`, `sortOrder`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- FK de Event a Category
ALTER TABLE `Event`
  ADD CONSTRAINT `Event_categoryId_fkey`
  FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- 5. CREAR TABLA VenueTable SI NO EXISTE
-- ============================================

CREATE TABLE IF NOT EXISTS `VenueTable` (
  `id` VARCHAR(191) NOT NULL,
  `venueId` VARCHAR(191) NOT NULL,
  `layoutId` VARCHAR(191) NULL,
  `zoneId` VARCHAR(191) NULL,
  `name` VARCHAR(191) NOT NULL,
  `shape` ENUM('circle', 'rectangle', 'oval', 'square') DEFAULT 'circle',
  `centerX` DECIMAL(10,2) NOT NULL,
  `centerY` DECIMAL(10,2) NOT NULL,
  `width` DECIMAL(10,2) NULL,
  `height` DECIMAL(10,2) NULL,
  `radius` DECIMAL(10,2) NULL,
  `rotation` DECIMAL(10,2) DEFAULT 0,
  `seatCount` INT DEFAULT 0,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `VenueTable_venueId_idx` (`venueId`),
  INDEX `VenueTable_layoutId_idx` (`layoutId`),
  CONSTRAINT `VenueTable_venueId_fkey`
    FOREIGN KEY (`venueId`) REFERENCES `Venue`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `VenueTable_layoutId_fkey`
    FOREIGN KEY (`layoutId`) REFERENCES `VenueLayout`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `VenueTable_zoneId_fkey`
    FOREIGN KEY (`zoneId`) REFERENCES `VenueZone`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Agregar tableId a Seat si no existe
ALTER TABLE `Seat`
  ADD COLUMN IF NOT EXISTS `tableId` VARCHAR(191) NULL AFTER `zoneId`,
  ADD COLUMN IF NOT EXISTS `layoutId` VARCHAR(191) NULL AFTER `venueId`,
  ADD COLUMN IF NOT EXISTS `seatType` ENUM('STANDARD', 'VIP', 'ACCESSIBLE', 'COMPANION') NULL AFTER `columnNumber`,
  ADD COLUMN IF NOT EXISTS `basePrice` DECIMAL(10,2) NULL AFTER `seatType`;

-- ============================================
-- 6. CREAR TABLA Coupon SI NO EXISTE
-- ============================================

CREATE TABLE IF NOT EXISTS `Coupon` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `discountType` ENUM('PERCENTAGE', 'FIXED') NOT NULL DEFAULT 'PERCENTAGE',
  `discountValue` DECIMAL(10,2) NOT NULL,
  `minPurchase` DECIMAL(10,2) NULL,
  `maxDiscount` DECIMAL(10,2) NULL,
  `usageLimit` INT NULL,
  `usedCount` INT DEFAULT 0,
  `userLimit` INT DEFAULT 1,
  `eventId` VARCHAR(191) NULL,
  `validFrom` DATETIME(3) NULL,
  `validUntil` DATETIME(3) NULL,
  `isActive` TINYINT(1) DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `Coupon_code_key` (`code`),
  INDEX `Coupon_eventId_idx` (`eventId`),
  INDEX `Coupon_isActive_validUntil_idx` (`isActive`, `validUntil`),
  CONSTRAINT `Coupon_eventId_fkey`
    FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================
-- 7. CREAR TABLA CouponUsage SI NO EXISTE
-- ============================================

CREATE TABLE IF NOT EXISTS `CouponUsage` (
  `id` VARCHAR(191) NOT NULL,
  `couponId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NULL,
  `discountApplied` DECIMAL(10,2) NOT NULL,
  `usedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `CouponUsage_couponId_idx` (`couponId`),
  INDEX `CouponUsage_userId_idx` (`userId`),
  CONSTRAINT `CouponUsage_couponId_fkey`
    FOREIGN KEY (`couponId`) REFERENCES `Coupon`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CouponUsage_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CouponUsage_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================
-- 8. AGREGAR COLUMNAS A VenueLayout
-- ============================================

ALTER TABLE `VenueLayout`
  ADD COLUMN IF NOT EXISTS `eventId` VARCHAR(191) NULL AFTER `venueId`,
  ADD COLUMN IF NOT EXISTS `isTemplate` TINYINT(1) DEFAULT 0 AFTER `isDefault`,
  ADD COLUMN IF NOT EXISTS `layoutType` VARCHAR(20) DEFAULT 'flat' AFTER `isTemplate`,
  ADD COLUMN IF NOT EXISTS `parentLayoutId` VARCHAR(191) NULL AFTER `layoutType`,
  ADD COLUMN IF NOT EXISTS `sectionId` VARCHAR(191) NULL AFTER `parentLayoutId`,
  ADD COLUMN IF NOT EXISTS `createdBy` VARCHAR(191) NULL AFTER `sectionId`;

-- Índice único para eventId (1 layout por evento)
CREATE UNIQUE INDEX IF NOT EXISTS `VenueLayout_eventId_key` ON `VenueLayout` (`eventId`);

-- ============================================
-- 9. CREAR TABLA LayoutSection SI NO EXISTE
-- ============================================

CREATE TABLE IF NOT EXISTS `LayoutSection` (
  `id` VARCHAR(191) NOT NULL,
  `parentLayoutId` VARCHAR(191) NOT NULL,
  `zoneId` VARCHAR(191) NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `color` VARCHAR(20) DEFAULT '#3B82F6',
  `polygonPoints` JSON NOT NULL,
  `labelPosition` JSON NULL,
  `capacity` INT DEFAULT 0,
  `displayOrder` INT DEFAULT 0,
  `isActive` TINYINT(1) DEFAULT 1,
  `hoverColor` VARCHAR(20) DEFAULT '#60A5FA',
  `selectedColor` VARCHAR(20) DEFAULT '#2563EB',
  `thumbnailUrl` VARCHAR(500) NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `LayoutSection_parentLayoutId_idx` (`parentLayoutId`),
  INDEX `LayoutSection_zoneId_idx` (`zoneId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================
-- 10. AGREGAR COLUMNAS A EventPriceTier
-- ============================================

ALTER TABLE `EventPriceTier`
  ADD COLUMN IF NOT EXISTS `sectionId` VARCHAR(191) NULL AFTER `zoneId`;

CREATE INDEX IF NOT EXISTS `EventPriceTier_sectionId_idx` ON `EventPriceTier` (`sectionId`);

-- ============================================
-- 11. AGREGAR columna capacity a VenueZone
-- ============================================

ALTER TABLE `VenueZone`
  ADD COLUMN IF NOT EXISTS `capacity` INT NULL AFTER `basePrice`;

-- ============================================
-- 12. CREAR TABLA VenueProduct SI NO EXISTE
-- ============================================

CREATE TABLE IF NOT EXISTS `VenueProduct` (
  `id` VARCHAR(191) NOT NULL,
  `venueId` VARCHAR(191) NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  `currency` VARCHAR(10) DEFAULT 'MXN',
  `stock` INT NULL,
  `isActive` TINYINT(1) DEFAULT 1,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `VenueProduct_venueId_type_idx` (`venueId`, `type`),
  INDEX `VenueProduct_venueId_isActive_idx` (`venueId`, `isActive`),
  CONSTRAINT `VenueProduct_venueId_fkey`
    FOREIGN KEY (`venueId`) REFERENCES `Venue`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================
-- 13. CREAR TABLA VenueAlert SI NO EXISTE
-- ============================================

CREATE TABLE IF NOT EXISTS `VenueAlert` (
  `id` VARCHAR(191) NOT NULL,
  `venueId` VARCHAR(191) NOT NULL,
  `zoneId` VARCHAR(191) NULL,
  `condition` VARCHAR(50) NOT NULL,
  `threshold` DECIMAL(10,2) NOT NULL,
  `notifyEmails` TEXT NOT NULL,
  `isActive` TINYINT(1) DEFAULT 1,
  `lastTriggered` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `VenueAlert_venueId_isActive_idx` (`venueId`, `isActive`),
  CONSTRAINT `VenueAlert_venueId_fkey`
    FOREIGN KEY (`venueId`) REFERENCES `Venue`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================
-- FIN DE MIGRACIÓN
-- ============================================

SELECT 'Migración 001 completada exitosamente' AS status;
