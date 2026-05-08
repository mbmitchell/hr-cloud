import type { DocumentAssignmentReminderType } from "../document-acknowledgements/types";
import { prisma } from "../../db";
import { writeAuditLog } from "../audit/write-audit-log";
import { auditReminderGenerated } from "./audit";
import {
  enqueueNotification,
  markFailed,
  markProcessing,
  markSent,
  resetNotificationToPending,
} from "./service";

type AcknowledgementNotificationEvent =
  | "DOCUMENT_ASSIGNMENT_CREATED"
  | "DOCUMENT_ASSIGNMENT_REMINDER_OVERDUE"
  | "DOCUMENT_ASSIGNMENT_REMINDER_STALE_PENDING";

function getAppUrl(path: string) {
  const baseUrl =
    process.env.APP_BASE_URL?.trim() || process.env.NEXTAUTH_URL?.trim() || "";

  if (!baseUrl) {
    return path;
  }

  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

function getEventTypeForReminder(reminderType: DocumentAssignmentReminderType) {
  return reminderType === "OVERDUE"
    ? "DOCUMENT_ASSIGNMENT_REMINDER_OVERDUE"
    : "DOCUMENT_ASSIGNMENT_REMINDER_STALE_PENDING";
}

function buildContent(eventType: AcknowledgementNotificationEvent) {
  if (eventType === "DOCUMENT_ASSIGNMENT_CREATED") {
    return {
      subject: "Document acknowledgement assigned",
      body: "A document acknowledgement is ready for your review in MFN HR.",
    };
  }

  return {
    subject: "Document acknowledgement reminder",
    body: "You have a pending document acknowledgement that still requires your attention.",
  };
}

async function auditNotificationEnqueue(input: {
  actorId: string;
  outboxId: string;
  eventType: string;
  relatedEntityId: string;
  recipientEmployeeId: string | null;
  recipientEmail: string;
}) {
  await writeAuditLog(prisma, {
    userId: input.actorId,
    action: "HR_NOTIFICATION_ENQUEUED",
    entityType: "HrNotificationOutbox",
    entityId: input.outboxId,
    newValue: {
      eventType: input.eventType,
      relatedEntityType: "EmployeeDocumentAssignment",
      relatedEntityId: input.relatedEntityId,
      recipientEmployeeId: input.recipientEmployeeId,
      recipientEmail: input.recipientEmail,
      templateKey: "GENERIC_HR_NOTIFICATION",
    },
  });
}

async function auditNotificationStatusChange(input: {
  actorId: string;
  outboxId: string;
  relatedEntityId: string;
  oldStatus: string;
  newStatus: string;
  errorMessage?: string | null;
}) {
  await writeAuditLog(prisma, {
    userId: input.actorId,
    action: "HR_NOTIFICATION_STATUS_CHANGED",
    entityType: "HrNotificationOutbox",
    entityId: input.outboxId,
    oldValue: {
      status: input.oldStatus,
    },
    newValue: {
      status: input.newStatus,
      relatedEntityType: "EmployeeDocumentAssignment",
      relatedEntityId: input.relatedEntityId,
      errorMessage: input.errorMessage ?? null,
    },
  });
}

async function auditNotificationFailure(input: {
  actorId: string;
  outboxId: string;
  relatedEntityId: string;
  errorMessage: string;
}) {
  await writeAuditLog(prisma, {
    userId: input.actorId,
    action: "HR_NOTIFICATION_FAILED",
    entityType: "HrNotificationOutbox",
    entityId: input.outboxId,
    newValue: {
      relatedEntityType: "EmployeeDocumentAssignment",
      relatedEntityId: input.relatedEntityId,
      errorMessage: input.errorMessage,
    },
  });
}

export async function enqueueDocumentAssignmentHrNotification(input: {
  documentAssignmentOutboxId: string;
  actorId: string;
}) {
  const outbox = await prisma.documentAssignmentEmailOutbox.findUnique({
    where: { id: input.documentAssignmentOutboxId },
    select: {
      id: true,
      hrNotificationOutboxId: true,
      employeeId: true,
      employeeDocumentAssignmentId: true,
      employee: {
        select: {
          email: true,
        },
      },
    },
  });

  if (!outbox || outbox.hrNotificationOutboxId) {
    return;
  }

  const recipientEmail = outbox.employee.email.trim().toLowerCase();
  const appUrl = getAppUrl("/my-acknowledgements");
  const content = buildContent("DOCUMENT_ASSIGNMENT_CREATED");
  const hrOutbox = await enqueueNotification({
    eventType: "DOCUMENT_ASSIGNMENT_CREATED",
    relatedEntityType: "EmployeeDocumentAssignment",
    relatedEntityId: outbox.employeeDocumentAssignmentId,
    notificationType: "USER_INITIATED",
    employeeId: outbox.employeeId,
    recipientEmployeeId: outbox.employeeId,
    recipientEmail,
    templateKey: "GENERIC_HR_NOTIFICATION",
    payload: {
      subject: content.subject,
      body: content.body,
      appUrl,
      assignmentId: outbox.employeeDocumentAssignmentId,
      employeeId: outbox.employeeId,
    },
    createdByEmployeeId: input.actorId,
  });

  await prisma.documentAssignmentEmailOutbox.update({
    where: { id: outbox.id },
    data: {
      hrNotificationOutboxId: hrOutbox.id,
    },
  });

  await auditNotificationEnqueue({
    actorId: input.actorId,
    outboxId: hrOutbox.id,
    eventType: "DOCUMENT_ASSIGNMENT_CREATED",
    relatedEntityId: outbox.employeeDocumentAssignmentId,
    recipientEmployeeId: outbox.employeeId,
    recipientEmail,
  });
}

export async function enqueueDocumentAssignmentReminderHrNotification(input: {
  reminderOutboxId: string;
  actorId?: string | null;
}) {
  const outbox = await prisma.documentAssignmentReminderEmailOutbox.findUnique({
    where: { id: input.reminderOutboxId },
    select: {
      id: true,
      reminderType: true,
      hrNotificationOutboxId: true,
      employeeId: true,
      employeeDocumentAssignmentId: true,
      employee: {
        select: {
          email: true,
        },
      },
    },
  });

  if (!outbox || outbox.hrNotificationOutboxId) {
    return;
  }

  const eventType = getEventTypeForReminder(
    outbox.reminderType as DocumentAssignmentReminderType
  );
  const recipientEmail = outbox.employee.email.trim().toLowerCase();
  const appUrl = getAppUrl("/my-acknowledgements");
  const content = buildContent(eventType);
  const hrOutbox = await enqueueNotification({
    eventType,
    relatedEntityType: "EmployeeDocumentAssignment",
    relatedEntityId: outbox.employeeDocumentAssignmentId,
    notificationType: "SYSTEM_GENERATED",
    employeeId: outbox.employeeId,
    recipientEmployeeId: outbox.employeeId,
    recipientEmail,
    templateKey: "GENERIC_HR_NOTIFICATION",
    payload: {
      subject: content.subject,
      body: content.body,
      appUrl,
      assignmentId: outbox.employeeDocumentAssignmentId,
      employeeId: outbox.employeeId,
      reminderType: outbox.reminderType,
    },
    createdByEmployeeId: input.actorId ?? null,
  });

  await prisma.documentAssignmentReminderEmailOutbox.update({
    where: { id: outbox.id },
    data: {
      hrNotificationOutboxId: hrOutbox.id,
    },
  });

  await auditNotificationEnqueue({
    actorId: input.actorId ?? "system:document-acknowledgements",
    outboxId: hrOutbox.id,
    eventType,
    relatedEntityId: outbox.employeeDocumentAssignmentId,
    recipientEmployeeId: outbox.employeeId,
    recipientEmail,
  });
  await auditReminderGenerated({
    actorId: input.actorId ?? "system:document-acknowledgements",
    notificationId: hrOutbox.id,
    eventType,
    relatedEntityType: "EmployeeDocumentAssignment",
    relatedEntityId: outbox.employeeDocumentAssignmentId,
  });
}

export async function markAcknowledgementNotificationProcessing(input: {
  hrNotificationOutboxId: string | null;
  relatedEntityId: string;
}) {
  if (!input.hrNotificationOutboxId) {
    return;
  }

  const existing = await prisma.hrNotificationOutbox.findUnique({
    where: { id: input.hrNotificationOutboxId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!existing || existing.status === "PROCESSING") {
    return;
  }

  await markProcessing(existing.id);
  await auditNotificationStatusChange({
    actorId: "system:document-acknowledgements",
    outboxId: existing.id,
    relatedEntityId: input.relatedEntityId,
    oldStatus: existing.status,
    newStatus: "PROCESSING",
  });
}

export async function markAcknowledgementNotificationSent(input: {
  hrNotificationOutboxId: string | null;
  relatedEntityId: string;
}) {
  if (!input.hrNotificationOutboxId) {
    return;
  }

  const existing = await prisma.hrNotificationOutbox.findUnique({
    where: { id: input.hrNotificationOutboxId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!existing || existing.status === "SENT") {
    return;
  }

  await markSent(existing.id);
  await auditNotificationStatusChange({
    actorId: "system:document-acknowledgements",
    outboxId: existing.id,
    relatedEntityId: input.relatedEntityId,
    oldStatus: existing.status,
    newStatus: "SENT",
  });
}

export async function markAcknowledgementNotificationFailed(input: {
  hrNotificationOutboxId: string | null;
  relatedEntityId: string;
  errorMessage: string;
}) {
  if (!input.hrNotificationOutboxId) {
    return;
  }

  const existing = await prisma.hrNotificationOutbox.findUnique({
    where: { id: input.hrNotificationOutboxId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!existing) {
    return;
  }

  await markFailed({
    id: existing.id,
    errorMessage: input.errorMessage,
  });
  await auditNotificationFailure({
    actorId: "system:document-acknowledgements",
    outboxId: existing.id,
    relatedEntityId: input.relatedEntityId,
    errorMessage: input.errorMessage,
  });
  await auditNotificationStatusChange({
    actorId: "system:document-acknowledgements",
    outboxId: existing.id,
    relatedEntityId: input.relatedEntityId,
    oldStatus: existing.status,
    newStatus: "FAILED",
    errorMessage: input.errorMessage,
  });
}

export async function retryAcknowledgementHrNotification(input: {
  hrNotificationOutboxId: string;
  actorId: string;
}) {
  const notification = await prisma.hrNotificationOutbox.findUnique({
    where: { id: input.hrNotificationOutboxId },
    select: {
      id: true,
      status: true,
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

  if (
    !notification.documentAssignmentEmailOutbox &&
    !notification.documentAssignmentReminderOutbox
  ) {
    throw new Error(
      "Retry is only available for document acknowledgement notifications."
    );
  }

  await resetNotificationToPending(notification.id);

  if (notification.documentAssignmentEmailOutbox) {
    await prisma.documentAssignmentEmailOutbox.update({
      where: { id: notification.documentAssignmentEmailOutbox.id },
      data: {
        status: "PENDING",
        lastError: null,
      },
    });
  }

  if (notification.documentAssignmentReminderOutbox) {
    await prisma.documentAssignmentReminderEmailOutbox.update({
      where: { id: notification.documentAssignmentReminderOutbox.id },
      data: {
        status: "PENDING",
        lastError: null,
      },
    });
  }

  await writeAuditLog(prisma, {
    userId: input.actorId,
    action: "HR_NOTIFICATION_RETRIED",
    entityType: "HrNotificationOutbox",
    entityId: notification.id,
    oldValue: {
      status: "FAILED",
    },
    newValue: {
      status: "PENDING",
      relatedEntityType: "EmployeeDocumentAssignment",
      relatedEntityId: notification.relatedEntityId,
    },
  });

  await auditNotificationStatusChange({
    actorId: input.actorId,
    outboxId: notification.id,
    relatedEntityId: notification.relatedEntityId,
    oldStatus: "FAILED",
    newStatus: "PENDING",
  });

  return {
    notificationId: notification.id,
    documentAssignmentOutboxId: notification.documentAssignmentEmailOutbox?.id ?? null,
    reminderOutboxId: notification.documentAssignmentReminderOutbox?.id ?? null,
  };
}
