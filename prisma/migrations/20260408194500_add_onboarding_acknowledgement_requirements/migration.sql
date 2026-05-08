-- AlterTable
ALTER TABLE `EmployeeDocumentAssignment`
    ADD COLUMN `assignmentSourceType` VARCHAR(191) NOT NULL DEFAULT 'DIRECT',
    ADD COLUMN `sourceEmployeeOnboardingTaskRequirementId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `OnboardingTemplateTaskAcknowledgementRequirement` (
    `id` VARCHAR(191) NOT NULL,
    `templateTaskId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `assignableDocumentId` VARCHAR(191) NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OnboardingTemplateTaskAcknowledgementRequirement_template_idx`(`templateTaskId`, `sortOrder`),
    INDEX `OnboardingTemplateTaskAcknowledgementRequirement_assignabl_idx`(`assignableDocumentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeOnboardingTaskAcknowledgementRequirement` (
    `id` VARCHAR(191) NOT NULL,
    `employeeOnboardingTaskId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `assignableDocumentId` VARCHAR(191) NOT NULL,
    `assignedDocumentVersionId` VARCHAR(191) NULL,
    `employeeDocumentAssignmentId` VARCHAR(191) NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EmployeeOnboardingTaskAcknowledgementRequirement_emplo_idx`(`employeeOnboardingTaskId`),
    INDEX `EmployeeOnboardingTaskAcknowledgementRequirement_assig_idx`(`assignableDocumentId`),
    INDEX `EmployeeOnboardingTaskAcknowledgementRequirement_ass_2_idx`(`assignedDocumentVersionId`),
    INDEX `EmployeeOnboardingTaskAcknowledgementRequirement_empl_2_idx`(`employeeDocumentAssignmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `EmployeeDocumentAssignment_assignmentSourceType_idx` ON `EmployeeDocumentAssignment`(`assignmentSourceType`);

-- CreateIndex
CREATE INDEX `EmployeeDocumentAssignment_sourceEmployeeOnboardingTaskR_idx` ON `EmployeeDocumentAssignment`(`sourceEmployeeOnboardingTaskRequirementId`);

-- AddForeignKey
ALTER TABLE `OnboardingTemplateTaskAcknowledgementRequirement` ADD CONSTRAINT `OnboardingTemplateTaskAcknowledgementRequirement_temp_fkey` FOREIGN KEY (`templateTaskId`) REFERENCES `OnboardingTemplateTask`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OnboardingTemplateTaskAcknowledgementRequirement` ADD CONSTRAINT `OnboardingTemplateTaskAcknowledgementRequirement_assi_fkey` FOREIGN KEY (`assignableDocumentId`) REFERENCES `AssignableDocument`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeOnboardingTaskAcknowledgementRequirement` ADD CONSTRAINT `EmployeeOnboardingTaskAcknowledgementRequirement_empl_fkey` FOREIGN KEY (`employeeOnboardingTaskId`) REFERENCES `EmployeeOnboardingTask`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeOnboardingTaskAcknowledgementRequirement` ADD CONSTRAINT `EmployeeOnboardingTaskAcknowledgementRequirement_assi_fkey` FOREIGN KEY (`assignableDocumentId`) REFERENCES `AssignableDocument`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeOnboardingTaskAcknowledgementRequirement` ADD CONSTRAINT `EmployeeOnboardingTaskAcknowledgementRequirement_ass_2_fkey` FOREIGN KEY (`assignedDocumentVersionId`) REFERENCES `AssignableDocumentVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeOnboardingTaskAcknowledgementRequirement` ADD CONSTRAINT `EmployeeOnboardingTaskAcknowledgementRequirement_empl_2_fkey` FOREIGN KEY (`employeeDocumentAssignmentId`) REFERENCES `EmployeeDocumentAssignment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeDocumentAssignment` ADD CONSTRAINT `EmployeeDocumentAssignment_sourceEmployeeOnboardingTa_fkey` FOREIGN KEY (`sourceEmployeeOnboardingTaskRequirementId`) REFERENCES `EmployeeOnboardingTaskAcknowledgementRequirement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
