import type { EmailMessage, EmailRuntimeConfig, EmailSendResult } from "../types";

type CachedGraphToken = {
  accessToken: string;
  expiresAt: number;
};

let cachedToken: CachedGraphToken | null = null;

function requiredGraphConfig(config: EmailRuntimeConfig) {
  if (
    !config.graphTenantId ||
    !config.graphClientId ||
    !config.graphClientSecret ||
    !config.graphMailboxUserId
  ) {
    return null;
  }

  return config;
}

async function getGraphAccessToken(config: EmailRuntimeConfig) {
  const now = Date.now();

  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.accessToken;
  }

  const tokenUrl = `https://login.microsoftonline.com/${config.graphTenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: config.graphClientId,
    client_secret: config.graphClientSecret,
    grant_type: "client_credentials",
    scope: "https://graph.microsoft.com/.default",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Graph token request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const accessToken =
    typeof payload.access_token === "string" ? payload.access_token : null;
  const expiresIn =
    typeof payload.expires_in === "number" ? payload.expires_in : 3600;

  if (!accessToken) {
    throw new Error("Graph token response did not include an access token.");
  }

  cachedToken = {
    accessToken,
    expiresAt: now + expiresIn * 1000,
  };

  return accessToken;
}

export async function sendWithGraphTransport(
  message: EmailMessage,
  config: EmailRuntimeConfig
): Promise<EmailSendResult> {
  const requiredConfig = requiredGraphConfig(config);

  if (!requiredConfig) {
    return {
      sent: false,
      skipped: true,
      provider: "graph",
      reason:
        "Graph mail delivery is not fully configured. GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, and GRAPH_MAILBOX_USER_ID are required.",
    };
  }

  const accessToken = await getGraphAccessToken(requiredConfig);
  const recipients = Array.isArray(message.to) ? message.to : [message.to];

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(requiredConfig.graphMailboxUserId)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
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
