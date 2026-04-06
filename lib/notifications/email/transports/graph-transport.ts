import {
  graphApiRequest,
  hasRequiredGraphConfig,
} from "../../graph/client";
import type { EmailMessage, EmailRuntimeConfig, EmailSendResult } from "../types";

export async function sendWithGraphTransport(
  message: EmailMessage,
  config: EmailRuntimeConfig
): Promise<EmailSendResult> {
  if (!hasRequiredGraphConfig(config)) {
    return {
      sent: false,
      skipped: true,
      provider: "graph",
      reason:
        "Graph mail delivery is not fully configured. GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, and GRAPH_MAILBOX_USER_ID are required.",
    };
  }

  const recipients = Array.isArray(message.to) ? message.to : [message.to];

  const response = await graphApiRequest(
    config,
    `/users/${encodeURIComponent(config.graphMailboxUserId)}/sendMail`,
    {
      method: "POST",
      body: JSON.stringify({
        message: {
          subject: message.subject,
          body: {
            contentType: "Text",
            content: message.text,
          },
          replyTo: message.replyTo
            ? [
                {
                  emailAddress: {
                    address: message.replyTo,
                  },
                },
              ]
            : undefined,
          toRecipients: recipients.map((recipient) => ({
            emailAddress: {
              address: recipient,
            },
          })),
        },
        saveToSentItems: false,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Graph sendMail failed with status ${response.status}.`);
  }

  return {
    sent: true,
    provider: "graph",
  };
}
