import { prisma } from "../../db";
import { writeAuditLog } from "../../server/audit/write-audit-log";
import type { NotificationLogInput } from "./types";

export async function logEmailNotificationEvent(input: NotificationLogInput) {
  const action =
    input.outcome === "sent"
      ? "NOTIFICATION_EMAIL_SENT"
      : input.outcome === "skipped"
        ? "NOTIFICATION_EMAIL_SKIPPED"
        : "NOTIFICATION_EMAIL_FAILED";

  const payload = {
    timestamp: new Date().toISOString(),
    eventType: input.eventType,
    category: input.category,
    recipient: input.recipient,
    provider: input.provider,
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    relatedEmployeeId: input.relatedEmployeeId ?? null,
    relatedRequestId: input.relatedRequestId ?? null,
    outcome: input.outcome,
    messageId: input.messageId ?? null,
    transportReason: input.transportReason ?? null,
    errorSummary: input.errorSummary ?? null,
  };

  try {
    await writeAuditLog(prisma, {
      userId: "system:notifications",
      action,
      entityType: input.relatedEntityType,
      entityId: input.relatedEntityId,
      newValue: payload,
    });
  } catch (error) {
    console.error("Failed to write email notification audit log:", error);
  }

  const logger =
    input.outcome === "sent"
      ? console.info
      : input.outcome === "skipped"
        ? console.warn
        : console.error;

  logger(JSON.stringify(payload));
}
