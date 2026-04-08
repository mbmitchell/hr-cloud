-- AlterTable
ALTER TABLE `EmployeeDocumentAssignment`
    ADD COLUMN `viewedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `EmployeeDocumentAssignment_viewedAt_idx`
    ON `EmployeeDocumentAssignment`(`viewedAt`);
