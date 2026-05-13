import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "../../../../lib/db";
import { dateToDateOnlyString, parseDateOnly } from "../../../../lib/date-only";
import {
  listCompanyHolidays,
  serializeCompanyHoliday,
} from "../../../../lib/company-holidays/service";
import {
  isAuthorizationError,
  requireAdmin,
} from "../../../../lib/server/authorization";
import { writeAuditLog } from "../../../../lib/server/audit/write-audit-log";

function getHolidayYear(date: Date) {
  return Number(dateToDateOnlyString(date).slice(0, 4));
}

export async function GET(request: Request) {
  try {
    await requireAdmin({
      attemptedAction: "COMPANY_HOLIDAY_LIST",
      entityType: "CompanyHoliday",
    });

    const { searchParams } = new URL(request.url);
    const yearValue = String(searchParams.get("year") || "").trim();
    const parsedYear = Number(yearValue || new Date().getFullYear());

    if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
      return NextResponse.json(
        { error: "year must be a valid four-digit year." },
        { status: 400 }
      );
    }

    const holidays = await listCompanyHolidays(prisma, {
      year: parsedYear,
      includeInactive: true,
    });

    return NextResponse.json({
      holidays: holidays.map(serializeCompanyHoliday),
    });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to load company holidays." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin({
      attemptedAction: "COMPANY_HOLIDAY_CREATE",
      entityType: "CompanyHoliday",
    });
    const body = await request.json();

    const name = String(body.name || "").trim();
    const dateValue = String(body.date || "").trim();
    const notes = body.notes ? String(body.notes).trim() : null;
    const countsAsCompanyHoliday =
      body.countsAsCompanyHoliday == null
        ? true
        : Boolean(body.countsAsCompanyHoliday);
    const isActive = body.isActive == null ? true : Boolean(body.isActive);
    const parsedDate = parseDateOnly(dateValue);

    if (!name || !parsedDate) {
      return NextResponse.json(
        { error: "Holiday name and date are required." },
        { status: 400 }
      );
    }

    const holiday = await prisma.$transaction(async (tx) => {
      const created = await tx.companyHoliday.create({
        data: {
          name,
          date: parsedDate,
          year: getHolidayYear(parsedDate),
          source: "MANUAL",
          countsAsCompanyHoliday,
          isActive,
          notes,
        },
      });

      await writeAuditLog(tx, {
        userId: actor.id,
        action: "COMPANY_HOLIDAY_CREATED",
        entityType: "CompanyHoliday",
        entityId: created.id,
        newValue: {
          name: created.name,
          date: dateToDateOnlyString(created.date),
          year: created.year,
          source: created.source,
          countsAsCompanyHoliday: created.countsAsCompanyHoliday,
          isActive: created.isActive,
          notes: created.notes,
        },
      });

      return created;
    });

    return NextResponse.json({
      holiday: serializeCompanyHoliday(holiday),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "A holiday already exists for that date." },
        { status: 409 }
      );
    }

    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to create company holiday." },
      { status: 500 }
    );
  }
}
