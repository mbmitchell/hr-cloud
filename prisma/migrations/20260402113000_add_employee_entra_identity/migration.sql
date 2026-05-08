-- AlterTable
ALTER TABLE `Employee`
    ADD COLUMN `entraOid` VARCHAR(191) NULL,
    ADD COLUMN `entraTid` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Employee_entraTid_entraOid_key`
    ON `Employee`(`entraTid`, `entraOid`);
