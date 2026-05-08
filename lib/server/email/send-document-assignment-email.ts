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

export async function sendDocumentAssignmentEmail(input: {
  to: string;
  documentTitle: string;
  versionLabel: string;
  dueDate?: Date | null;
}) {
  const acknowledgementsUrl = withAppLink(
    getEmailRuntimeConfig().appBaseUrl,
    "/my-acknowledgements"
  );
  const dueDateLine = input.dueDate
    ? `Due date: ${formatDate(input.dueDate)}`
    : "Due date: No due date assigned";

  const subject = `Acknowledgement required: ${input.documentTitle}`;
  const text = [
    "A new document acknowledgement has been assigned to you in the MFN HR Platform.",
    "",
    `Document: ${input.documentTitle}`,
    `Version: ${input.versionLabel}`,
    dueDateLine,
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
