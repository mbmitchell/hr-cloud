-- CreateTable
CREATE TABLE `AssignableDocument` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `currentVersionId` VARCHAR(191) NULL,
    `createdByEmployeeId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AssignableDocument_createdByEmployeeId_idx`(`createdByEmployeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AssignableDocumentVersion` (
    `id` VARCHAR(191) NOT NULL,
    `assignableDocumentId` VARCHAR(191) NOT NULL,
    `versionLabel` VARCHAR(191) NOT NULL,
    `employeeDocumentId` VARCHAR(191) NOT NULL,
    `notes` TEXT NULL,
    `publishedAt` DATETIME(3) NOT NULL,
    `createdByEmployeeId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AssignableDocumentVersion_assignableDocumentId_idx`(`assignableDocumentId`),
    INDEX `AssignableDocumentVersion_employeeDocumentId_idx`(`employeeDocumentId`),
    INDEX `AssignableDocumentVersion_createdByEmployeeId_idx`(`createdByEmployeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeDocumentAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `assignableDocumentId` VARCHAR(191) NOT NULL,
    `assignableDocumentVersionId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `assignedByEmployeeId` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dueDate` DATETIME(3) NULL,
    `acknowledgedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EmployeeDocumentAssignment_employeeId_assignableDocumentVe_key`(`employeeId`, `assignableDocumentVersionId`),
    INDEX `EmployeeDocumentAssignment_employeeId_status_idx`(`employeeId`, `status`),
    INDEX `EmployeeDocumentAssignment_assignableDocumentId_idx`(`assignableDocumentId`),
    INDEX `EmployeeDocumentAssignment_assignableDocumentVersionId_idx`(`assignableDocumentVersionId`),
    INDEX `EmployeeDocumentAssignment_dueDate_idx`(`dueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AssignableDocument` ADD CONSTRAINT `AssignableDocument_createdByEmployeeId_fkey` FOREIGN KEY (`createdByEmployeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssignableDocument` ADD CONSTRAINT `AssignableDocument_currentVersionId_fkey` FOREIGN KEY (`currentVersionId`) REFERENCES `AssignableDocumentVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssignableDocumentVersion` ADD CONSTRAINT `AssignableDocumentVersion_assignableDocumentId_fkey` FOREIGN KEY (`assignableDocumentId`) REFERENCES `AssignableDocument`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssignableDocumentVersion` ADD CONSTRAINT `AssignableDocumentVersion_employeeDocumentId_fkey` FOREIGN KEY (`employeeDocumentId`) REFERENCES `EmployeeDocument`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssignableDocumentVersion` ADD CONSTRAINT `AssignableDocumentVersion_createdByEmployeeId_fkey` FOREIGN KEY (`createdByEmployeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeDocumentAssignment` ADD CONSTRAINT `EmployeeDocumentAssignment_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeDocumentAssignment` ADD CONSTRAINT `EmployeeDocumentAssignment_assignableDocumentId_fkey` FOREIGN KEY (`assignableDocumentId`) REFERENCES `AssignableDocument`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeDocumentAssignment` ADD CONSTRAINT `EmployeeDocumentAssignment_assignableDocumentVersionId_fkey` FOREIGN KEY (`assignableDocumentVersionId`) REFERENCES `AssignableDocumentVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeDocumentAssignment` ADD CONSTRAINT `EmployeeDocumentAssignment_assignedByEmployeeId_fkey` FOREIGN KEY (`assignedByEmployeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
