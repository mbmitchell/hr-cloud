import { prisma } from "../../db";
import { writeAuditLog } from "../audit/write-audit-log";
import { enqueueNotification } from "./service";

type PtoNotificationEvent =
  | "PTO_REQUEST_SUBMITTED"
  | "PTO_REQUEST_APPROVED"
  | "PTO_REQUEST_DENIED"
  | "PTO_REQUEST_PENDING_ESCALATION";

type PtoRequestNotificationRecord = {
  id: string;
  employeeId: string;
  employee: {
    id: string;
    email: string;
    manager: {
      id: string;
      email: string;
    } | null;
  };
};

type NotificationRecipient = {
  employeeId: string | null;
  email: string;
  appPath: string;
};

function getAppUrl(path: string) {
  const baseUrl =
    process.env.APP_BASE_URL?.trim() || process.env.NEXTAUTH_URL?.trim() || "";

  if (!baseUrl) {
    return path;
  }

  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

function buildPtoNotificationContent(eventType: PtoNotificationEvent) {
  switch (eventType) {
    case "PTO_REQUEST_SUBMITTED":
      return {
        subject: "PTO request submitted",
        body: "A PTO request is awaiting your review.",
      };
    case "PTO_REQUEST_APPROVED":
      return {
        subject: "PTO request approved",
        body: "Your PTO request has been approved.",
      };
    case "PTO_REQUEST_DENIED":
      return {
        subject: "PTO request denied",
        body: "Your PTO request has been denied. Open MFN HR to review the decision.",
      };
    case "PTO_REQUEST_PENDING_ESCALATION":
      return {
        subject: "PTO request awaiting action",
        body: "A PTO request has remained pending and needs review in MFN HR.",
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

  return Array.from(
    new Map(
      assignments
        .map((assignment) => ({
          employeeId: assignment.employee.id,
          email: assignment.employee.email.trim().toLowerCase(),
          appPath: "/dashboard/approvals",
        }))
        .filter((recipient) => recipient.email)
        .map((recipient) => [`employee:${recipient.employeeId}`, recipient])
    ).values()
  );
}

function uniqueRecipients(recipients: NotificationRecipient[]) {
  const seen = new Set<string>();

  return recipients.filter((recipient) => {
    const email = recipient.email.trim().toLowerCase();

    if (!email || seen.has(email)) {
      return false;
    }

    seen.add(email);
    return true;
  });
}

async function loadRequestForNotifications(requestId: string) {
  return prisma.pTORequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      employeeId: true,
      employee: {
        select: {
          id: true,
          email: true,
          manager: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      },
    },
  }) as Promise<PtoRequestNotificationRecord | null>;
}

function resolveRecipients(
  eventType: PtoNotificationEvent,
  request: PtoRequestNotificationRecord
): NotificationRecipient[] {
  if (eventType === "PTO_REQUEST_SUBMITTED") {
    return request.employee.manager?.email
      ? [
          {
            employeeId: request.employee.manager.id,
            email: request.employee.manager.email,
            appPath: "/dashboard/approvals",
          },
        ]
      : [];
  }

  if (eventType === "PTO_REQUEST_PENDING_ESCALATION") {
    return [];
  }

  return request.employee.email
    ? [
        {
          employeeId: request.employee.id,
          email: request.employee.email,
          appPath: "/pto/requests",
        },
      ]
    : [];
}

export async function enqueuePtoNotifications(input: {
  eventType: PtoNotificationEvent;
  requestId: string;
  actorId: string;
  notificationType?: "USER_INITIATED" | "SYSTEM_GENERATED";
  recipientsOverride?: NotificationRecipient[];
}) {
  const request = await loadRequestForNotifications(input.requestId);

  if (!request) {
    return;
  }

  const recipients = uniqueRecipients(
    input.recipientsOverride ?? resolveRecipients(input.eventType, request)
  );
  const content = buildPtoNotificationContent(input.eventType);

  for (const recipient of recipients) {
    const outboxEntry = await enqueueNotification({
      eventType: input.eventType,
      relatedEntityType: "PTORequest",
      relatedEntityId: request.id,
      notificationType: input.notificationType ?? "USER_INITIATED",
      employeeId: request.employeeId,
      recipientEmployeeId: recipient.employeeId,
      recipientEmail: recipient.email,
      templateKey: "GENERIC_HR_NOTIFICATION",
      payload: {
        subject: content.subject,
        body: content.body,
        appUrl: getAppUrl(recipient.appPath),
        requestId: request.id,
        employeeId: request.employeeId,
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
        relatedEntityType: "PTORequest",
        relatedEntityId: request.id,
        recipientEmployeeId: recipient.employeeId,
        recipientEmail: recipient.email.trim().toLowerCase(),
        templateKey: "GENERIC_HR_NOTIFICATION",
      },
    });
  }
}

export async function enqueuePtoEscalationNotifications(input: {
  requestId: string;
  actorId: string;
}) {
  return enqueuePtoNotifications({
    eventType: "PTO_REQUEST_PENDING_ESCALATION",
    requestId: input.requestId,
    actorId: input.actorId,
    notificationType: "SYSTEM_GENERATED",
    recipientsOverride: await getHrAdminAndSiteAdminRecipients(),
  });
}
