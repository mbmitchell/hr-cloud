-- AlterTable
ALTER TABLE `PTORequest`
    ADD COLUMN `graphCalendarEventId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `PTORequest_graphCalendarEventId_key`
    ON `PTORequest`(`graphCalendarEventId`);
