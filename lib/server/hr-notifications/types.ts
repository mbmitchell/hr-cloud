import type { Prisma } from "@prisma/client";

export type HrNotificationOutboxStatus =
  | "PENDING"
  | "PROCESSING"
  | "SENT"
  | "FAILED"
  | "CANCELLED";

export type HrNotificationType =
  | "USER_INITIATED"
  | "SYSTEM_GENERATED";

export type HrNotificationTemplateKey =
  | "GENERIC_HR_NOTIFICATION"
  | "EMPLOYEE_CHANGE_REQUEST_CREATED"
  | "EMPLOYEE_CHANGE_REQUEST_APPROVED"
  | "EMPLOYEE_CHANGE_REQUEST_APPLIED";

export type HrNotificationPayload = Prisma.JsonObject;

export type HrNotificationOutboxRecord = {
  id: string;
  eventType: string;
  relatedEntityType: string;
  relatedEntityId: string;
  notificationType: HrNotificationType;
  employeeId: string | null;
  recipientEmployeeId: string | null;
  recipientEmail: string;
  templateKey: HrNotificationTemplateKey;
  payload: Prisma.JsonValue;
  status: HrNotificationOutboxStatus;
  attemptCount: number;
  lastAttemptAt: Date | null;
  sentAt: Date | null;
  lastError: string | null;
  createdByEmployeeId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type EnqueueHrNotificationInput = {
  eventType: string;
  relatedEntityType: string;
  relatedEntityId: string;
  notificationType?: HrNotificationType;
  employeeId?: string | null;
  recipientEmployeeId?: string | null;
  recipientEmail: string;
  templateKey: HrNotificationTemplateKey;
  payload: HrNotificationPayload;
  createdByEmployeeId?: string | null;
};

export type PendingHrNotification = HrNotificationOutboxRecord;

export type MarkHrNotificationFailedInput = {
  id: string;
  errorMessage: string;
  nextStatus?: Extract<HrNotificationOutboxStatus, "FAILED" | "CANCELLED">;
};
