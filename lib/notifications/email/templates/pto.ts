function formatDate(value: Date) {
  return value.toLocaleDateString("en-US");
}

function withAppLink(baseUrl: string, path: string) {
  if (!baseUrl) {
    return null;
  }

  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

export function buildPtoRequestSubmittedEmail(input: {
  appBaseUrl: string;
  employeeName: string;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  hours: number;
}) {
  const approvalUrl = withAppLink(input.appBaseUrl, "/dashboard/approvals");

  return {
    subject: "MFN HR: PTO request submitted",
    text: [
      "A PTO request is awaiting your review in MFN HR.",
      "",
      `Employee: ${input.employeeName}`,
      `Leave type: ${input.leaveType}`,
      `Start date: ${formatDate(input.startDate)}`,
      `End date: ${formatDate(input.endDate)}`,
      `Hours: ${input.hours}`,
      approvalUrl ? "" : null,
      approvalUrl ? `Review request: ${approvalUrl}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function buildPtoRequestDecisionEmail(input: {
  appBaseUrl: string;
  employeeName: string;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  hours: number;
  decision: "APPROVED" | "DENIED";
  approvalComment?: string | null;
}) {
  const historyUrl = withAppLink(input.appBaseUrl, "/pto/requests");

  return {
    subject:
      input.decision === "APPROVED"
        ? "MFN HR: PTO request approved"
        : "MFN HR: PTO request denied",
    text: [
      input.decision === "APPROVED"
        ? "Your PTO request has been approved in MFN HR."
        : "Your PTO request has been denied in MFN HR.",
      "",
      `Employee: ${input.employeeName}`,
      `Leave type: ${input.leaveType}`,
      `Start date: ${formatDate(input.startDate)}`,
      `End date: ${formatDate(input.endDate)}`,
      `Hours: ${input.hours}`,
      input.approvalComment ? `Comment: ${input.approvalComment}` : null,
      historyUrl ? "" : null,
      historyUrl ? `View requests: ${historyUrl}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function buildPtoAdjustmentPostedEmail(input: {
  appBaseUrl: string;
  employeeName: string;
  bucket: string;
  adjustmentType: string;
  hours: number;
  balance: number;
  effectiveDate: Date;
}) {
  const employeeUrl = withAppLink(input.appBaseUrl, "/employees");

  return {
    subject: "MFN HR: PTO balance adjustment posted",
    text: [
      "A PTO balance adjustment has been posted in MFN HR.",
      "",
      `Employee: ${input.employeeName}`,
      `Bucket: ${input.bucket}`,
      `Adjustment type: ${input.adjustmentType}`,
      `Hours: ${input.hours}`,
      `New balance: ${input.balance}`,
      `Effective date: ${formatDate(input.effectiveDate)}`,
      employeeUrl ? "" : null,
      employeeUrl ? `View balances: ${employeeUrl}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
