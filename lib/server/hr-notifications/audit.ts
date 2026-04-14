import { prisma } from "../../db";
import { writeAuditLog } from "../audit/write-audit-log";

export async function auditNotificationAction(input: {
  actorId: string;
  action: string;
  notificationId: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}) {
  await writeAuditLog(prisma, {
    userId: input.actorId,
    action: input.action,
    entityType: "HrNotificationOutbox",
    entityId: input.notificationId,
    oldValue: input.oldValue ?? null,
    newValue: input.newValue ?? null,
  });
}

export async function auditNotificationSuppressed(input: {
  actorId: string;
  eventType: string;
  relatedEntityType: string;
  relatedEntityId: string;
  recipientScope: string;
  reason?: string | null;
}) {
  await writeAuditLog(prisma, {
    userId: input.actorId,
    action: "HR_NOTIFICATION_SUPPRESSED",
    entityType: input.relatedEntityType,
    entityId: input.relatedEntityId,
    newValue: {
      eventType: input.eventType,
      recipientScope: input.recipientScope,
      reason: input.reason?.trim() || null,
    },
  });
}

export async function auditReminderGenerated(input: {
  actorId: string;
  notificationId: string;
  eventType: string;
  relatedEntityType: string;
  relatedEntityId: string;
}) {
  await writeAuditLog(prisma, {
    userId: input.actorId,
    action: "HR_NOTIFICATION_REMINDER_GENERATED",
    entityType: "HrNotificationOutbox",
    entityId: input.notificationId,
    newValue: {
      eventType: input.eventType,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
    },
  });
}

export async function auditEscalationTriggered(input: {
  actorId: string;
  notificationId: string;
  eventType: string;
  relatedEntityType: string;
  relatedEntityId: string;
}) {
  await writeAuditLog(prisma, {
    userId: input.actorId,
    action: "HR_NOTIFICATION_ESCALATION_TRIGGERED",
    entityType: "HrNotificationOutbox",
    entityId: input.notificationId,
    newValue: {
      eventType: input.eventType,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
    },
  });
}
