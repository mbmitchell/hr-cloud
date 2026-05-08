import { prisma } from "../../db";
import { writeAuditLog } from "../../server/audit/write-audit-log";
import type { CalendarNotificationLogInput } from "./types";

export async function logCalendarNotificationEvent(
  input: CalendarNotificationLogInput
) {
  const action =
    input.outcome === "created"
      ? "CALENDAR_EVENT_CREATED"
      : input.outcome === "skipped"
        ? "CALENDAR_EVENT_SKIPPED"
        : "CALENDAR_EVENT_FAILED";

  const payload = {
    timestamp: new Date().toISOString(),
    eventType: input.eventType,
    mailbox: input.mailbox,
    relatedRequestId: input.relatedRequestId,
    relatedEmployeeId: input.relatedEmployeeId ?? null,
    outcome: input.outcome,
    graphEventId: input.graphEventId ?? null,
    reason: input.reason ?? null,
    errorSummary: input.errorSummary ?? null,
  };

  try {
    await writeAuditLog(prisma, {
      userId: "system:calendar",
      action,
      entityType: "PTORequest",
      entityId: input.relatedRequestId,
      newValue: payload,
    });
  } catch (error) {
    console.error("Failed to write calendar notification audit log:", error);
  }

  const logger =
    input.outcome === "created"
      ? console.info
      : input.outcome === "skipped"
        ? console.warn
        : console.error;

  logger(JSON.stringify(payload));
}
