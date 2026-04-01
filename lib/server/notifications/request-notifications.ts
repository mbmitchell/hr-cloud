import { prisma } from "../../db";
import { sendEmail } from "./email";

type RequestSubmittedNotificationInput = {
  requestId: string;
};

type RequestDecisionNotificationInput = {
  requestId: string;
  decision: "APPROVED" | "DENIED";
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

function formatRequestDetails(input: {
  employeeName: string;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  hours: number;
  status: string;
  notes?: string | null;
  approvalComment?: string | null;
}) {
  const lines = [
    `Employee: ${input.employeeName}`,
    `Leave Type: ${input.leaveType}`,
    `Start Date: ${input.startDate.toLocaleDateString()}`,
    `End Date: ${input.endDate.toLocaleDateString()}`,
    `Hours: ${input.hours}`,
    `Status: ${input.status}`,
  ];

  if (input.notes !== undefined) {
    lines.push(`Notes: ${input.notes || "-"}`);
  }

  if (input.approvalComment !== undefined) {
    lines.push(`Approval Comment: ${input.approvalComment || "-"}`);
  }

  return lines.join("\n");
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
    return;
  }

  const recipientEmails = request.employee.manager?.email
    ? [request.employee.manager.email]
    : await getFallbackApproverEmails();

  if (recipientEmails.length === 0) {
    console.warn(
      `No approver email recipient found for PTO request ${request.id}.`
    );
    return;
  }

  const subject = "New PTO Request Submitted";
  const text = [
    "A new PTO request is awaiting review.",
    "",
    formatRequestDetails({
      employeeName: `${request.employee.firstName} ${request.employee.lastName}`,
      leaveType: request.leaveType,
      startDate: request.startDate,
      endDate: request.endDate,
      hours: request.hours,
      status: request.status,
      notes: request.notes,
    }),
  ].join("\n");

  for (const recipientEmail of recipientEmails) {
    await sendEmail({
      to: recipientEmail,
      subject,
      text,
    });
  }
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
    return;
  }

  await sendEmail({
    to: request.employee.email,
    subject:
      input.decision === "APPROVED"
        ? "PTO Request Approved"
        : "PTO Request Denied",
    text: [
      input.decision === "APPROVED"
        ? "Your PTO request has been approved."
        : "Your PTO request has been denied.",
      "",
      formatRequestDetails({
        employeeName: `${request.employee.firstName} ${request.employee.lastName}`,
        leaveType: request.leaveType,
        startDate: request.startDate,
        endDate: request.endDate,
        hours: request.hours,
        status: request.status,
        approvalComment: request.approvalComment,
        notes: request.notes,
      }),
    ].join("\n"),
  });
}
