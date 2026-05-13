import { dateToDateOnlyString } from "../date-only";

const FEDERAL_HOLIDAY_DEFINITIONS = [
  {
    code: "NEW_YEARS_DAY",
    name: "New Year's Day",
    resolveDate: (year: number) => getObservedFixedHolidayDate(year, 0, 1),
  },
  {
    code: "MARTIN_LUTHER_KING_JR_DAY",
    name: "Martin Luther King Jr. Day",
    resolveDate: (year: number) => getNthWeekdayOfMonth(year, 0, 1, 3),
  },
  {
    code: "WASHINGTONS_BIRTHDAY",
    name: "Washington's Birthday / Presidents Day",
    resolveDate: (year: number) => getNthWeekdayOfMonth(year, 1, 1, 3),
  },
  {
    code: "MEMORIAL_DAY",
    name: "Memorial Day",
    resolveDate: (year: number) => getLastWeekdayOfMonth(year, 4, 1),
  },
  {
    code: "JUNETEENTH",
    name: "Juneteenth National Independence Day",
    resolveDate: (year: number) => getObservedFixedHolidayDate(year, 5, 19),
  },
  {
    code: "INDEPENDENCE_DAY",
    name: "Independence Day",
    resolveDate: (year: number) => getObservedFixedHolidayDate(year, 6, 4),
  },
  {
    code: "LABOR_DAY",
    name: "Labor Day",
    resolveDate: (year: number) => getNthWeekdayOfMonth(year, 8, 1, 1),
  },
  {
    code: "COLUMBUS_DAY",
    name: "Columbus Day / Indigenous Peoples' Day",
    resolveDate: (year: number) => getNthWeekdayOfMonth(year, 9, 1, 2),
  },
  {
    code: "VETERANS_DAY",
    name: "Veterans Day",
    resolveDate: (year: number) => getObservedFixedHolidayDate(year, 10, 11),
  },
  {
    code: "THANKSGIVING_DAY",
    name: "Thanksgiving Day",
    resolveDate: (year: number) => getNthWeekdayOfMonth(year, 10, 4, 4),
  },
  {
    code: "CHRISTMAS_DAY",
    name: "Christmas Day",
    resolveDate: (year: number) => getObservedFixedHolidayDate(year, 11, 25),
  },
] as const;

function createLocalDate(year: number, monthIndex: number, day: number) {
  return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

function getObservedFixedHolidayDate(
  year: number,
  monthIndex: number,
  day: number
) {
  const holiday = createLocalDate(year, monthIndex, day);
  const dayOfWeek = holiday.getDay();

  if (dayOfWeek === 6) {
    holiday.setDate(holiday.getDate() - 1);
  } else if (dayOfWeek === 0) {
    holiday.setDate(holiday.getDate() + 1);
  }

  return holiday;
}

function getNthWeekdayOfMonth(
  year: number,
  monthIndex: number,
  weekday: number,
  occurrence: number
) {
  const firstDay = createLocalDate(year, monthIndex, 1);
  const offset = (7 + weekday - firstDay.getDay()) % 7;
  return createLocalDate(year, monthIndex, 1 + offset + (occurrence - 1) * 7);
}

function getLastWeekdayOfMonth(year: number, monthIndex: number, weekday: number) {
  const date = createLocalDate(year, monthIndex + 1, 0);

  while (date.getDay() !== weekday) {
    date.setDate(date.getDate() - 1);
  }

  return date;
}

export function buildFederalObservedHolidaysForYear(year: number) {
  return FEDERAL_HOLIDAY_DEFINITIONS.map((definition) => {
    const observedDate = definition.resolveDate(year);

    return {
      code: `FEDERAL_${definition.code}_${year}`,
      name: definition.name,
      date: observedDate,
      dateOnly: dateToDateOnlyString(observedDate),
      year,
      source: "FEDERAL_SEED" as const,
      countsAsCompanyHoliday: true,
      isActive: true,
      notes: null,
    };
  });
}
