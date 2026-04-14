import { prisma } from "../../db";
import { enqueueNotification } from "./service";
import { auditNotificationAction, auditReminderGenerated } from "./audit";
import { runDocumentAssignmentReminderGeneration } from "../document-acknowledgements/reminders";

function getAppUrl(path: string) {
  const baseUrl =
    process.env.APP_BASE_URL?.trim() || process.env.NEXTAUTH_URL?.trim() || "";

  if (!baseUrl) {
    return path;
  }

  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

function startOfLocalDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfLocalDay(date = new Date()) {
  const value = startOfLocalDay(date);
  value.setDate(value.getDate() + 1);
  return value;
}

async function getHrAdminAndSiteAdminRecipients() {
  const assignments = await prisma.employeeRoleAssignment.findMany({
    where: {
      isActive: true,
      role: {
        code: {
          in: ["HR_ADMIN", "SITE_ADMIN"],
        },
      },
    },
    select: {
      employee: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  return Array.from(
    new Map(
      assignments
        .map((assignment) => ({
          employeeId: assignment.employee.id,
          email: assignment.employee.email.trim().toLowerCase(),
        }))
        .filter((recipient) => recipient.email)
        .map((recipient) => [`employee:${recipient.employeeId}`, recipient])
    ).values()
  );
}

async function hasReminderForToday(input: {
  eventType: string;
  relatedEntityId: string;
  recipientEmployeeId: string;
  now: Date;
}) {
  const existing = await prisma.hrNotificationOutbox.findFirst({
    where: {
      eventType: input.eventType,
      relatedEntityType: "EmployeeChangeRequest",
      relatedEntityId: input.relatedEntityId,
      recipientEmployeeId: input.recipientEmployeeId,
      notificationType: "SYSTEM_GENERATED",
      createdAt: {
        gte: startOfLocalDay(input.now),
        lt: endOfLocalDay(input.now),
      },
    },
    select: {
      id: true,
    },
  });

  return Boolean(existing);
}

export async function generateJobChangeReadyToApplyReminders(input?: {
  actorId?: string | null;
  now?: Date;
}) {
  const now = input?.now ?? new Date();
  const actorId = input?.actorId ?? "system:notifications";
  const recipients = await getHrAdminAndSiteAdminRecipients();

  const changes = await prisma.employeeChangeRequest.findMany({
    where: {
      status: "APPROVED",
      appliedAt: null,
      requestedEffectiveDate: {
        lte: now,
      },
    },
    select: {
      id: true,
      employeeId: true,
      employee: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: [{ requestedEffectiveDate: "asc" }, { createdAt: "asc" }],
  });

  let created = 0;
  let skippedDuplicates = 0;

  for (const change of changes) {
    const employeeName = `${change.employee.firstName} ${change.employee.lastName}`.trim();
    const appUrl = getAppUrl(`/employees/${change.employeeId}?tab=job-changes`);

    for (const recipient of recipients) {
      if (
        await hasReminderForToday({
          eventType: "EMPLOYEE_CHANGE_REQUEST_READY_TO_APPLY_REMINDER",
          relatedEntityId: change.id,
          recipientEmployeeId: recipient.employeeId,
          now,
        })
      ) {
        skippedDuplicates += 1;
        continue;
      }

      const outboxEntry = await enqueueNotification({
        eventType: "EMPLOYEE_CHANGE_REQUEST_READY_TO_APPLY_REMINDER",
        relatedEntityType: "EmployeeChangeRequest",
        relatedEntityId: change.id,
        notificationType: "SYSTEM_GENERATED",
        employeeId: change.employeeId,
        recipientEmployeeId: recipient.employeeId,
        recipientEmail: recipient.email,
        templateKey: "GENERIC_HR_NOTIFICATION",
        payload: {
          subject: "Employment change ready to apply",
          body: `${employeeName} has an approved employment change request ready to apply.`,
          appUrl,
          changeRequestId: change.id,
          employeeId: change.employeeId,
        },
        createdByEmployeeId: null,
      });

      created += 1;
      await auditNotificationAction({
        actorId,
        action: "HR_NOTIFICATION_ENQUEUED",
        notificationId: outboxEntry.id,
        newValue: {
          eventType: "EMPLOYEE_CHANGE_REQUEST_READY_TO_APPLY_REMINDER",
          relatedEntityType: "EmployeeChangeRequest",
          relatedEntityId: change.id,
          notificationType: "SYSTEM_GENERATED",
          recipientEmployeeId: recipient.employeeId,
          recipientEmail: recipient.email,
        },
      });
      await auditReminderGenerated({
        actorId,
        notificationId: outboxEntry.id,
        eventType: "EMPLOYEE_CHANGE_REQUEST_READY_TO_APPLY_REMINDER",
        relatedEntityType: "EmployeeChangeRequest",
        relatedEntityId: change.id,
      });
    }
  }

  return {
    created,
    skippedDuplicates,
    eligibleChanges: changes.length,
  };
}

export async function runSystemNotificationReminderGeneration(input?: {
  actorId?: string | null;
  now?: Date;
}) {
  const actorId = input?.actorId ?? "system:notifications";
  const now = input?.now ?? new Date();
  const [jobChanges, acknowledgements] = await Promise.all([
    generateJobChangeReadyToApplyReminders({
      actorId,
      now,
    }),
    runDocumentAssignmentReminderGeneration({
      actorId,
      now,
    }),
  ]);

  return {
    jobChanges,
    acknowledgements,
  };
}
