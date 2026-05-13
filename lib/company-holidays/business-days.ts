import { dateToDateOnlyString, parseDateOnly } from "../date-only";

const HOURS_PER_WORKDAY = 8;

function toDateOnlyDate(value: Date | string) {
  if (typeof value === "string") {
    return parseDateOnly(value);
  }

  return parseDateOnly(dateToDateOnlyString(value));
}

export function roundHours(value: number) {
  return Number(value.toFixed(2));
}

export type BusinessDaySummary = {
  businessDayCount: number;
  holidayDates: string[];
  weekendDates: string[];
  eligibleHours: number;
};

export function summarizeBusinessDaysInclusive(input: {
  startDate: Date | string;
  endDate: Date | string;
  companyHolidayDates?: Iterable<string>;
}) {
  const startDate = toDateOnlyDate(input.startDate);
  const endDate = toDateOnlyDate(input.endDate);

  if (!startDate || !endDate || endDate < startDate) {
    return {
      businessDayCount: 0,
      holidayDates: [],
      weekendDates: [],
      eligibleHours: 0,
    } satisfies BusinessDaySummary;
  }

  const holidayDateSet = new Set(input.companyHolidayDates ?? []);
  const current = new Date(startDate);
  const holidayDates: string[] = [];
  const weekendDates: string[] = [];
  let businessDayCount = 0;

  while (current <= endDate) {
    const dateOnly = dateToDateOnlyString(current);
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidayDateSet.has(dateOnly);

    if (isWeekend) {
      weekendDates.push(dateOnly);
    } else if (isHoliday) {
      holidayDates.push(dateOnly);
    } else {
      businessDayCount += 1;
    }

    current.setDate(current.getDate() + 1);
  }

  return {
    businessDayCount,
    holidayDates,
    weekendDates,
    eligibleHours: roundHours(businessDayCount * HOURS_PER_WORKDAY),
  } satisfies BusinessDaySummary;
}
