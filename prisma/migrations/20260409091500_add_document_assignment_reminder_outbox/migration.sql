-- CreateTable
CREATE TABLE `DocumentAssignmentReminderEmailOutbox` (
    `id` VARCHAR(191) NOT NULL,
    `employeeDocumentAssignmentId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `reminderType` VARCHAR(191) NOT NULL,
    `reminderDay` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `attemptCount` INTEGER NOT NULL DEFAULT 0,
    `lastError` TEXT NULL,
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_doc_assign_reminder_day`(`employeeDocumentAssignmentId`, `reminderType`, `reminderDay`),
    INDEX `idx_doc_assign_reminder_status`(`status`),
    INDEX `idx_doc_assign_reminder_created`(`createdAt`),
    INDEX `idx_doc_assign_reminder_day`(`reminderDay`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DocumentAssignmentReminderEmailOutbox` ADD CONSTRAINT `fk_doc_assign_reminder_assignment` FOREIGN KEY (`employeeDocumentAssignmentId`) REFERENCES `EmployeeDocumentAssignment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentAssignmentReminderEmailOutbox` ADD CONSTRAINT `fk_doc_assign_reminder_employee` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
