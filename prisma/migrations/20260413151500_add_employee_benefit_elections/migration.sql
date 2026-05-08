CREATE TABLE `EmployeeBenefitElection` (
  `id` VARCHAR(191) NOT NULL,
  `employeeId` VARCHAR(191) NOT NULL,
  `benefitType` ENUM('MEDICAL', 'DENTAL', 'VISION', 'LIFE', 'OTHER') NOT NULL,
  `planName` VARCHAR(191) NOT NULL,
  `coverageLevel` VARCHAR(191) NULL,
  `electionStatus` ENUM('ENROLLED', 'WAIVED') NOT NULL,
  `effectiveDate` DATETIME(3) NOT NULL,
  `totalMonthlyCost` DECIMAL(10, 2) NOT NULL,
  `companyMonthlyCost` DECIMAL(10, 2) NOT NULL,
  `employeeMonthlyCost` DECIMAL(10, 2) NOT NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `EmployeeBenefitElection_employeeId_benefitType_effectiveDate_idx`(`employeeId`, `benefitType`, `effectiveDate`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `EmployeeBenefitElection`
  ADD CONSTRAINT `EmployeeBenefitElection_employeeId_fkey`
  FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
