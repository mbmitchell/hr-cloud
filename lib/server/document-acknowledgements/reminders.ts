import { Prisma } from "@prisma/client";

import { prisma } from "../../db";
import { dispatchEmailInBackground } from "../../notifications/email/dispatch";
import { logEmailNotificationEvent } from "../../notifications/email/logger";
import { getEmailRuntimeConfig } from "../../notifications/email/send-email";
import type { AuthorizationActor } from "../authorization";
import { assertCanManageDocumentAcknowledgements } from "./access";
import type { DocumentAssignmentReminderType } from "./types";
import { sendDocumentAssignmentReminderEmail } from "../email/send-document-assignment-reminder-email";

const DEFAULT_STALE_PENDING_THRESHOLD_DAYS = 7;
const REMINDER_TIME_ZONE = "America/Chicago";

export function getDocumentAcknowledgementReminderConfig(
  env: Record<string, string | undefined> = process.env
) {
  const rawEnabled = env.DOCUMENT_ACKNOWLEDGEMENT_REMINDERS_ENABLED?.trim();
  const rawThreshold =
    env.DOCUMENT_ACKNOWLEDGEMENT_REMINDER_STALE_DAYS?.trim();
  const parsedThreshold = Number(rawThreshold);

  return {
    enabled: rawEnabled ? rawEnabled.toLowerCase() === "true" : true,
    staleThresholdDays:
      Number.isFinite(parsedThreshold) && parsedThreshold >= 0
        ? Math.floor(parsedThreshold)
        : DEFAULT_STALE_PENDING_THRESHOLD_DAYS,
  };
}

type ReminderEligibleAssignment = {
  id: string;
  employeeId: string;
  assignedAt: Date;
  dueDate: Date | null;
  employee: {
    email: string;
    firstName: string;
    lastName: string;
  };
  assignableDocument: {
    title: string;
    isActive: boolean;
  };
  assignableDocumentVersion: {
    versionLabel: string;
    employeeDocument: {
      status: string;
    };
  };
};

function summarizeError(error: unknown) {
  const summary =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : "Unknown document assignment reminder error.";

  return summary.slice(0, 500);
}

function getReminderDayKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: REMINDER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function classifyReminderType(
  assignment: Pick<ReminderEligibleAssignment, "assignedAt" | "dueDate">,
  now: Date,
  staleThresholdDays: number
): DocumentAssignmentReminderType | null {
  if (assignment.dueDate && assignment.dueDate.getTime() < now.getTime()) {
    return "OVERDUE";
  }

  const staleCutoff = new Date(now);
  staleCutoff.setDate(staleCutoff.getDate() - staleThresholdDays);

  if (assignment.assignedAt.getTime() <= staleCutoff.getTime()) {
    return "STALE_PENDING";
  }

  return null;
}

export async function listDocumentAssignmentsEligibleForReminder(input?: {
  now?: Date;
  staleThresholdDays?: number;
}) {
  const now = input?.now ?? new Date();
  const staleThresholdDays =
    input?.staleThresholdDays ?? DEFAULT_STALE_PENDING_THRESHOLD_DAYS;

  const assignments = await prisma.employeeDocumentAssignment.findMany({
    where: {
      status: "PENDING",
      acknowledgedAt: null,
      employee: {
        status: "ACTIVE",
      },
      assignableDocument: {
        isActive: true,
      },
      assignableDocumentVersion: {
        employeeDocument: {
          status: "ACTIVE",
        },
      },
    },
    select: {
      id: true,
      employeeId: true,
      assignedAt: true,
      dueDate: true,
      employee: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      assignableDocument: {
        select: {
          title: true,
          isActive: true,
        },
      },
      assignableDocumentVersion: {
        select: {
          versionLabel: true,
          employeeDocument: {
            select: {
              status: true,
            },
          },
        },
      },
    },
    orderBy: [{ dueDate: "asc" }, { assignedAt: "asc" }],
  });

  return assignments
    .map((assignment) => ({
      ...assignment,
      reminderType: classifyReminderType(assignment, now, staleThresholdDays),
    }))
    .filter(
      (
        assignment
      ): assignment is ReminderEligibleAssignment & {
        reminderType: DocumentAssignmentReminderType;
      } => assignment.reminderType != null
    );
}

async function markReminderOutboxFailed(outboxId: string, errorSummary: string) {
  await prisma.documentAssignmentReminderEmailOutbox.update({
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

async function dispatchReminderOutboxEntry(outboxId: string) {
  const outbox = await prisma.documentAssignmentReminderEmailOutbox.findUnique({
    where: { id: outboxId },
    select: {
      id: true,
      status: true,
      reminderType: true,
      employeeId: true,
      employee: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
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

  const recipient = outbox.employee.email.trim().toLowerCase();

  if (!recipient) {
    const errorSummary =
      "Assigned employee is missing an email address for acknowledgement reminder delivery.";

    await markReminderOutboxFailed(outbox.id, errorSummary);
    await logEmailNotificationEvent({
      eventType: `DOCUMENT_ASSIGNMENT_REMINDER_${outbox.reminderType}`,
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
    const result = await sendDocumentAssignmentReminderEmail({
      to: recipient,
      employeeName: `${outbox.employee.firstName} ${outbox.employee.lastName}`.trim(),
      documentTitle: outbox.employeeDocumentAssignment.assignableDocument.title,
      versionLabel:
        outbox.employeeDocumentAssignment.assignableDocumentVersion.versionLabel,
      dueDate: outbox.employeeDocumentAssignment.dueDate,
      reminderType: outbox.reminderType as DocumentAssignmentReminderType,
    });

    if (!result.sent) {
      const errorSummary = result.reason.slice(0, 500);

      await markReminderOutboxFailed(outbox.id, errorSummary);
      await logEmailNotificationEvent({
        eventType: `DOCUMENT_ASSIGNMENT_REMINDER_${outbox.reminderType}`,
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

    await prisma.documentAssignmentReminderEmailOutbox.update({
      where: { id: outbox.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        lastError: null,
      },
    });

    await logEmailNotificationEvent({
      eventType: `DOCUMENT_ASSIGNMENT_REMINDER_${outbox.reminderType}`,
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

    await markReminderOutboxFailed(outbox.id, errorSummary);
    await logEmailNotificationEvent({
      eventType: `DOCUMENT_ASSIGNMENT_REMINDER_${outbox.reminderType}`,
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

export function dispatchDocumentAssignmentReminderOutboxEntries(outboxIds: string[]) {
  const uniqueOutboxIds = Array.from(new Set(outboxIds.filter(Boolean)));

  if (uniqueOutboxIds.length === 0) {
    return;
  }

  dispatchEmailInBackground(async () => {
    for (const outboxId of uniqueOutboxIds) {
      await dispatchReminderOutboxEntry(outboxId);
    }
  });
}

export async function runDocumentAssignmentReminderGeneration(input?: {
  staleThresholdDays?: number;
  now?: Date;
}) {
  const now = input?.now ?? new Date();
  const staleThresholdDays =
    input?.staleThresholdDays ?? DEFAULT_STALE_PENDING_THRESHOLD_DAYS;
  const reminderDay = getReminderDayKey(now);
  const eligibleAssignments = await listDocumentAssignmentsEligibleForReminder({
    now,
    staleThresholdDays,
  });

  const createdOutboxIds = await prisma.$transaction(async (tx) => {
    const createdIds: string[] = [];

    for (const assignment of eligibleAssignments) {
      try {
        const outbox = await tx.documentAssignmentReminderEmailOutbox.create({
          data: {
            employeeDocumentAssignmentId: assignment.id,
            employeeId: assignment.employeeId,
            reminderType: assignment.reminderType,
            reminderDay,
          },
          select: {
            id: true,
          },
        });

        createdIds.push(outbox.id);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          continue;
        }

        throw error;
      }
    }

    return createdIds;
  });

  dispatchDocumentAssignmentReminderOutboxEntries(createdOutboxIds);

  return {
    timestamp: now.toISOString(),
    reminderDay,
    staleThresholdDays,
    eligible: eligibleAssignments.length,
    created: createdOutboxIds.length,
    skippedDuplicates: eligibleAssignments.length - createdOutboxIds.length,
    countsByType: {
      overdue: eligibleAssignments.filter(
        (assignment) => assignment.reminderType === "OVERDUE"
      ).length,
      stalePending: eligibleAssignments.filter(
        (assignment) => assignment.reminderType === "STALE_PENDING"
      ).length,
    },
  };
}

export async function triggerDocumentAssignmentReminderEmails(input: {
  actor: AuthorizationActor;
  staleThresholdDays?: number;
  now?: Date;
}) {
  assertCanManageDocumentAcknowledgements(input.actor);

  return runDocumentAssignmentReminderGeneration({
    staleThresholdDays: input.staleThresholdDays,
    now: input.now,
  });
}
