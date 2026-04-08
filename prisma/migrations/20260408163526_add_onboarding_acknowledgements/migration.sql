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

