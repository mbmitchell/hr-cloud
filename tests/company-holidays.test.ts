import test from "node:test";
import assert from "node:assert/strict";

import { parseDateOnly } from "../lib/date-only";
import {
  resolvePtoRequestHours,
  seedFederalCompanyHolidays,
} from "../lib/company-holidays/service";
import { buildFederalObservedHolidaysForYear } from "../lib/company-holidays/federal";
import { summarizeBusinessDaysInclusive } from "../lib/company-holidays/business-days";

function toDate(dateOnly: string) {
  const date = parseDateOnly(dateOnly);

  if (!date) {
    throw new Error(`Invalid test date: ${dateOnly}`);
  }

  return date;
}

function createHolidayRecord(input: {
  id: string;
  code?: string | null;
  name: string;
  date: string;
  year: number;
  source?: "FEDERAL_SEED" | "MANUAL";
  countsAsCompanyHoliday?: boolean;
  isActive?: boolean;
  notes?: string | null;
}) {
  return {
    id: input.id,
    code: input.code ?? null,
    name: input.name,
    date: toDate(input.date),
    year: input.year,
    source: input.source ?? "MANUAL",
    countsAsCompanyHoliday: input.countsAsCompanyHoliday ?? true,
    isActive: input.isActive ?? true,
    notes: input.notes ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createHolidayClient(initialHolidays: ReturnType<typeof createHolidayRecord>[] = []) {
  const holidays = [...initialHolidays];

  return {
    holidays,
    client: {
      companyHoliday: {
        async findMany(args: {
          where?: {
            year?: number;
            isActive?: boolean;
            countsAsCompanyHoliday?: boolean;
            date?: {
              gte: Date;
              lte: Date;
            };
          };
        }) {
          const where = args.where ?? {};

          return holidays.filter((holiday) => {
            if (where.year != null && holiday.year !== where.year) {
              return false;
            }

            if (
              where.isActive != null &&
              holiday.isActive !== where.isActive
            ) {
              return false;
            }

            if (
              where.countsAsCompanyHoliday != null &&
              holiday.countsAsCompanyHoliday !== where.countsAsCompanyHoliday
            ) {
              return false;
            }

            if (where.date) {
              if (holiday.date < where.date.gte || holiday.date > where.date.lte) {
                return false;
              }
            }

            return true;
          });
        },
        async upsert(args: {
          where: { code: string };
          create: {
            code: string;
            name: string;
            date: Date;
            year: number;
            source: "FEDERAL_SEED" | "MANUAL";
            countsAsCompanyHoliday: boolean;
            isActive: boolean;
            notes: string | null;
          };
        }) {
          const existing = holidays.find(
            (holiday) => holiday.code === args.where.code
          );

          if (existing) {
            return existing;
          }

          const created = createHolidayRecord({
            id: args.where.code,
            code: args.create.code,
            name: args.create.name,
            date: args.create.date.toISOString().slice(0, 10),
            year: args.create.year,
            source: args.create.source,
            countsAsCompanyHoliday: args.create.countsAsCompanyHoliday,
            isActive: args.create.isActive,
            notes: args.create.notes,
          });

          holidays.push(created);
          return created;
        },
      },
    },
  };
}

test("single-day PTO on a normal workday deducts one business day and eight hours", () => {
  const summary = summarizeBusinessDaysInclusive({
    startDate: "2026-05-13",
    endDate: "2026-05-13",
  });

  assert.equal(summary.businessDayCount, 1);
  assert.equal(summary.eligibleHours, 8);
});

test("PTO on Saturday or Sunday deducts zero hours", () => {
  const summary = summarizeBusinessDaysInclusive({
    startDate: "2026-05-16",
    endDate: "2026-05-17",
  });

  assert.equal(summary.businessDayCount, 0);
  assert.equal(summary.eligibleHours, 0);
});

test("PTO on a configured company holiday deducts zero hours", async () => {
  const { client } = createHolidayClient([
    createHolidayRecord({
      id: "holiday-1",
      name: "Company Holiday",
      date: "2026-07-03",
      year: 2026,
    }),
  ]);

  const result = await resolvePtoRequestHours(client, {
    startDate: toDate("2026-07-03"),
    endDate: toDate("2026-07-03"),
    requestedHours: 8,
  });

  assert.equal(result.ok, false);

  if (result.ok) {
    throw new Error("Expected weekend/holiday-only request to be rejected.");
  }

  assert.equal(result.summary.businessDayCount, 0);
  assert.equal(result.summary.eligibleHours, 0);
});

test("Friday through Monday with a Monday holiday deducts only Friday", () => {
  const summary = summarizeBusinessDaysInclusive({
    startDate: "2026-09-04",
    endDate: "2026-09-07",
    companyHolidayDates: ["2026-09-07"],
  });

  assert.equal(summary.businessDayCount, 1);
  assert.equal(summary.eligibleHours, 8);
});

test("multi-day PTO spanning a weekend and holiday counts only business days", () => {
  const summary = summarizeBusinessDaysInclusive({
    startDate: "2026-11-25",
    endDate: "2026-11-30",
    companyHolidayDates: ["2026-11-26"],
  });

  assert.equal(summary.businessDayCount, 3);
  assert.equal(summary.eligibleHours, 24);
});

test("federal holiday seed calculates observed dates for a year", () => {
  const holidays = buildFederalObservedHolidaysForYear(2027);

  const independenceDay = holidays.find((holiday) =>
    holiday.code.includes("INDEPENDENCE_DAY")
  );
  const christmasDay = holidays.find((holiday) =>
    holiday.code.includes("CHRISTMAS_DAY")
  );

  assert.equal(independenceDay?.dateOnly, "2027-07-05");
  assert.equal(christmasDay?.dateOnly, "2027-12-24");
});

test("re-running the federal holiday seed is idempotent", async () => {
  const { client, holidays } = createHolidayClient();

  await seedFederalCompanyHolidays(client, 2026);
  await seedFederalCompanyHolidays(client, 2026);

  assert.equal(holidays.length, 11);
  assert.equal(new Set(holidays.map((holiday) => holiday.code)).size, 11);
});
