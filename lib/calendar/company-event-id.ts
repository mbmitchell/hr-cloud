export type CompanyCalendarEventType = "PTO" | "HOLIDAY";

const PTO_PREFIX = "pto_";
const HOLIDAY_PREFIX = "holiday_";

export function buildCompanyCalendarEventId(
  eventType: CompanyCalendarEventType,
  sourceId: string
) {
  return `${eventType === "HOLIDAY" ? HOLIDAY_PREFIX : PTO_PREFIX}${sourceId}`;
}

export function parseCompanyCalendarEventId(value: string): {
  eventType: CompanyCalendarEventType;
  sourceId: string;
} | null {
  if (value.startsWith(PTO_PREFIX)) {
    return {
      eventType: "PTO",
      sourceId: value.slice(PTO_PREFIX.length),
    };
  }

  if (value.startsWith(HOLIDAY_PREFIX)) {
    return {
      eventType: "HOLIDAY",
      sourceId: value.slice(HOLIDAY_PREFIX.length),
    };
  }

  return null;
}
