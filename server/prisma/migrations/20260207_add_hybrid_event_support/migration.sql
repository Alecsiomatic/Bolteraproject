-- Add admissionType to LayoutSection
ALTER TABLE `LayoutSection` ADD COLUMN `admissionType` VARCHAR(191) NOT NULL DEFAULT 'seated';

-- Add isGeneralAdmission to EventPriceTier
ALTER TABLE `EventPriceTier` ADD COLUMN `isGeneralAdmission` BOOLEAN NOT NULL DEFAULT false;
