/**
 * Email Transport Selector
 *
 * Centralizes notification runtime configuration and chooses the correct email
 * transport for the current environment.
 *
 * Responsibilities:
 * - Resolve production vs development transport
 * - Read environment-driven mail configuration
 * - Route outbound email to the appropriate transport implementation
 *
 * Infrastructure notes:
 * - Development uses a safe non-delivery transport
 * - Production uses Microsoft Graph app-only mail delivery
 */
import { sendWithDevTransport } from "./transports/dev-transport";
import { sendWithGraphTransport } from "./transports/graph-transport";
import type {
  EmailMessage,
  EmailRuntimeConfig,
  EmailSendResult,
  EmailTransportKind,
} from "./types";

export function resolveEmailTransportKind(
  env: Record<string, string | undefined> = process.env
): EmailTransportKind {
  const configuredTransport = env.EMAIL_TRANSPORT?.trim().toLowerCase();

  if (configuredTransport === "graph") {
    return "graph";
  }

  if (configuredTransport === "dev") {
    return "dev";
  }

  return env.NODE_ENV === "production" ? "graph" : "dev";
}

/**
 * Reads runtime email configuration from environment variables.
 */
export function getEmailRuntimeConfig(
  env: Record<string, string | undefined> = process.env
): EmailRuntimeConfig {
  return {
    transport: resolveEmailTransportKind(env),
    from: env.EMAIL_FROM?.trim() || "",
    replyTo: env.EMAIL_REPLY_TO?.trim() || null,
    appBaseUrl: env.APP_BASE_URL?.trim() || env.NEXTAUTH_URL?.trim() || "",
    graphTenantId: env.GRAPH_TENANT_ID?.trim() || "",
    graphClientId: env.GRAPH_CLIENT_ID?.trim() || "",
    graphClientSecret: env.GRAPH_CLIENT_SECRET?.trim() || "",
    graphMailboxUserId: env.GRAPH_MAILBOX_USER_ID?.trim() || "",
  };
}

/**
 * Sends a single email message through the selected transport.
 */
export async function sendEmail(
  message: EmailMessage
): Promise<EmailSendResult> {
  const config = getEmailRuntimeConfig();
  const normalizedMessage = {
    ...message,
    replyTo: message.replyTo ?? config.replyTo,
  };

  if (config.transport === "graph") {
    return sendWithGraphTransport(normalizedMessage, config);
  }

  return sendWithDevTransport(normalizedMessage, config.from);
}
