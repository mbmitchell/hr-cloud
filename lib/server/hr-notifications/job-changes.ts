import { prisma } from "../../db";
import { writeAuditLog } from "../audit/write-audit-log";
import { enqueueNotification } from "./service";

type JobChangeNotificationEvent =
  | "EMPLOYEE_CHANGE_REQUEST_SUBMITTED"
  | "EMPLOYEE_CHANGE_REQUEST_APPROVED"
  | "EMPLOYEE_CHANGE_REQUEST_APPLIED"
  | "EMPLOYEE_CHANGE_REQUEST_CANCELLED"
  | "EMPLOYEE_CHANGE_REQUEST_AUTO_APPLIED"
  | "EMPLOYEE_CHANGE_REQUEST_PENDING_ESCALATION"
  | "EMPLOYEE_CHANGE_REQUEST_APPROVED_OVERDUE_ESCALATION";

type LoadedChangeRequest = {
  id: string;
  employeeId: string;
  requestedByEmployeeId: string;
  requestedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
};

type NotificationRecipient = {
  employeeId: string | null;
  email: string;
};

function getAppUrl(path: string) {
  const baseUrl =
    process.env.APP_BASE_URL?.trim() || process.env.NEXTAUTH_URL?.trim() || "";

  if (!baseUrl) {
    return path;
  }

  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

function buildGenericNotificationContent(input: {
  eventType: JobChangeNotificationEvent;
  employeeName: string;
  appUrl: string;
  isEmployeeRecipient?: boolean;
}) {
  switch (input.eventType) {
    case "EMPLOYEE_CHANGE_REQUEST_SUBMITTED":
      return {
        subject: "Employment change request submitted",
        body: `${input.employeeName} has a new employment change request awaiting review.`,
      };
    case "EMPLOYEE_CHANGE_REQUEST_APPROVED":
      return {
        subject: "Employment change request approved",
        body: `${input.employeeName} has an approved employment change request awaiting application.`,
      };
    case "EMPLOYEE_CHANGE_REQUEST_APPLIED":
      return {
        subject: "Employment change request applied",
        body: input.isEmployeeRecipient
          ? "Your employment change request has been applied."
          : `${input.employeeName} has an employment change request that was applied.`,
      };
    case "EMPLOYEE_CHANGE_REQUEST_CANCELLED":
      return {
        subject: "Employment change request cancelled",
        body: input.isEmployeeRecipient
          ? "An employment change request you created has been cancelled."
          : `${input.employeeName} has an employment change request that was cancelled.`,
      };
    case "EMPLOYEE_CHANGE_REQUEST_AUTO_APPLIED":
      return {
        subject: "Employment change request applied",
        body: input.isEmployeeRecipient
          ? "Your employment change request has been applied."
          : `${input.employeeName} has an employment change request that was applied.`,
      };
    case "EMPLOYEE_CHANGE_REQUEST_PENDING_ESCALATION":
      return {
        subject: "Employment change request awaiting review",
        body: `${input.employeeName} has an employment change request that is still pending review.`,
      };
    case "EMPLOYEE_CHANGE_REQUEST_APPROVED_OVERDUE_ESCALATION":
      return {
        subject: "Employment change request awaiting application",
        body: `${input.employeeName} has an approved employment change request that is past its effective date and still needs to be applied.`,
      };
  }
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

  return assignments
    .map((assignment) => ({
      employeeId: assignment.employee.id,
      email: assignment.employee.email.trim().toLowerCase(),
    }))
    .filter((recipient) => recipient.email);
}

async function getHrAdminRecipients() {
  const assignments = await prisma.employeeRoleAssignment.findMany({
    where: {
      isActive: true,
      role: {
        code: "HR_ADMIN",
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

  return assignments
    .map((assignment) => ({
      employeeId: assignment.employee.id,
      email: assignment.employee.email.trim().toLowerCase(),
    }))
    .filter((recipient) => recipient.email);
}

async function resolveRecipients(
  eventType: JobChangeNotificationEvent,
  change: LoadedChangeRequest
): Promise<NotificationRecipient[]> {
  if (eventType === "EMPLOYEE_CHANGE_REQUEST_SUBMITTED") {
    return getHrAdminAndSiteAdminRecipients();
  }

  if (eventType === "EMPLOYEE_CHANGE_REQUEST_APPROVED") {
    return getHrAdminAndSiteAdminRecipients();
  }

  if (eventType === "EMPLOYEE_CHANGE_REQUEST_APPLIED") {
    return [
      {
        employeeId: change.employee.id,
        email: change.employee.email.trim().toLowerCase(),
      },
      ...(await getHrAdminRecipients()),
    ];
  }

  if (eventType === "EMPLOYEE_CHANGE_REQUEST_AUTO_APPLIED") {
    return [
      {
        employeeId: change.employee.id,
        email: change.employee.email.trim().toLowerCase(),
      },
      ...(await getHrAdminRecipients()),
    ];
  }

  if (
    eventType === "EMPLOYEE_CHANGE_REQUEST_PENDING_ESCALATION" ||
    eventType === "EMPLOYEE_CHANGE_REQUEST_APPROVED_OVERDUE_ESCALATION"
  ) {
    return getHrAdminAndSiteAdminRecipients();
  }

  return [
    {
      employeeId: change.requestedBy.id,
      email: change.requestedBy.email.trim().toLowerCase(),
    },
    ...(await getHrAdminRecipients()),
  ];
}

function uniqueRecipients(recipients: NotificationRecipient[]) {
  const seen = new Set<string>();

  return recipients.filter((recipient) => {
    const key = recipient.employeeId
      ? `employee:${recipient.employeeId}`
      : `email:${recipient.email}`;

    if (!recipient.email || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function loadChangeForNotifications(changeId: string) {
  return (prisma as typeof prisma & {
    employeeChangeRequest: {
      findUnique(args: Record<string, unknown>): Promise<LoadedChangeRequest | null>;
    };
  }).employeeChangeRequest.findUnique({
    where: { id: changeId },
    select: {
      id: true,
      employeeId: true,
      requestedByEmployeeId: true,
      requestedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });
}

export async function enqueueJobChangeNotifications(input: {
  eventType: JobChangeNotificationEvent;
  changeRequestId: string;
  actorId: string;
  notificationType?: "USER_INITIATED" | "SYSTEM_GENERATED";
}) {
  const change = await loadChangeForNotifications(input.changeRequestId);

  if (!change) {
    return;
  }

  const employeeName = `${change.employee.firstName} ${change.employee.lastName}`.trim();
  const appUrl = getAppUrl(`/employees/${change.employeeId}?tab=job-changes`);
  const recipients = uniqueRecipients(
    await resolveRecipients(input.eventType, change)
  );

  for (const recipient of recipients) {
    const content = buildGenericNotificationContent({
      eventType: input.eventType,
      employeeName,
      appUrl,
      isEmployeeRecipient: recipient.employeeId === change.employee.id,
    });

    const outboxEntry = await enqueueNotification({
      eventType: input.eventType,
      relatedEntityType: "EmployeeChangeRequest",
      relatedEntityId: change.id,
      notificationType: input.notificationType ?? "USER_INITIATED",
      employeeId: change.employeeId,
      recipientEmployeeId: recipient.employeeId,
      recipientEmail: recipient.email,
      templateKey: "GENERIC_HR_NOTIFICATION",
      payload: {
        subject: content.subject,
        body: content.body,
        appUrl,
        changeRequestId: change.id,
        employeeId: change.employeeId,
      },
      createdByEmployeeId: input.actorId,
    });

    await writeAuditLog(prisma, {
      userId: input.actorId,
      action: "HR_NOTIFICATION_ENQUEUED",
      entityType: "HrNotificationOutbox",
      entityId: outboxEntry.id,
      newValue: {
        eventType: input.eventType,
        relatedEntityType: "EmployeeChangeRequest",
        relatedEntityId: change.id,
        recipientEmployeeId: recipient.employeeId,
        recipientEmail: recipient.email,
        templateKey: "GENERIC_HR_NOTIFICATION",
      },
    });
  }
}
