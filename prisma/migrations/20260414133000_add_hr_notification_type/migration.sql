ALTER TABLE `HrNotificationOutbox`
  ADD COLUMN `notificationType` ENUM('USER_INITIATED', 'SYSTEM_GENERATED') NOT NULL DEFAULT 'USER_INITIATED';

CREATE INDEX `HrNotificationOutbox_notificationType_status_createdAt_idx`
  ON `HrNotificationOutbox`(`notificationType`, `status`, `createdAt`);
