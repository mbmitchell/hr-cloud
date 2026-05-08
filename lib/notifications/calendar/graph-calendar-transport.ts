import { graphApiRequest, hasRequiredGraphConfig } from "../graph/client";
import { getEmailRuntimeConfig } from "../email/send-email";
import type { CalendarCreateResult } from "./types";

type GraphEventDateTime = {
  dateTime: string;
  timeZone: string;
};

export type GraphCalendarEventInput =
  | {
      subject: string;
      body: string;
      transactionId: string;
      isAllDay: true;
      start: {
        date: string;
      };
      end: {
        date: string;
      };
    }
  | {
      subject: string;
      body: string;
      transactionId: string;
      isAllDay: false;
      start: GraphEventDateTime;
      end: GraphEventDateTime;
    };

const graphCalendarTimeZone = "Central Standard Time";

export async function createGraphCalendarEvent(
  event: GraphCalendarEventInput
): Promise<CalendarCreateResult> {
  const config = getEmailRuntimeConfig();

  if (!hasRequiredGraphConfig(config)) {
    return {
      created: false,
      skipped: true,
      provider: "graph",
      reason:
        "Graph calendar delivery is not fully configured. GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, and GRAPH_MAILBOX_USER_ID are required.",
    };
  }

  const payload = event.isAllDay
    ? {
        subject: event.subject,
        body: {
          contentType: "Text",
          content: event.body,
        },
        isAllDay: true,
        start: {
          dateTime: `${event.start.date}T00:00:00`,
          timeZone: graphCalendarTimeZone,
        },
        end: {
          dateTime: `${event.end.date}T00:00:00`,
          timeZone: graphCalendarTimeZone,
        },
        transactionId: event.transactionId,
      }
    : {
        subject: event.subject,
        body: {
          contentType: "Text",
          content: event.body,
        },
        isAllDay: false,
        start: event.start,
        end: event.end,
        transactionId: event.transactionId,
      };

  const response = await graphApiRequest(
    config,
    `/users/${encodeURIComponent(config.graphMailboxUserId)}/calendar/events`,
    {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        Prefer: `outlook.timezone="${graphCalendarTimeZone}"`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Graph calendar event create failed with status ${response.status}.`
    );
  }

  const createdEvent = await response.json();
  const graphEventId =
    typeof createdEvent.id === "string" ? createdEvent.id : null;

  if (!graphEventId) {
    throw new Error("Graph calendar event response did not include an event id.");
  }

  return {
    created: true,
    provider: "graph",
    graphEventId,
  };
}
