import { dateToDateOnlyString, parseDateOnly } from "../date-only";
import {
  roundHours,
  summarizeBusinessDaysInclusive,
  type BusinessDaySummary,
} from "./business-days";
import { buildFederalObservedHolidaysForYear } from "./federal";

type CompanyHolidayListClient = {
  companyHoliday: {
    findMany(args: unknown): Promise<
      Array<{
        id: string;
        code: string | null;
        name: string;
        date: Date;
        year: number;
        source: "FEDERAL_SEED" | "MANUAL";
        countsAsCompanyHoliday: boolean;
        isActive: boolean;
        notes: string | null;
        createdAt: Date;
        updatedAt: Date;
      }>
    >;
    upsert(args: unknown): Promise<unknown>;
  };
};

function createRangeBoundsForYear(year: number) {
  return {
    startDate: new Date(year, 0, 1, 12, 0, 0, 0),
    endDate: new Date(year, 11, 31, 12, 0, 0, 0),
  };
}

export function serializeCompanyHoliday(holiday: {
  id: string;
  code: string | null;
  name: string;
  date: Date;
  year: number;
  source: "FEDERAL_SEED" | "MANUAL";
  countsAsCompanyHoliday: boolean;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...holiday,
    date: dateToDateOnlyString(holiday.date),
    createdAt: holiday.createdAt.toISOString(),
    updatedAt: holiday.updatedAt.toISOString(),
  };
}

export async function listCompanyHolidays(
  client: CompanyHolidayListClient,
  input: {
    year?: number;
    startDate?: Date;
    endDate?: Date;
    includeInactive?: boolean;
    countsAsCompanyHolidayOnly?: boolean;
  }
) {
  const yearBounds =
    input.year != null ? createRangeBoundsForYear(input.year) : null;

  const startDate = input.startDate ?? (input.year == null ? yearBounds?.startDate : null);
  const endDate = input.endDate ?? (input.year == null ? yearBounds?.endDate : null);

  return client.companyHoliday.findMany({
    where: {
      ...(input.year != null
        ? {
            year: input.year,
          }
        : {}),
      ...(input.includeInactive ? {} : { isActive: true }),
      ...(input.countsAsCompanyHolidayOnly
        ? { countsAsCompanyHoliday: true }
        : {}),
      ...(startDate && endDate
        ? {
            date: {
              gte: startDate,
              lte: endDate,
            },
          }
        : {}),
    },
    orderBy: [{ date: "asc" }, { name: "asc" }],
  });
}

export async function getCompanyHolidaySummary(
  client: CompanyHolidayListClient,
  input: {
    startDate: Date;
    endDate: Date;
  }
) {
  const holidays = await listCompanyHolidays(client, {
    startDate: input.startDate,
    endDate: input.endDate,
    includeInactive: false,
    countsAsCompanyHolidayOnly: true,
  });

  const summary = summarizeBusinessDaysInclusive({
    startDate: input.startDate,
    endDate: input.endDate,
    companyHolidayDates: holidays.map((holiday) => dateToDateOnlyString(holiday.date)),
  });

  return {
    holidays,
    summary,
  };
}

export type ResolvedPtoRequestHours = {
  hours: number;
  summary: BusinessDaySummary;
};

export async function resolvePtoRequestHours(
  client: CompanyHolidayListClient,
  input: {
    startDate: Date;
    endDate: Date;
    requestedHours: number;
  }
): Promise<
  | { ok: true; value: ResolvedPtoRequestHours }
  | { ok: false; error: string; summary: BusinessDaySummary }
> {
  const { summary } = await getCompanyHolidaySummary(client, {
    startDate: input.startDate,
    endDate: input.endDate,
  });

  if (summary.businessDayCount === 0) {
    return {
      ok: false,
      error:
        "Selected dates do not include any working days after weekends and company holidays.",
      summary,
    };
  }

  if (!Number.isFinite(input.requestedHours) || input.requestedHours <= 0) {
    return {
      ok: false,
      error: "Hours must be greater than zero.",
      summary,
    };
  }

  const roundedRequestedHours = roundHours(input.requestedHours);

  if (roundedRequestedHours - summary.eligibleHours > 0.01) {
    return {
      ok: false,
      error: `Selected dates allow up to ${summary.eligibleHours.toFixed(
        2
      )} hours after excluding weekends and company holidays.`,
      summary,
    };
  }

  return {
    ok: true,
    value: {
      hours: roundedRequestedHours,
      summary,
    },
  };
}

export async function seedFederalCompanyHolidays(
  client: CompanyHolidayListClient,
  year: number
) {
  const seedEntries = buildFederalObservedHolidaysForYear(year);

  for (const holiday of seedEntries) {
    await client.companyHoliday.upsert({
      where: {
        code: holiday.code,
      },
      update: {},
      create: {
        code: holiday.code,
        name: holiday.name,
        date: holiday.date,
        year: holiday.year,
        source: "FEDERAL_SEED",
        countsAsCompanyHoliday: holiday.countsAsCompanyHoliday,
        isActive: holiday.isActive,
        notes: holiday.notes,
      },
    });
  }

  return seedEntries.map((holiday) => ({
    code: holiday.code,
    name: holiday.name,
    date: holiday.dateOnly,
    year: holiday.year,
  }));
}

export function parseHolidayDateOnly(dateOnly: string) {
  return parseDateOnly(dateOnly);
}
