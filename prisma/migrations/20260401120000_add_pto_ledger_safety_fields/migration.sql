-- AlterTable
ALTER TABLE `PTOLedger`
    ADD COLUMN `sourceRequestId` VARCHAR(191) NULL,
    ADD COLUMN `idempotencyKey` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `PTOLedger_sourceRequestId_key` ON `PTOLedger`(`sourceRequestId`);

-- CreateIndex
CREATE UNIQUE INDEX `PTOLedger_idempotencyKey_key` ON `PTOLedger`(`idempotencyKey`);

-- CreateIndex
CREATE INDEX `PTOLedger_employeeId_bucket_effectiveDate_createdAt_idx`
    ON `PTOLedger`(`employeeId`, `bucket`, `effectiveDate`, `createdAt`);
