import { getEmailRuntimeConfig, sendEmail } from "../../notifications/email/send-email";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function withAppLink(baseUrl: string, path: string) {
  if (!baseUrl) {
    return null;
  }

  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

export async function sendDocumentAssignmentReminderEmail(input: {
  to: string;
  employeeName: string;
  documentTitle: string;
  versionLabel: string;
  dueDate?: Date | null;
  reminderType: "OVERDUE" | "STALE_PENDING";
}) {
  const acknowledgementsUrl = withAppLink(
    getEmailRuntimeConfig().appBaseUrl,
    "/my-acknowledgements"
  );
  const subject =
    input.reminderType === "OVERDUE"
      ? `Overdue acknowledgement: ${input.documentTitle}`
      : `Reminder: acknowledgement pending for ${input.documentTitle}`;

  const intro =
    input.reminderType === "OVERDUE"
      ? "This is a reminder that a required document acknowledgement is overdue in the MFN HR Platform."
      : "This is a reminder that you still have a pending document acknowledgement in the MFN HR Platform.";

  const text = [
    `Hello ${input.employeeName},`,
    "",
    intro,
    "",
    `Document: ${input.documentTitle}`,
    `Version: ${input.versionLabel}`,
    input.dueDate ? `Due date: ${formatDate(input.dueDate)}` : null,
    acknowledgementsUrl ? "" : null,
    acknowledgementsUrl
      ? `Review and acknowledge it here: ${acknowledgementsUrl}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return sendEmail({
    to: input.to,
    subject,
    text,
  });
}
