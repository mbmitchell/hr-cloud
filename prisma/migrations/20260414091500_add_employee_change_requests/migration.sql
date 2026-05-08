ALTER TABLE `Employee`
  ADD COLUMN `employmentClassification` VARCHAR(191) NULL,
  ADD COLUMN `workLocation` VARCHAR(191) NULL;

CREATE TABLE `EmployeeChangeRequest` (
  `id` VARCHAR(191) NOT NULL,
  `employeeId` VARCHAR(191) NOT NULL,
  `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'APPLIED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `changeType` ENUM('COMPENSATION', 'JOB_INFO', 'MANAGER', 'STATUS', 'LOCATION', 'CLASSIFICATION', 'OTHER') NOT NULL,
  `requestedByEmployeeId` VARCHAR(191) NOT NULL,
  `reviewedByEmployeeId` VARCHAR(191) NULL,
  `submittedAt` DATETIME(3) NULL,
  `approvedAt` DATETIME(3) NULL,
  `appliedAt` DATETIME(3) NULL,
  `cancelledAt` DATETIME(3) NULL,
  `requestedEffectiveDate` DATETIME(3) NOT NULL,
  `actualEffectiveDate` DATETIME(3) NULL,
  `reason` TEXT NULL,
  `notes` TEXT NULL,
  `relatedDocumentId` VARCHAR(191) NULL,
  `oldValues` JSON NOT NULL,
  `newValues` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `EmployeeChangeRequest_employeeId_status_requestedEffectiveDate_idx`(`employeeId`, `status`, `requestedEffectiveDate`),
  INDEX `EmployeeChangeRequest_requestedByEmployeeId_idx`(`requestedByEmployeeId`),
  INDEX `EmployeeChangeRequest_reviewedByEmployeeId_idx`(`reviewedByEmployeeId`),
  INDEX `EmployeeChangeRequest_relatedDocumentId_idx`(`relatedDocumentId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `EmployeeChangeRequest`
  ADD CONSTRAINT `EmployeeChangeRequest_employeeId_fkey`
  FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `EmployeeChangeRequest_requestedByEmployeeId_fkey`
  FOREIGN KEY (`requestedByEmployeeId`) REFERENCES `Employee`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `EmployeeChangeRequest_reviewedByEmployeeId_fkey`
  FOREIGN KEY (`reviewedByEmployeeId`) REFERENCES `Employee`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `EmployeeChangeRequest_relatedDocumentId_fkey`
  FOREIGN KEY (`relatedDocumentId`) REFERENCES `EmployeeDocument`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
