import type { HrNotificationPayload, HrNotificationTemplateKey } from "../types";
import type {
  HrNotificationTemplateDefinition,
  HrNotificationTemplateRenderResult,
} from "./types";

function readString(payload: HrNotificationPayload, key: string, fallback: string) {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

const templateDefinitions: Record<HrNotificationTemplateKey, HrNotificationTemplateDefinition> = {
  GENERIC_HR_NOTIFICATION: {
    key: "GENERIC_HR_NOTIFICATION",
    render(payload) {
      const body = readString(
        payload,
        "body",
        "A new HR notification has been queued for future delivery."
      );
      const appUrl = readString(payload, "appUrl", "");

      return {
        subject: readString(payload, "subject", "MFN HR Notification"),
        body: appUrl ? `${body}\n\nOpen in MFN HR: ${appUrl}` : body,
      };
    },
  },
  EMPLOYEE_CHANGE_REQUEST_CREATED: {
    key: "EMPLOYEE_CHANGE_REQUEST_CREATED",
    render(payload) {
      const employeeName = readString(payload, "employeeName", "An employee");
      return {
        subject: `${employeeName}: change request created`,
        body: `${employeeName} has a new employment change request ready for review.`,
      };
    },
  },
  EMPLOYEE_CHANGE_REQUEST_APPROVED: {
    key: "EMPLOYEE_CHANGE_REQUEST_APPROVED",
    render(payload) {
      const employeeName = readString(payload, "employeeName", "An employee");
      return {
        subject: `${employeeName}: change request approved`,
        body: `${employeeName}'s employment change request has been approved and is awaiting application.`,
      };
    },
  },
  EMPLOYEE_CHANGE_REQUEST_APPLIED: {
    key: "EMPLOYEE_CHANGE_REQUEST_APPLIED",
    render(payload) {
      const employeeName = readString(payload, "employeeName", "An employee");
      return {
        subject: `${employeeName}: change request applied`,
        body: `${employeeName}'s employment change request has been applied successfully.`,
      };
    },
  },
};

export function renderHrNotificationTemplate(input: {
  templateKey: HrNotificationTemplateKey;
  payload: HrNotificationPayload;
}): HrNotificationTemplateRenderResult {
  return templateDefinitions[input.templateKey].render(input.payload);
}

export function getHrNotificationTemplateDefinition(templateKey: HrNotificationTemplateKey) {
  return templateDefinitions[templateKey];
}
