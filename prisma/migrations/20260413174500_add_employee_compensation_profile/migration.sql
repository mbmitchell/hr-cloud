CREATE TABLE `EmployeeCompensationProfile` (
  `id` VARCHAR(191) NOT NULL,
  `employeeId` VARCHAR(191) NOT NULL,
  `payType` VARCHAR(191) NOT NULL,
  `annualSalary` DECIMAL(12,2) NULL,
  `hourlyRate` DECIMAL(10,2) NULL,
  `standardHours` DECIMAL(5,2) NOT NULL,
  `payrollFrequency` ENUM('BIWEEKLY', 'SEMI_MONTHLY', 'MONTHLY') NOT NULL DEFAULT 'BIWEEKLY',
  `effectiveDate` DATETIME(3) NOT NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `EmployeeCompensationProfile_employeeId_key`(`employeeId`),
  INDEX `EmployeeCompensationProfile_employeeId_effectiveDate_idx`(`employeeId`, `effectiveDate`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `EmployeeCompensationProfile`
  ADD CONSTRAINT `EmployeeCompensationProfile_employeeId_fkey`
  FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
