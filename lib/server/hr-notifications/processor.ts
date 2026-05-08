import type { Prisma } from "@prisma/client";

import { prisma } from "../../db";
import { logEmailNotificationEvent } from "../../notifications/email/logger";
import { getEmailRuntimeConfig, sendEmail } from "../../notifications/email/send-email";
import { renderHrNotificationTemplate } from "./templates";
import { auditNotificationAction } from "./audit";
import {
  cancelNotification,
  getHrNotificationProcessorConfig,
  getProcessableNotifications,
  markFailed,
  markProcessing,
  markSent,
  resetNotificationToPending,
} from "./service";

function summarizeError(error: unknown) {
  const summary =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : "Unknown HR notification processing error.";

  return summary.slice(0, 1000);
}

function isEscalationEvent(eventType: string) {
  return eventType.includes("ESCALATION");
}

function getPayloadObject(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Notification payload is invalid.");
  }

  return payload as Prisma.JsonObject;
}

async function syncLinkedAcknowledgementOutboxStatus(input: {
  notificationId: string;
  status: "PENDING" | "SENT" | "FAILED" | "CANCELLED";
  errorMessage?: string | null;
  incrementAttempt?: boolean;
}) {
  const notification = await prisma.hrNotificationOutbox.findUnique({
    where: { id: input.notificationId },
    select: {
      documentAssignmentEmailOutbox: {
        select: {
          id: true,
        },
      },
      documentAssignmentReminderOutbox: {
        select: {
          id: true,
        },
      },
    },
  });

  const attemptUpdate =
    input.incrementAttempt === true
      ? {
          attemptCount: {
            increment: 1,
          },
        }
      : {};

  if (notification?.documentAssignmentEmailOutbox) {
    await prisma.documentAssignmentEmailOutbox.update({
      where: { id: notification.documentAssignmentEmailOutbox.id },
      data: {
        status: input.status,
        ...attemptUpdate,
        sentAt: input.status === "SENT" ? new Date() : null,
        lastError:
          input.status === "FAILED" || input.status === "CANCELLED"
            ? input.errorMessage?.trim() || null
            : null,
      },
    });
  }

  if (notification?.documentAssignmentReminderOutbox) {
    await prisma.documentAssignmentReminderEmailOutbox.update({
      where: { id: notification.documentAssignmentReminderOutbox.id },
      data: {
        status: input.status,
        ...attemptUpdate,
        sentAt: input.status === "SENT" ? new Date() : null,
        lastError:
          input.status === "FAILED" || input.status === "CANCELLED"
            ? input.errorMessage?.trim() || null
            : null,
      },
    });
  }
}

async function processOneNotification(
  notification: Awaited<ReturnType<typeof getProcessableNotifications>>[number]
) {
  const wasRetry = notification.status === "FAILED";

  if (wasRetry) {
    await auditNotificationAction({
      actorId: "system:notifications",
      action: "HR_NOTIFICATION_RETRIED",
      notificationId: notification.id,
      oldValue: {
        status: "FAILED",
        attemptCount: notification.attemptCount,
      },
      newValue: {
        status: "PROCESSING",
      },
    });
  }

  await markProcessing(notification.id);
  await auditNotificationAction({
    actorId: "system:notifications",
    action: "HR_NOTIFICATION_SEND_ATTEMPTED",
    notificationId: notification.id,
    oldValue: {
      status: notification.status,
      attemptCount: notification.attemptCount,
    },
    newValue: {
      status: "PROCESSING",
      nextAttemptNumber: notification.attemptCount + 1,
    },
  });

  try {
    const payload = getPayloadObject(notification.payload);
    const rendered = renderHrNotificationTemplate({
      templateKey: notification.templateKey,
      payload,
    });
    const result = await sendEmail({
      to: notification.recipientEmail,
      subject: rendered.subject,
      text: rendered.body,
    });

    if (!result.sent) {
      throw new Error(result.reason);
    }

    await markSent(notification.id);
    await syncLinkedAcknowledgementOutboxStatus({
      notificationId: notification.id,
      status: "SENT",
      incrementAttempt: true,
    });
    await auditNotificationAction({
      actorId: "system:notifications",
      action: "HR_NOTIFICATION_SENT",
      notificationId: notification.id,
      oldValue: {
        status: "PROCESSING",
      },
      newValue: {
        status: "SENT",
        messageId: result.messageId ?? null,
      },
    });
    if (isEscalationEvent(notification.eventType)) {
      await auditNotificationAction({
        actorId: "system:notifications",
        action: "HR_NOTIFICATION_ESCALATION_SENT",
        notificationId: notification.id,
        newValue: {
          eventType: notification.eventType,
          relatedEntityType: notification.relatedEntityType,
          relatedEntityId: notification.relatedEntityId,
        },
      });
    }
    await logEmailNotificationEvent({
      eventType: notification.eventType,
      category: "hr-notification",
      recipient: notification.recipientEmail,
      provider: result.provider,
      relatedEntityType: notification.relatedEntityType,
      relatedEntityId: notification.relatedEntityId,
      relatedEmployeeId: notification.employeeId,
      outcome: "sent",
      messageId: result.messageId ?? null,
    });

    return {
      id: notification.id,
      outcome: "sent" as const,
    };
  } catch (error) {
    const errorSummary = summarizeError(error);
    await markFailed({
      id: notification.id,
      errorMessage: errorSummary,
    });
    await syncLinkedAcknowledgementOutboxStatus({
      notificationId: notification.id,
      status: "FAILED",
      errorMessage: errorSummary,
      incrementAttempt: true,
    });
    await auditNotificationAction({
      actorId: "system:notifications",
      action: "HR_NOTIFICATION_FAILED",
      notificationId: notification.id,
      oldValue: {
        status: "PROCESSING",
      },
      newValue: {
        status: "FAILED",
        errorMessage: errorSummary,
      },
    });
    await logEmailNotificationEvent({
      eventType: notification.eventType,
      category: "hr-notification",
      recipient: notification.recipientEmail,
      provider: getEmailRuntimeConfig().transport,
      relatedEntityType: notification.relatedEntityType,
      relatedEntityId: notification.relatedEntityId,
      relatedEmployeeId: notification.employeeId,
      outcome: "failed",
      errorSummary,
    });

    return {
      id: notification.id,
      outcome: "failed" as const,
      errorMessage: errorSummary,
    };
  }
}

export async function processHrNotifications(input?: {
  limit?: number;
  notificationIds?: string[];
  ignoreMaxAttempts?: boolean;
}) {
  const config = getHrNotificationProcessorConfig();
  const notifications = await getProcessableNotifications({
    limit: input?.limit ?? config.batchSize,
    maxAttempts: config.maxAttempts,
    retryDelayMinutes: config.retryDelayMinutes,
    notificationIds: input?.notificationIds,
    ignoreMaxAttempts: input?.ignoreMaxAttempts,
  });

  const results = [];

  for (const notification of notifications) {
    results.push(await processOneNotification(notification));
  }

  return {
    processed: results.length,
    sent: results.filter((result) => result.outcome === "sent").length,
    failed: results.filter((result) => result.outcome === "failed").length,
    results,
  };
}

export async function cancelHrNotification(input: {
  notificationId: string;
  actorId: string;
  reason?: string | null;
}) {
  const notification = await prisma.hrNotificationOutbox.findUnique({
    where: { id: input.notificationId },
    select: {
      id: true,
      status: true,
      relatedEntityType: true,
      relatedEntityId: true,
    },
  });

  if (!notification) {
    throw new Error("Notification not found.");
  }

  if (notification.status === "SENT" || notification.status === "CANCELLED") {
    throw new Error("Sent or cancelled notifications cannot be cancelled.");
  }

  await cancelNotification(notification.id, input.reason ?? null);
  await syncLinkedAcknowledgementOutboxStatus({
    notificationId: notification.id,
    status: "CANCELLED",
    errorMessage: input.reason ?? null,
  });
  await auditNotificationAction({
    actorId: input.actorId,
    action: "HR_NOTIFICATION_CANCELLED",
    notificationId: notification.id,
    oldValue: {
      status: notification.status,
    },
    newValue: {
      status: "CANCELLED",
      relatedEntityType: notification.relatedEntityType,
      relatedEntityId: notification.relatedEntityId,
      reason: input.reason?.trim() || null,
    },
  });
}

export async function retryHrNotification(input: {
  notificationId: string;
  actorId: string;
}) {
  const notification = await prisma.hrNotificationOutbox.findUnique({
    where: { id: input.notificationId },
    select: {
      id: true,
      status: true,
      relatedEntityType: true,
      relatedEntityId: true,
      documentAssignmentEmailOutbox: {
        select: {
          id: true,
        },
      },
      documentAssignmentReminderOutbox: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!notification) {
    throw new Error("Notification not found.");
  }

  if (notification.status !== "FAILED") {
    throw new Error("Only failed notifications can be retried.");
  }

  await resetNotificationToPending(notification.id);
  await syncLinkedAcknowledgementOutboxStatus({
    notificationId: notification.id,
    status: "PENDING",
  });
  await auditNotificationAction({
    actorId: input.actorId,
    action: "HR_NOTIFICATION_RETRIED",
    notificationId: notification.id,
    oldValue: {
      status: "FAILED",
    },
    newValue: {
      status: "PENDING",
      relatedEntityType: notification.relatedEntityType,
      relatedEntityId: notification.relatedEntityId,
    },
  });
}
