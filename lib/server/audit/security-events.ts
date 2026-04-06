import { prisma } from "../../db";
import { writeAuditLog } from "./write-audit-log";

/**
 * Security event codes are intentionally limited to sign-in and privileged
 * authorization decisions:
 * - `AUTH_MICROSOFT_ENTRA_*` during Microsoft 365 sign-in
 * - `AUTH_DEV_CREDENTIALS_*` during temporary dev credentials sign-in
 * - `AUTHORIZATION_DENIED` for privileged server-side authorization failures
 *
 * Only safe metadata belongs here: normalized email, employeeId, provider,
 * reason codes, and resource/action identifiers. Never include passwords,
 * cookies, tokens, secrets, or full provider profile payloads.
 */
type SecurityEventInput = {
  eventType: string;
  provider: "microsoft-entra-id" | "credentials" | "internal";
  outcome: "success" | "denied";
  reasonCode?: string;
  normalizedEmail?: string | null;
  employeeId?: string | null;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
};

export async function logSecurityEvent(input: SecurityEventInput) {
  const payload = {
    timestamp: new Date().toISOString(),
    eventType: input.eventType,
    provider: input.provider,
    outcome: input.outcome,
    normalizedEmail: input.normalizedEmail ?? null,
    employeeId: input.employeeId ?? null,
    reasonCode: input.reasonCode ?? null,
    entityType: input.entityType,
    entityId: input.entityId,
    ...(input.metadata ?? {}),
  };

  await writeAuditLog(prisma, {
    userId:
      input.employeeId && input.employeeId.trim()
        ? input.employeeId
        : `auth:${input.provider}`,
    action: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId,
    newValue: payload,
  });

  const logger = input.outcome === "denied" ? console.warn : console.info;
  logger(JSON.stringify(payload));
}
