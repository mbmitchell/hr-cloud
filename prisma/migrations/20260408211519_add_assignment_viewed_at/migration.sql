-- DropForeignKey
ALTER TABLE `EmployeeDocumentAssignment` DROP FOREIGN KEY `EmployeeDocumentAssignment_sourceEmployeeOnboardingTa_fkey`;

-- DropForeignKey
ALTER TABLE `EmployeeOnboardingTaskAcknowledgementRequirement` DROP FOREIGN KEY `EmployeeOnboardingTaskAcknowledgementRequirement_ass_2_fkey`;

-- DropForeignKey
ALTER TABLE `EmployeeOnboardingTaskAcknowledgementRequirement` DROP FOREIGN KEY `EmployeeOnboardingTaskAcknowledgementRequirement_assi_fkey`;

-- DropForeignKey
ALTER TABLE `EmployeeOnboardingTaskAcknowledgementRequirement` DROP FOREIGN KEY `EmployeeOnboardingTaskAcknowledgementRequirement_empl_2_fkey`;

-- DropForeignKey
ALTER TABLE `EmployeeOnboardingTaskAcknowledgementRequirement` DROP FOREIGN KEY `EmployeeOnboardingTaskAcknowledgementRequirement_empl_fkey`;

-- DropForeignKey
ALTER TABLE `OnboardingTemplateTaskAcknowledgementRequirement` DROP FOREIGN KEY `OnboardingTemplateTaskAcknowledgementRequirement_assi_fkey`;

-- DropForeignKey
ALTER TABLE `OnboardingTemplateTaskAcknowledgementRequirement` DROP FOREIGN KEY `OnboardingTemplateTaskAcknowledgementRequirement_temp_fkey`;

-- AddForeignKey
ALTER TABLE `EmployeeDocumentAssignment` ADD CONSTRAINT `EmployeeDocumentAssignment_sourceEmployeeOnboardingTaskRequ_fkey` FOREIGN KEY (`sourceEmployeeOnboardingTaskRequirementId`) REFERENCES `EmployeeOnboardingTaskAcknowledgementRequirement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OnboardingTemplateTaskAcknowledgementRequirement` ADD CONSTRAINT `OnboardingTemplateTaskAcknowledgementRequirement_templateTa_fkey` FOREIGN KEY (`templateTaskId`) REFERENCES `OnboardingTemplateTask`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OnboardingTemplateTaskAcknowledgementRequirement` ADD CONSTRAINT `OnboardingTemplateTaskAcknowledgementRequirement_assignable_fkey` FOREIGN KEY (`assignableDocumentId`) REFERENCES `AssignableDocument`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeOnboardingTaskAcknowledgementRequirement` ADD CONSTRAINT `EmployeeOnboardingTaskAcknowledgementRequirement_employeeOn_fkey` FOREIGN KEY (`employeeOnboardingTaskId`) REFERENCES `EmployeeOnboardingTask`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeOnboardingTaskAcknowledgementRequirement` ADD CONSTRAINT `EmployeeOnboardingTaskAcknowledgementRequirement_assignable_fkey` FOREIGN KEY (`assignableDocumentId`) REFERENCES `AssignableDocument`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeOnboardingTaskAcknowledgementRequirement` ADD CONSTRAINT `EmployeeOnboardingTaskAcknowledgementRequirement_assignedDo_fkey` FOREIGN KEY (`assignedDocumentVersionId`) REFERENCES `AssignableDocumentVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeOnboardingTaskAcknowledgementRequirement` ADD CONSTRAINT `EmployeeOnboardingTaskAcknowledgementRequirement_employeeDo_fkey` FOREIGN KEY (`employeeDocumentAssignmentId`) REFERENCES `EmployeeDocumentAssignment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `EmployeeDocumentAssignment` RENAME INDEX `EmployeeDocumentAssignment_sourceEmployeeOnboardingTaskR_idx` TO `EmployeeDocumentAssignment_sourceEmployeeOnboardingTaskRequi_idx`;

-- RenameIndex
ALTER TABLE `EmployeeOnboardingTaskAcknowledgementRequirement` RENAME INDEX `EmployeeOnboardingTaskAcknowledgementRequirement_ass_2_idx` TO `EmployeeOnboardingTaskAcknowledgementRequirement_assignedDoc_idx`;

-- RenameIndex
ALTER TABLE `EmployeeOnboardingTaskAcknowledgementRequirement` RENAME INDEX `EmployeeOnboardingTaskAcknowledgementRequirement_assig_idx` TO `EmployeeOnboardingTaskAcknowledgementRequirement_assignableD_idx`;

-- RenameIndex
ALTER TABLE `EmployeeOnboardingTaskAcknowledgementRequirement` RENAME INDEX `EmployeeOnboardingTaskAcknowledgementRequirement_empl_2_idx` TO `EmployeeOnboardingTaskAcknowledgementRequirement_employeeDoc_idx`;

-- RenameIndex
ALTER TABLE `EmployeeOnboardingTaskAcknowledgementRequirement` RENAME INDEX `EmployeeOnboardingTaskAcknowledgementRequirement_emplo_idx` TO `EmployeeOnboardingTaskAcknowledgementRequirement_employeeOnb_idx`;

-- RenameIndex
ALTER TABLE `OnboardingTemplateTaskAcknowledgementRequirement` RENAME INDEX `OnboardingTemplateTaskAcknowledgementRequirement_assignabl_idx` TO `OnboardingTemplateTaskAcknowledgementRequirement_assignableD_idx`;

-- RenameIndex
ALTER TABLE `OnboardingTemplateTaskAcknowledgementRequirement` RENAME INDEX `OnboardingTemplateTaskAcknowledgementRequirement_template_idx` TO `OnboardingTemplateTaskAcknowledgementRequirement_templateTas_idx`;
