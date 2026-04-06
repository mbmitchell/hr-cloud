export type CalendarNotificationOutcome = "created" | "skipped" | "failed";

export type CalendarNotificationLogInput = {
  eventType: string;
  mailbox: string;
  relatedRequestId: string;
  relatedEmployeeId?: string | null;
  outcome: CalendarNotificationOutcome;
  graphEventId?: string | null;
  reason?: string | null;
  errorSummary?: string | null;
};

export type CalendarCreateResult =
  | {
      created: true;
      graphEventId: string;
      provider: "graph";
    }
  | {
      created: false;
      skipped: true;
      provider: "graph";
      reason: string;
    };
