/**
 * Approved PTO Calendar Sync
 *
 * Creates Outlook calendar events for approved PTO requests in the dedicated
 * Microsoft 365 mailbox used by the HR platform.
 *
 * Responsibilities:
 * - Translate approved PTO data into Outlook event details
 * - Preserve duplicate protection using the stored Graph event id
 * - Log sync outcomes without affecting the approval transaction
 *
 * Business rules:
 * - Only approved requests create Outlook events
 * - Full-day requests are created as all-day events with an exclusive end date
 * - Partial single-day requests become timed events
 *
 * TODO: Add safe update/delete handling when approved requests are later
 * changed or canceled.
 */
import { prisma } from "../../db";
import { dateToDateOnlyString, parseDateOnly } from "../../date-only";
import { getEmailRuntimeConfig } from "../email/send-email";
import { createGraphCalendarEvent } from "./graph-calendar-transport";
import { logCalendarNotificationEvent } from "./logger";

function toDateOnly(value: Date) {
  return dateToDateOnlyString(value);
}

function addDays(dateOnly: string, days: number) {
  const value = parseDateOnly(dateOnly);

  if (!value) {
    throw new Error(`Invalid date-only value: ${dateOnly}`);
  }

  value.setDate(value.getDate() + days);
  return dateToDateOnlyString(value);
}

function countWeekdaysInclusive(start: Date, end: Date) {
  const current = parseDateOnly(toDateOnly(start));
  const finalDate = parseDateOnly(toDateOnly(end));

  if (!current || !finalDate) {
    return 0;
  }

  let count = 0;

  while (current <= finalDate) {
    const day = current.getDay();

    if (day !== 0 && day !== 6) {
      count += 1;
    }

    current.setDate(current.getDate() + 1);
  }

  return count;
}

function buildTimedEventDateTime(dateOnly: string, offsetMinutes: number) {
  const base = new Date(`${dateOnly}T09:00:00`);
  base.setMinutes(base.getMinutes() + offsetMinutes);

  const hours = String(base.getHours()).padStart(2, "0");
  const minutes = String(base.getMinutes()).padStart(2, "0");

  return `${dateOnly}T${hours}:${minutes}:00`;
}

export function buildApprovedPtoCalendarEventDetails(input: {
  employeeName: string;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  hours: number;
  requestId: string;
  approverName?: string | null;
}) {
  const startDateOnly = toDateOnly(input.startDate);
  const endDateOnly = toDateOnly(input.endDate);
  const workdayCount = countWeekdaysInclusive(input.startDate, input.endDate);
  const expectedFullDayHours = workdayCount * 8;
  const isSingleDay = startDateOnly === endDateOnly;
  // PTO requests store hours and date span, not a detailed per-day schedule.
  // We treat a request as all-day only when the approved hours match the full
  // weekday span implied by the request dates.
  const isAllDay =
    expectedFullDayHours > 0 &&
    Math.abs(input.hours - expectedFullDayHours) < 0.01;

  const bodyLines = [
    `${input.leaveType} request approved for ${input.employeeName}.`,
    `Request ID: ${input.requestId}`,
    `Hours: ${input.hours.toFixed(2)}`,
    `Dates: ${startDateOnly} to ${endDateOnly}`,
  ];

  if (input.approverName) {
    bodyLines.push(`Approved by: ${input.approverName}`);
  }

  if (isAllDay || !isSingleDay) {
    return {
      subject: `PTO - ${input.employeeName}`,
      body: bodyLines.join("\n"),
      transactionId: `pto-request:${input.requestId}`,
      isAllDay: true as const,
      start: { date: startDateOnly },
      end: { date: addDays(endDateOnly, 1) },
    };
  }

  return {
    subject: `PTO - ${input.employeeName}`,
    body: bodyLines.join("\n"),
    transactionId: `pto-request:${input.requestId}`,
    isAllDay: false as const,
    start: {
      dateTime: buildTimedEventDateTime(startDateOnly, 0),
      timeZone: "Central Standard Time",
    },
    end: {
      dateTime: buildTimedEventDateTime(
        startDateOnly,
        Math.max(Math.round(input.hours * 60), 30)
      ),
      timeZone: "Central Standard Time",
    },
  };
}

export async function createApprovedPtoCalendarEvent(input: {
  requestId: string;
}) {
  const config = getEmailRuntimeConfig();
  const mailbox = config.graphMailboxUserId || "unconfigured";

  const request = await prisma.pTORequest.findUnique({
    where: { id: input.requestId },
    select: {
      id: true,
      employeeId: true,
      leaveType: true,
      startDate: true,
      endDate: true,
      hours: true,
      status: true,
      approverId: true,
      graphCalendarEventId: true,
      approvalComment: true,
      decisionAt: true,
      decidedBy: true,
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!request) {
    await logCalendarNotificationEvent({
      eventType: "PTO_APPROVED_CALENDAR_SYNC",
      mailbox,
      relatedRequestId: input.requestId,
      outcome: "skipped",
      reason: "PTO request not found when preparing calendar event.",
    });
    return;
  }

  const requestWithEmployee = request;

  if (requestWithEmployee.status !== "APPROVED") {
    await logCalendarNotificationEvent({
      eventType: "PTO_APPROVED_CALENDAR_SYNC",
      mailbox,
      relatedRequestId: requestWithEmployee.id,
      relatedEmployeeId: requestWithEmployee.employeeId,
      outcome: "skipped",
      reason: "PTO request is not approved.",
    });
    return;
  }

  // Duplicate protection: once a PTO request has been linked to a Graph event,
  // retries should skip rather than create another Outlook entry.
  if (requestWithEmployee.graphCalendarEventId) {
    await logCalendarNotificationEvent({
      eventType: "PTO_APPROVED_CALENDAR_SYNC",
      mailbox,
      relatedRequestId: requestWithEmployee.id,
      relatedEmployeeId: requestWithEmployee.employeeId,
      outcome: "skipped",
      graphEventId: requestWithEmployee.graphCalendarEventId,
      reason: "Calendar event already linked to PTO request.",
    });
    return;
  }

  const approver =
    requestWithEmployee.decidedBy || requestWithEmployee.approverId
      ? await prisma.employee.findUnique({
          where: {
            id:
              requestWithEmployee.decidedBy ||
              requestWithEmployee.approverId ||
              "",
          },
          select: {
            firstName: true,
            lastName: true,
          },
        })
      : null;

  try {
    const eventDetails = buildApprovedPtoCalendarEventDetails({
      employeeName: `${requestWithEmployee.employee.firstName} ${requestWithEmployee.employee.lastName}`,
      leaveType: requestWithEmployee.leaveType,
      startDate: requestWithEmployee.startDate,
      endDate: requestWithEmployee.endDate,
      hours: requestWithEmployee.hours,
      requestId: requestWithEmployee.id,
      approverName: approver
        ? `${approver.firstName} ${approver.lastName}`.trim()
        : null,
    });

    const result = await createGraphCalendarEvent(eventDetails);

    if (!result.created) {
      await logCalendarNotificationEvent({
        eventType: "PTO_APPROVED_CALENDAR_SYNC",
        mailbox,
        relatedRequestId: requestWithEmployee.id,
        relatedEmployeeId: requestWithEmployee.employeeId,
        outcome: "skipped",
        reason: result.reason,
      });
      return;
    }

    await prisma.pTORequest.update({
      where: {
        id: requestWithEmployee.id,
      },
      data: {
        graphCalendarEventId: result.graphEventId,
      },
    });

    await logCalendarNotificationEvent({
      eventType: "PTO_APPROVED_CALENDAR_SYNC",
      mailbox,
      relatedRequestId: requestWithEmployee.id,
      relatedEmployeeId: requestWithEmployee.employeeId,
      outcome: "created",
      graphEventId: result.graphEventId,
    });
  } catch (error) {
    await logCalendarNotificationEvent({
      eventType: "PTO_APPROVED_CALENDAR_SYNC",
      mailbox,
      relatedRequestId: requestWithEmployee.id,
      relatedEmployeeId: requestWithEmployee.employeeId,
      outcome: "failed",
      errorSummary:
        error instanceof Error ? `${error.name}: ${error.message}` : "Unknown calendar sync error.",
    });
  }
}
