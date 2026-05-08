-- CreateTable
CREATE TABLE `OnboardingTemplateTaskDocumentRequirement` (
    `id` VARCHAR(191) NOT NULL,
    `templateTaskId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `documentCategory` VARCHAR(191) NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OnboardingTemplateTaskDocumentRequirement_templateTaskId_sor_idx`(`templateTaskId`, `sortOrder`),
    INDEX `OnboardingTemplateTaskDocumentRequirement_documentCategory_idx`(`documentCategory`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeOnboardingTaskDocumentRequirement` (
    `id` VARCHAR(191) NOT NULL,
    `employeeOnboardingTaskId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `documentCategory` VARCHAR(191) NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `linkedEmployeeDocumentId` VARCHAR(191) NULL,
    `linkedAt` DATETIME(3) NULL,
    `linkedByEmployeeId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EmployeeOnboardingTaskDocumentRequirement_employeeOnboarding_idx`(`employeeOnboardingTaskId`),
    INDEX `EmployeeOnboardingTaskDocumentRequirement_documentCategory_idx`(`documentCategory`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `OnboardingTemplateTaskDocumentRequirement` ADD CONSTRAINT `OnboardingTemplateTaskDocumentRequirement_templateTaskId_fkey` FOREIGN KEY (`templateTaskId`) REFERENCES `OnboardingTemplateTask`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeOnboardingTaskDocumentRequirement` ADD CONSTRAINT `EmployeeOnboardingTaskDocumentRequirement_employeeOnboardin_fkey` FOREIGN KEY (`employeeOnboardingTaskId`) REFERENCES `EmployeeOnboardingTask`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeOnboardingTaskDocumentRequirement` ADD CONSTRAINT `EmployeeOnboardingTaskDocumentRequirement_linkedEmployeeDoc_fkey` FOREIGN KEY (`linkedEmployeeDocumentId`) REFERENCES `EmployeeDocument`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeOnboardingTaskDocumentRequirement` ADD CONSTRAINT `EmployeeOnboardingTaskDocumentRequirement_linkedByEmployeeI_fkey` FOREIGN KEY (`linkedByEmployeeId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
