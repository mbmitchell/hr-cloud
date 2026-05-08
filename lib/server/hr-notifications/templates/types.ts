import type { HrNotificationPayload } from "../types";
import type { HrNotificationTemplateKey } from "../types";

export type HrNotificationTemplateRenderResult = {
  subject: string;
  body: string;
};

export type HrNotificationTemplateRenderer = (
  payload: HrNotificationPayload
) => HrNotificationTemplateRenderResult;

export type HrNotificationTemplateDefinition = {
  key: HrNotificationTemplateKey;
  render: HrNotificationTemplateRenderer;
};
