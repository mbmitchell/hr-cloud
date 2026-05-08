CREATE TABLE `EmployeeStatusHistory` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `previousStatus` VARCHAR(191) NOT NULL,
    `newStatus` VARCHAR(191) NOT NULL,
    `changedByEmployeeId` VARCHAR(191) NOT NULL,
    `changedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EmployeeStatusHistory_employeeId_changedAt_idx`(`employeeId`, `changedAt`),
    INDEX `EmployeeStatusHistory_changedByEmployeeId_idx`(`changedByEmployeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `EmployeeStatusHistory`
ADD CONSTRAINT `EmployeeStatusHistory_employeeId_fkey`
FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`)
ON DELETE RESTRICT ON UPDATE CASCADE;
