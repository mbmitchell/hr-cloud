import { prisma } from "../../db";
import { logEmailNotificationEvent } from "./logger";
import { getEmailRuntimeConfig, sendEmail } from "./send-email";
import { buildPtoAdjustmentPostedEmail, buildPtoRequestDecisionEmail, buildPtoRequestSubmittedEmail } from "./templates/pto";

type RequestSubmittedNotificationInput = {
  requestId: string;
};

type RequestDecisionNotificationInput = {
  requestId: string;
  decision: "APPROVED" | "DENIED";
};

type AdjustmentPostedNotificationInput = {
  ledgerEntryId: string;
};

async function getFallbackApproverEmails() {
  const approvers = await prisma.employeeRoleAssignment.findMany({
    where: {
      isActive: true,
      role: {
        code: {
          in: ["SITE_ADMIN", "HR_ADMIN"],
        },
      },
    },
    select: {
      employee: {
        select: {
          email: true,
        },
      },
    },
  });

  return Array.from(
    new Set(
      approvers
        .map((assignment) => assignment.employee.email.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

async function deliverWorkflowEmail(input: {
  eventType: string;
  relatedEntityType: string;
  relatedEntityId: string;
  relatedEmployeeId?: string | null;
  relatedRequestId?: string | null;
  recipients: string[];
  subject: string;
  text: string;
}) {
  const config = getEmailRuntimeConfig();

  if (input.recipients.length === 0) {
    await logEmailNotificationEvent({
      eventType: input.eventType,
      category: "hr-notification",
      recipient: [],
      provider: config.transport,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      relatedEmployeeId: input.relatedEmployeeId,
      relatedRequestId: input.relatedRequestId,
      outcome: "skipped",
      transportReason: "No recipients resolved for notification.",
    });
    return;
  }

  try {
    const result = await sendEmail({
      to: input.recipients,
      subject: input.subject,
      text: input.text,
    });

    if (!result.sent) {
      await logEmailNotificationEvent({
        eventType: input.eventType,
        category: "hr-notification",
        recipient: input.recipients,
        provider: result.provider,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
        relatedEmployeeId: input.relatedEmployeeId,
        relatedRequestId: input.relatedRequestId,
        outcome: "skipped",
        transportReason: result.reason,
      });
      return;
    }

    await logEmailNotificationEvent({
      eventType: input.eventType,
      category: "hr-notification",
      recipient: input.recipients,
      provider: result.provider,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      relatedEmployeeId: input.relatedEmployeeId,
      relatedRequestId: input.relatedRequestId,
      outcome: "sent",
      messageId: result.messageId ?? null,
    });
  } catch (error) {
    await logEmailNotificationEvent({
      eventType: input.eventType,
      category: "hr-notification",
      recipient: input.recipients,
      provider: config.transport,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      relatedEmployeeId: input.relatedEmployeeId,
      relatedRequestId: input.relatedRequestId,
      outcome: "failed",
      errorSummary:
        error instanceof Error ? `${error.name}: ${error.message}` : "Unknown notification error.",
    });
  }
}

export async function sendPtoRequestSubmittedNotification(
  input: RequestSubmittedNotificationInput
) {
  const request = await prisma.pTORequest.findUnique({
    where: { id: input.requestId },
    include: {
      employee: {
        include: {
          manager: true,
        },
      },
    },
  });

  if (!request) {
    await logEmailNotificationEvent({
      eventType: "PTO_REQUEST_SUBMITTED",
      category: "hr-notification",
      recipient: [],
      provider: getEmailRuntimeConfig().transport,
      relatedEntityType: "PTORequest",
      relatedEntityId: input.requestId,
      relatedRequestId: input.requestId,
      outcome: "skipped",
      transportReason: "PTO request not found when preparing notification.",
    });
    return;
  }

  const recipients = request.employee.manager?.email
    ? [request.employee.manager.email.trim().toLowerCase()]
    : await getFallbackApproverEmails();

  const template = buildPtoRequestSubmittedEmail({
    appBaseUrl: getEmailRuntimeConfig().appBaseUrl,
    employeeName: `${request.employee.firstName} ${request.employee.lastName}`,
    leaveType: request.leaveType,
    startDate: request.startDate,
    endDate: request.endDate,
    hours: request.hours,
  });

  await deliverWorkflowEmail({
    eventType: "PTO_REQUEST_SUBMITTED",
    relatedEntityType: "PTORequest",
    relatedEntityId: request.id,
    relatedEmployeeId: request.employeeId,
    relatedRequestId: request.id,
    recipients,
    subject: template.subject,
    text: template.text,
  });
}

export async function sendPtoRequestApprovedNotification(
  input: Omit<RequestDecisionNotificationInput, "decision">
) {
  return sendPtoRequestDecisionNotification({
    ...input,
    decision: "APPROVED",
  });
}

export async function sendPtoRequestDeniedNotification(
  input: Omit<RequestDecisionNotificationInput, "decision">
) {
  return sendPtoRequestDecisionNotification({
    ...input,
    decision: "DENIED",
  });
}

async function sendPtoRequestDecisionNotification(
  input: RequestDecisionNotificationInput
) {
  const request = await prisma.pTORequest.findUnique({
    where: { id: input.requestId },
    include: {
      employee: true,
    },
  });

  if (!request) {
    await logEmailNotificationEvent({
      eventType: `PTO_REQUEST_${input.decision}`,
      category: "hr-notification",
      recipient: [],
      provider: getEmailRuntimeConfig().transport,
      relatedEntityType: "PTORequest",
      relatedEntityId: input.requestId,
      relatedRequestId: input.requestId,
      outcome: "skipped",
      transportReason: "PTO request not found when preparing notification.",
    });
    return;
  }

  const template = buildPtoRequestDecisionEmail({
    appBaseUrl: getEmailRuntimeConfig().appBaseUrl,
    employeeName: `${request.employee.firstName} ${request.employee.lastName}`,
    leaveType: request.leaveType,
    startDate: request.startDate,
    endDate: request.endDate,
    hours: request.hours,
    decision: input.decision,
    approvalComment: request.approvalComment,
  });

  await deliverWorkflowEmail({
    eventType: `PTO_REQUEST_${input.decision}`,
    relatedEntityType: "PTORequest",
    relatedEntityId: request.id,
    relatedEmployeeId: request.employeeId,
    relatedRequestId: request.id,
    recipients: [request.employee.email.trim().toLowerCase()],
    subject: template.subject,
    text: template.text,
  });
}

export async function sendPtoAdjustmentPostedNotification(
  input: AdjustmentPostedNotificationInput
) {
  const ledgerEntry = await prisma.pTOLedger.findUnique({
    where: { id: input.ledgerEntryId },
    include: {
      employee: true,
    },
  });

  if (!ledgerEntry) {
    await logEmailNotificationEvent({
      eventType: "PTO_ADJUSTMENT_POSTED",
      category: "hr-notification",
      recipient: [],
      provider: getEmailRuntimeConfig().transport,
      relatedEntityType: "PTOLedger",
      relatedEntityId: input.ledgerEntryId,
      relatedEmployeeId: null,
      outcome: "skipped",
      transportReason: "PTO ledger entry not found when preparing notification.",
    });
    return;
  }

  const template = buildPtoAdjustmentPostedEmail({
    appBaseUrl: getEmailRuntimeConfig().appBaseUrl,
    employeeName: `${ledgerEntry.employee.firstName} ${ledgerEntry.employee.lastName}`,
    bucket: ledgerEntry.bucket,
    adjustmentType: ledgerEntry.type,
    hours: ledgerEntry.hours,
    balance: ledgerEntry.balance,
    effectiveDate: ledgerEntry.effectiveDate,
  });

  await deliverWorkflowEmail({
    eventType: "PTO_ADJUSTMENT_POSTED",
    relatedEntityType: "PTOLedger",
    relatedEntityId: ledgerEntry.id,
    relatedEmployeeId: ledgerEntry.employeeId,
    recipients: [ledgerEntry.employee.email.trim().toLowerCase()],
    subject: template.subject,
    text: template.text,
  });
}
