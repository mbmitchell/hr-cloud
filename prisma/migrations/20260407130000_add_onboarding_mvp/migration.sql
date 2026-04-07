CREATE TABLE `OnboardingTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OnboardingTemplateTask` (
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

    INDEX `OnboardingTemplateTask_templateId_sortOrder_idx`(`templateId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `EmployeeOnboarding` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NULL,
    `targetCompletionDate` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdByEmployeeId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EmployeeOnboarding_employeeId_key`(`employeeId`),
    INDEX `EmployeeOnboarding_status_idx`(`status`),
    INDEX `EmployeeOnboarding_createdByEmployeeId_idx`(`createdByEmployeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `EmployeeOnboardingTask` (
    `id` VARCHAR(191) NOT NULL,
    `employeeOnboardingId` VARCHAR(191) NOT NULL,
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

    INDEX `EmployeeOnboardingTask_employeeOnboardingId_sortOrder_idx`(`employeeOnboardingId`, `sortOrder`),
    INDEX `EmployeeOnboardingTask_assigneeType_status_idx`(`assigneeType`, `status`),
    INDEX `EmployeeOnboardingTask_assignedEmployeeId_status_idx`(`assignedEmployeeId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `OnboardingTemplateTask`
ADD CONSTRAINT `OnboardingTemplateTask_templateId_fkey`
FOREIGN KEY (`templateId`) REFERENCES `OnboardingTemplate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `EmployeeOnboarding`
ADD CONSTRAINT `EmployeeOnboarding_employeeId_fkey`
FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `EmployeeOnboarding`
ADD CONSTRAINT `EmployeeOnboarding_templateId_fkey`
FOREIGN KEY (`templateId`) REFERENCES `OnboardingTemplate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `EmployeeOnboardingTask`
ADD CONSTRAINT `EmployeeOnboardingTask_employeeOnboardingId_fkey`
FOREIGN KEY (`employeeOnboardingId`) REFERENCES `EmployeeOnboarding`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `EmployeeOnboardingTask`
ADD CONSTRAINT `EmployeeOnboardingTask_employeeId_fkey`
FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `EmployeeOnboardingTask`
ADD CONSTRAINT `EmployeeOnboardingTask_sourceTemplateTaskId_fkey`
FOREIGN KEY (`sourceTemplateTaskId`) REFERENCES `OnboardingTemplateTask`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
