-- Migration: Event-specific layouts
-- Each event gets its own copy of the venue layout with independent seats

-- 1. Add new columns to VenueLayout
ALTER TABLE `VenueLayout` ADD COLUMN `eventId` VARCHAR(191) NULL AFTER `venueId`;
ALTER TABLE `VenueLayout` ADD COLUMN `isTemplate` BOOLEAN NOT NULL DEFAULT false AFTER `isDefault`;

-- Create unique constraint on eventId (one layout per event)
ALTER TABLE `VenueLayout` ADD UNIQUE INDEX `VenueLayout_eventId_key`(`eventId`);

-- Create index for template lookups
CREATE INDEX `VenueLayout_venueId_isTemplate_idx` ON `VenueLayout`(`venueId`, `isTemplate`);

-- 2. Add layoutId to Seat table
ALTER TABLE `Seat` ADD COLUMN `layoutId` VARCHAR(191) NULL AFTER `venueId`;

-- Create index for layout seats
CREATE INDEX `Seat_layoutId_idx` ON `Seat`(`layoutId`);

-- Drop old unique constraint on (venueId, label)
ALTER TABLE `Seat` DROP INDEX `Seat_venueId_label_key`;

-- Create new unique constraint on (layoutId, label) - seats unique per layout
CREATE UNIQUE INDEX `Seat_layoutId_label_key` ON `Seat`(`layoutId`, `label`);

-- 3. Create LayoutZone table for event-specific zones
CREATE TABLE `LayoutZone` (
    `id` VARCHAR(191) NOT NULL,
    `layoutId` VARCHAR(191) NOT NULL,
    `sourceZoneId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NULL,
    `basePrice` DECIMAL(10, 2) NULL,
    `capacity` INT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LayoutZone_layoutId_idx`(`layoutId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 4. Add foreign key constraints
ALTER TABLE `VenueLayout` ADD CONSTRAINT `VenueLayout_eventId_fkey` 
    FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Seat` ADD CONSTRAINT `Seat_layoutId_fkey` 
    FOREIGN KEY (`layoutId`) REFERENCES `VenueLayout`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `LayoutZone` ADD CONSTRAINT `LayoutZone_layoutId_fkey` 
    FOREIGN KEY (`layoutId`) REFERENCES `VenueLayout`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Mark existing layouts as templates (they were venue-level)
UPDATE `VenueLayout` SET `isTemplate` = true WHERE `eventId` IS NULL;

-- 6. Migrate existing seats to have layoutId (link to default layout)
-- This associates existing seats with the default template layout
UPDATE `Seat` s
JOIN `VenueLayout` vl ON vl.venueId = s.venueId AND vl.isDefault = true
SET s.layoutId = vl.id
WHERE s.layoutId IS NULL;
