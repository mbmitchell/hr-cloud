CREATE TABLE `HrNotificationOutbox` (
  `id` VARCHAR(191) NOT NULL,
  `eventType` VARCHAR(191) NOT NULL,
  `relatedEntityType` VARCHAR(191) NOT NULL,
  `relatedEntityId` VARCHAR(191) NOT NULL,
  `employeeId` VARCHAR(191) NULL,
  `recipientEmployeeId` VARCHAR(191) NULL,
  `recipientEmail` VARCHAR(191) NOT NULL,
  `templateKey` ENUM(
    'GENERIC_HR_NOTIFICATION',
    'EMPLOYEE_CHANGE_REQUEST_CREATED',
    'EMPLOYEE_CHANGE_REQUEST_APPROVED',
    'EMPLOYEE_CHANGE_REQUEST_APPLIED'
  ) NOT NULL,
  `payload` JSON NOT NULL,
  `status` ENUM('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `attemptCount` INT NOT NULL DEFAULT 0,
  `lastAttemptAt` DATETIME(3) NULL,
  `sentAt` DATETIME(3) NULL,
  `lastError` TEXT NULL,
  `createdByEmployeeId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `HrNotificationOutbox_status_createdAt_idx`(`status`, `createdAt`),
  INDEX `HrNotificationOutbox_eventType_status_idx`(`eventType`, `status`),
  INDEX `HrNotificationOutbox_relatedEntityType_relatedEntityId_idx`(`relatedEntityType`, `relatedEntityId`),
  INDEX `HrNotificationOutbox_employeeId_idx`(`employeeId`),
  INDEX `HrNotificationOutbox_recipientEmployeeId_idx`(`recipientEmployeeId`),
  INDEX `HrNotificationOutbox_createdByEmployeeId_idx`(`createdByEmployeeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `HrNotificationOutbox`
  ADD CONSTRAINT `HrNotificationOutbox_employeeId_fkey`
  FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `HrNotificationOutbox_recipientEmployeeId_fkey`
  FOREIGN KEY (`recipientEmployeeId`) REFERENCES `Employee`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `HrNotificationOutbox_createdByEmployeeId_fkey`
  FOREIGN KEY (`createdByEmployeeId`) REFERENCES `Employee`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
