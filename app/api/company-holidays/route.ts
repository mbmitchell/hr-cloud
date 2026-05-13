import { NextResponse } from "next/server";

import { prisma } from "../../../lib/db";
import { parseDateOnly } from "../../../lib/date-only";
import {
  getCompanyHolidaySummary,
  listCompanyHolidays,
  serializeCompanyHoliday,
} from "../../../lib/company-holidays/service";
import {
  isAuthorizationError,
  requireActor,
} from "../../../lib/server/authorization";

export async function GET(request: Request) {
  try {
    await requireActor();

    const { searchParams } = new URL(request.url);
    const yearValue = String(searchParams.get("year") || "").trim();
    const startDateValue = String(searchParams.get("startDate") || "").trim();
    const endDateValue = String(searchParams.get("endDate") || "").trim();

    if (startDateValue || endDateValue) {
      const startDate = parseDateOnly(startDateValue);
      const endDate = parseDateOnly(endDateValue);

      if (!startDate || !endDate) {
        return NextResponse.json(
          { error: "startDate and endDate must be valid date-only values." },
          { status: 400 }
        );
      }

      if (endDate < startDate) {
        return NextResponse.json(
          { error: "End date cannot be earlier than start date." },
          { status: 400 }
        );
      }

      const { holidays, summary } = await getCompanyHolidaySummary(prisma, {
        startDate,
        endDate,
      });

      return NextResponse.json({
        holidays: holidays.map(serializeCompanyHoliday),
        summary,
      });
    }

    const parsedYear = Number(yearValue || new Date().getFullYear());

    if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
      return NextResponse.json(
        { error: "year must be a valid four-digit year." },
        { status: 400 }
      );
    }

    const holidays = await listCompanyHolidays(prisma, {
      year: parsedYear,
      includeInactive: false,
      countsAsCompanyHolidayOnly: true,
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
