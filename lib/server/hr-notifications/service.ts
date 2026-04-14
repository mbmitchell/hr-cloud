import { prisma } from "../../db";
import type {
  EnqueueHrNotificationInput,
  MarkHrNotificationFailedInput,
  PendingHrNotification,
  HrNotificationOutboxRecord,
  HrNotificationType,
} from "./types";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeErrorMessage(value: string) {
  return value.trim().slice(0, 4000);
}

export async function enqueueNotification(input: EnqueueHrNotificationInput) {
  return (prisma as typeof prisma & {
    hrNotificationOutbox: {
      create(args: Record<string, unknown>): Promise<HrNotificationOutboxRecord>;
    };
  }).hrNotificationOutbox.create({
    data: {
      eventType: input.eventType.trim(),
      relatedEntityType: input.relatedEntityType.trim(),
      relatedEntityId: input.relatedEntityId.trim(),
      notificationType: input.notificationType ?? "USER_INITIATED",
      employeeId: input.employeeId ?? null,
      recipientEmployeeId: input.recipientEmployeeId ?? null,
      recipientEmail: normalizeEmail(input.recipientEmail),
      templateKey: input.templateKey,
      payload: input.payload,
      createdByEmployeeId: input.createdByEmployeeId ?? null,
    },
  });
}

export async function getPendingNotifications(limit = 50): Promise<PendingHrNotification[]> {
  return (prisma as typeof prisma & {
    hrNotificationOutbox: {
      findMany(args: Record<string, unknown>): Promise<PendingHrNotification[]>;
    };
  }).hrNotificationOutbox.findMany({
    where: {
      status: "PENDING",
    },
    orderBy: [{ createdAt: "asc" }],
    take: limit,
  });
}

export async function getProcessableNotifications(input?: {
  limit?: number;
  maxAttempts?: number;
  retryDelayMinutes?: number;
  notificationIds?: string[];
  ignoreMaxAttempts?: boolean;
}) {
  const limit = input?.limit ?? 50;
  const maxAttempts = input?.maxAttempts ?? 5;
  const retryDelayMinutes = input?.retryDelayMinutes ?? 30;
  const retryCutoff = new Date(Date.now() - retryDelayMinutes * 60 * 1000);
  const notificationIds = input?.notificationIds?.filter(Boolean) ?? [];
  const ignoreMaxAttempts = input?.ignoreMaxAttempts ?? false;

  return prisma.hrNotificationOutbox.findMany({
    where: {
      ...(notificationIds.length > 0 ? { id: { in: notificationIds } } : {}),
      OR: [
        {
          status: "PENDING",
        },
        {
          status: "FAILED",
          ...(ignoreMaxAttempts
            ? {}
            : {
                attemptCount: {
                  lt: maxAttempts,
                },
              }),
          lastAttemptAt: {
            lte: retryCutoff,
          },
        },
      ],
    },
    orderBy: [{ createdAt: "asc" }],
    take: limit,
    select: {
      id: true,
      eventType: true,
      relatedEntityType: true,
      relatedEntityId: true,
      notificationType: true,
      employeeId: true,
      recipientEmployeeId: true,
      recipientEmail: true,
      templateKey: true,
      payload: true,
      status: true,
      attemptCount: true,
      lastAttemptAt: true,
      sentAt: true,
      lastError: true,
      createdByEmployeeId: true,
      createdAt: true,
      updatedAt: true,
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
}

export async function markProcessing(id: string) {
  return (prisma as typeof prisma & {
    hrNotificationOutbox: {
      update(args: Record<string, unknown>): Promise<HrNotificationOutboxRecord>;
    };
  }).hrNotificationOutbox.update({
    where: { id },
    data: {
      status: "PROCESSING",
      lastAttemptAt: new Date(),
    },
  });
}

export async function markSent(id: string) {
  return (prisma as typeof prisma & {
    hrNotificationOutbox: {
      update(args: Record<string, unknown>): Promise<HrNotificationOutboxRecord>;
    };
  }).hrNotificationOutbox.update({
    where: { id },
    data: {
      status: "SENT",
      attemptCount: {
        increment: 1,
      },
      lastAttemptAt: new Date(),
      sentAt: new Date(),
      lastError: null,
    },
  });
}

export async function markFailed(input: MarkHrNotificationFailedInput) {
  return (prisma as typeof prisma & {
    hrNotificationOutbox: {
      update(args: Record<string, unknown>): Promise<HrNotificationOutboxRecord>;
    };
  }).hrNotificationOutbox.update({
    where: { id: input.id },
    data: {
      status: input.nextStatus ?? "FAILED",
      attemptCount: {
        increment: 1,
      },
      lastAttemptAt: new Date(),
      lastError: normalizeErrorMessage(input.errorMessage),
    },
  });
}

export async function resetNotificationToPending(id: string) {
  return (prisma as typeof prisma & {
    hrNotificationOutbox: {
      update(args: Record<string, unknown>): Promise<HrNotificationOutboxRecord>;
    };
  }).hrNotificationOutbox.update({
    where: { id },
    data: {
      status: "PENDING",
      lastError: null,
    },
  });
}

export async function cancelNotification(id: string, errorMessage?: string | null) {
  return prisma.hrNotificationOutbox.update({
    where: { id },
    data: {
      status: "CANCELLED",
      lastError: errorMessage?.trim() ? normalizeErrorMessage(errorMessage) : null,
    },
  });
}

export function getHrNotificationProcessorConfig(
  env: Record<string, string | undefined> = process.env
) {
  const rawBatchSize = Number(env.HR_NOTIFICATION_BATCH_SIZE ?? "25");
  const rawMaxAttempts = Number(env.HR_NOTIFICATION_MAX_ATTEMPTS ?? "5");
  const rawRetryDelayMinutes = Number(
    env.HR_NOTIFICATION_RETRY_DELAY_MINUTES ?? "30"
  );

  return {
    batchSize:
      Number.isFinite(rawBatchSize) && rawBatchSize > 0
        ? Math.floor(rawBatchSize)
        : 25,
    maxAttempts:
      Number.isFinite(rawMaxAttempts) && rawMaxAttempts > 0
        ? Math.floor(rawMaxAttempts)
        : 5,
    retryDelayMinutes:
      Number.isFinite(rawRetryDelayMinutes) && rawRetryDelayMinutes >= 0
        ? Math.floor(rawRetryDelayMinutes)
        : 30,
  };
}
