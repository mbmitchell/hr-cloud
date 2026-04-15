CREATE TABLE `EmployeeCompensationHistory` (
  `id` VARCHAR(191) NOT NULL,
  `employeeId` VARCHAR(191) NOT NULL,
  `payType` VARCHAR(191) NOT NULL,
  `annualSalary` DECIMAL(12, 2) NULL,
  `hourlyRate` DECIMAL(10, 2) NULL,
  `standardHours` DECIMAL(5, 2) NOT NULL,
  `payrollFrequency` ENUM('BIWEEKLY', 'SEMI_MONTHLY', 'MONTHLY') NOT NULL DEFAULT 'BIWEEKLY',
  `effectiveDate` DATETIME(3) NOT NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `EmployeeCompensationHistory_employeeId_effectiveDate_createdAt_idx`(`employeeId`, `effectiveDate`, `createdAt`),
  INDEX `EmployeeCompensationHistory_effectiveDate_idx`(`effectiveDate`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `EmployeeCompensationHistory`
  ADD CONSTRAINT `EmployeeCompensationHistory_employeeId_fkey`
  FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO `EmployeeCompensationHistory` (
  `id`,
  `employeeId`,
  `payType`,
  `annualSalary`,
  `hourlyRate`,
  `standardHours`,
  `payrollFrequency`,
  `effectiveDate`,
  `notes`,
  `createdAt`
)
SELECT
  UUID(),
  `employeeId`,
  `payType`,
  `annualSalary`,
  `hourlyRate`,
  `standardHours`,
  `payrollFrequency`,
  `effectiveDate`,
  `notes`,
  `createdAt`
FROM `EmployeeCompensationProfile`;
