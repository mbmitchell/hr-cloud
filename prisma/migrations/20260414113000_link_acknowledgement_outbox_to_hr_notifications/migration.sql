ALTER TABLE `DocumentAssignmentEmailOutbox`
  ADD COLUMN `hrNotificationOutboxId` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `DocumentAssignmentEmailOutbox_hrNotificationOutboxId_key` (`hrNotificationOutboxId`),
  ADD CONSTRAINT `DocumentAssignmentEmailOutbox_hrNotificationOutboxId_fkey`
    FOREIGN KEY (`hrNotificationOutboxId`) REFERENCES `HrNotificationOutbox`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `DocumentAssignmentReminderEmailOutbox`
  ADD COLUMN `hrNotificationOutboxId` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `DocumentAssignmentReminderEmailOutbox_hrNotificationOutboxId_key` (`hrNotificationOutboxId`),
  ADD CONSTRAINT `fk_doc_assign_reminder_hr_notification`
    FOREIGN KEY (`hrNotificationOutboxId`) REFERENCES `HrNotificationOutbox`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
