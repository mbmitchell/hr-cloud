-- CreateTable
CREATE TABLE `CompanyHoliday` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `year` INTEGER NOT NULL,
    `source` ENUM('FEDERAL_SEED', 'MANUAL') NOT NULL,
    `countsAsCompanyHoliday` BOOLEAN NOT NULL DEFAULT true,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `company_holiday_code_key`(`code`),
    UNIQUE INDEX `company_holiday_date_key`(`date`),
    INDEX `company_holiday_year_active_idx`(`year`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
