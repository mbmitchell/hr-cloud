-- CreateTable
CREATE TABLE `OffboardingTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OffboardingTemplateTask` (
    `id` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `assigneeType` VARCHAR(191) NOT NULL,
    `dueOffsetDays` INTEGER NULL,
    `sortOrder` INTEGER NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OffboardingTemplateTask_templateId_sortOrder_idx`(`templateId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeOffboarding` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL,
    `separationType` VARCHAR(191) NOT NULL,
    `terminationDate` DATETIME(3) NOT NULL,
    `lastWorkingDate` DATETIME(3) NULL,
    `eligibleForRehire` BOOLEAN NULL,
    `notes` TEXT NULL,
    `createdByEmployeeId` VARCHAR(191) NOT NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EmployeeOffboarding_status_idx`(`status`),
    INDEX `EmployeeOffboarding_terminationDate_idx`(`terminationDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeOffboardingTask` (
    `id` VARCHAR(191) NOT NULL,
    `employeeOffboardingId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `assigneeType` VARCHAR(191) NOT NULL,
    `assignedEmployeeId` VARCHAR(191) NULL,
    `dueDate` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL,
    `completedAt` DATETIME(3) NULL,
    `completedByEmployeeId` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL,
    `sourceTemplateTaskId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EmployeeOffboardingTask_employeeOffboardingId_sortOrder_idx`(`employeeOffboardingId`, `sortOrder`),
    INDEX `EmployeeOffboardingTask_assigneeType_status_idx`(`assigneeType`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `OffboardingTemplateTask` ADD CONSTRAINT `OffboardingTemplateTask_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `OffboardingTemplate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeOffboarding` ADD CONSTRAINT `EmployeeOffboarding_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeOffboarding` ADD CONSTRAINT `EmployeeOffboarding_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `OffboardingTemplate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeOffboarding` ADD CONSTRAINT `EmployeeOffboarding_createdByEmployeeId_fkey` FOREIGN KEY (`createdByEmployeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeOffboardingTask` ADD CONSTRAINT `EmployeeOffboardingTask_employeeOffboardingId_fkey` FOREIGN KEY (`employeeOffboardingId`) REFERENCES `EmployeeOffboarding`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeOffboardingTask` ADD CONSTRAINT `EmployeeOffboardingTask_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeOffboardingTask` ADD CONSTRAINT `EmployeeOffboardingTask_assignedEmployeeId_fkey` FOREIGN KEY (`assignedEmployeeId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeOffboardingTask` ADD CONSTRAINT `EmployeeOffboardingTask_completedByEmployeeId_fkey` FOREIGN KEY (`completedByEmployeeId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeOffboardingTask` ADD CONSTRAINT `EmployeeOffboardingTask_sourceTemplateTaskId_fkey` FOREIGN KEY (`sourceTemplateTaskId`) REFERENCES `OffboardingTemplateTask`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
