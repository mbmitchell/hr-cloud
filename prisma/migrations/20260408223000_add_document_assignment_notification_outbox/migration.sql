-- CreateTable
CREATE TABLE `DocumentAssignmentEmailOutbox` (
    `id` VARCHAR(191) NOT NULL,
    `employeeDocumentAssignmentId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `attemptCount` INTEGER NOT NULL DEFAULT 0,
    `lastError` TEXT NULL,
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DocumentAssignmentEmailOutbox_employeeDocumentAssignmentId_key`(`employeeDocumentAssignmentId`),
    INDEX `DocumentAssignmentEmailOutbox_status_idx`(`status`),
    INDEX `DocumentAssignmentEmailOutbox_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DocumentAssignmentEmailOutbox` ADD CONSTRAINT `DocumentAssignmentEmailOutbox_employeeDocumentAssignmentId_fkey` FOREIGN KEY (`employeeDocumentAssignmentId`) REFERENCES `EmployeeDocumentAssignment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentAssignmentEmailOutbox` ADD CONSTRAINT `DocumentAssignmentEmailOutbox_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
