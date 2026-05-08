import { prisma } from "../../db";
import { dispatchEmailInBackground } from "../../notifications/email/dispatch";
import { logEmailNotificationEvent } from "../../notifications/email/logger";
import { getEmailRuntimeConfig } from "../../notifications/email/send-email";
import { sendDocumentAssignmentEmail } from "../email/send-document-assignment-email";
import {
  markAcknowledgementNotificationFailed,
  markAcknowledgementNotificationProcessing,
  markAcknowledgementNotificationSent,
} from "../hr-notifications/document-acknowledgements";

function summarizeError(error: unknown) {
  const summary =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : "Unknown document assignment notification error.";

  return summary.slice(0, 500);
}

async function markOutboxFailed(outboxId: string, errorSummary: string) {
  await prisma.documentAssignmentEmailOutbox.update({
    where: { id: outboxId },
    data: {
      status: "FAILED",
      attemptCount: {
        increment: 1,
      },
      lastError: errorSummary,
    },
  });
}

async function dispatchDocumentAssignmentNotificationOutboxEntry(
  outboxId: string
) {
  const outbox = await prisma.documentAssignmentEmailOutbox.findUnique({
    where: { id: outboxId },
    select: {
      id: true,
      status: true,
      employeeId: true,
      hrNotificationOutboxId: true,
      employee: {
        select: {
          email: true,
        },
      },
      employeeDocumentAssignment: {
        select: {
          id: true,
          dueDate: true,
          assignableDocument: {
            select: {
              title: true,
            },
          },
          assignableDocumentVersion: {
            select: {
              versionLabel: true,
            },
          },
        },
      },
    },
  });

  if (!outbox || outbox.status !== "PENDING") {
    return;
  }

  await markAcknowledgementNotificationProcessing({
    hrNotificationOutboxId: outbox.hrNotificationOutboxId,
    relatedEntityId: outbox.employeeDocumentAssignment.id,
  });

  const recipient = outbox.employee.email.trim().toLowerCase();

  if (!recipient) {
    const errorSummary =
      "Assigned employee is missing an email address for acknowledgement delivery.";

    await markOutboxFailed(outbox.id, errorSummary);
    await markAcknowledgementNotificationFailed({
      hrNotificationOutboxId: outbox.hrNotificationOutboxId,
      relatedEntityId: outbox.employeeDocumentAssignment.id,
      errorMessage: errorSummary,
    });
    await logEmailNotificationEvent({
      eventType: "DOCUMENT_ASSIGNMENT_CREATED",
      category: "hr-notification",
      recipient: [],
      provider: getEmailRuntimeConfig().transport,
      relatedEntityType: "EmployeeDocumentAssignment",
      relatedEntityId: outbox.employeeDocumentAssignment.id,
      relatedEmployeeId: outbox.employeeId,
      outcome: "failed",
      errorSummary,
    });
    return;
  }

  try {
    const result = await sendDocumentAssignmentEmail({
      to: recipient,
      documentTitle: outbox.employeeDocumentAssignment.assignableDocument.title,
      versionLabel:
        outbox.employeeDocumentAssignment.assignableDocumentVersion.versionLabel,
      dueDate: outbox.employeeDocumentAssignment.dueDate,
    });

    if (!result.sent) {
      const errorSummary = result.reason.slice(0, 500);

      await markOutboxFailed(outbox.id, errorSummary);
      await markAcknowledgementNotificationFailed({
        hrNotificationOutboxId: outbox.hrNotificationOutboxId,
        relatedEntityId: outbox.employeeDocumentAssignment.id,
        errorMessage: errorSummary,
      });
      await logEmailNotificationEvent({
        eventType: "DOCUMENT_ASSIGNMENT_CREATED",
        category: "hr-notification",
        recipient,
        provider: result.provider,
        relatedEntityType: "EmployeeDocumentAssignment",
        relatedEntityId: outbox.employeeDocumentAssignment.id,
        relatedEmployeeId: outbox.employeeId,
        outcome: "failed",
        errorSummary,
      });
      return;
    }

    await prisma.documentAssignmentEmailOutbox.update({
      where: { id: outbox.id },
      data: {
        status: "SENT",
        attemptCount: {
          increment: 1,
        },
        sentAt: new Date(),
        lastError: null,
      },
    });
    await markAcknowledgementNotificationSent({
      hrNotificationOutboxId: outbox.hrNotificationOutboxId,
      relatedEntityId: outbox.employeeDocumentAssignment.id,
    });

    await logEmailNotificationEvent({
      eventType: "DOCUMENT_ASSIGNMENT_CREATED",
      category: "hr-notification",
      recipient,
      provider: result.provider,
      relatedEntityType: "EmployeeDocumentAssignment",
      relatedEntityId: outbox.employeeDocumentAssignment.id,
      relatedEmployeeId: outbox.employeeId,
      outcome: "sent",
      messageId: result.messageId ?? null,
    });
  } catch (error) {
    const errorSummary = summarizeError(error);

    await markOutboxFailed(outbox.id, errorSummary);
    await markAcknowledgementNotificationFailed({
      hrNotificationOutboxId: outbox.hrNotificationOutboxId,
      relatedEntityId: outbox.employeeDocumentAssignment.id,
      errorMessage: errorSummary,
    });
    await logEmailNotificationEvent({
      eventType: "DOCUMENT_ASSIGNMENT_CREATED",
      category: "hr-notification",
      recipient,
      provider: getEmailRuntimeConfig().transport,
      relatedEntityType: "EmployeeDocumentAssignment",
      relatedEntityId: outbox.employeeDocumentAssignment.id,
      relatedEmployeeId: outbox.employeeId,
      outcome: "failed",
      errorSummary,
    });
  }
}

export function dispatchDocumentAssignmentNotificationOutboxEntries(
  outboxIds: string[]
) {
  const uniqueOutboxIds = Array.from(new Set(outboxIds.filter(Boolean)));

  if (uniqueOutboxIds.length === 0) {
    return;
  }

  dispatchEmailInBackground(async () => {
    for (const outboxId of uniqueOutboxIds) {
      await dispatchDocumentAssignmentNotificationOutboxEntry(outboxId);
    }
  });
}
