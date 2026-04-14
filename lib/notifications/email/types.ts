export type EmailTransportKind = "dev" | "graph";

export type EmailAttachment = {
  filename: string;
  contentType: string;
  contentBase64: string;
};

export type EmailMessage = {
  to: string | string[];
  subject: string;
  text: string;
  replyTo?: string | null;
  attachments?: EmailAttachment[];
};

export type EmailSendResult =
  | {
      sent: true;
      provider: EmailTransportKind;
      messageId?: string;
      preview?: string;
    }
  | {
      sent: false;
      skipped: true;
      provider: EmailTransportKind;
      reason: string;
    };

export type NotificationLogInput = {
  eventType: string;
  category: "hr-notification";
  recipient: string | string[];
  provider: EmailTransportKind;
  relatedEntityType: string;
  relatedEntityId: string;
  relatedEmployeeId?: string | null;
  relatedRequestId?: string | null;
  outcome: "sent" | "failed" | "skipped";
  errorSummary?: string | null;
  messageId?: string | null;
  transportReason?: string | null;
};

export type EmailRuntimeConfig = {
  transport: EmailTransportKind;
  from: string;
  replyTo: string | null;
  appBaseUrl: string;
  graphTenantId: string;
  graphClientId: string;
  graphClientSecret: string;
  graphMailboxUserId: string;
};
