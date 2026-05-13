import { NextResponse } from "next/server";

import { prisma } from "../../../../../lib/db";
import { seedFederalCompanyHolidays } from "../../../../../lib/company-holidays/service";
import {
  isAuthorizationError,
  requireAdmin,
} from "../../../../../lib/server/authorization";
import { writeAuditLog } from "../../../../../lib/server/audit/write-audit-log";

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin({
      attemptedAction: "COMPANY_HOLIDAY_SEED",
      entityType: "CompanyHoliday",
    });
    const body = await request.json().catch(() => ({}));
    const year = Number(body.year);

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return NextResponse.json(
        { error: "year must be a valid four-digit year." },
        { status: 400 }
      );
    }

    const seededHolidays = await prisma.$transaction(async (tx) => {
      const seeded = await seedFederalCompanyHolidays(tx, year);

      await writeAuditLog(tx, {
        userId: actor.id,
        action: "COMPANY_HOLIDAYS_SEEDED",
        entityType: "CompanyHoliday",
        entityId: String(year),
        newValue: {
          year,
          seededCount: seeded.length,
          holidays: seeded,
        },
      });

      return seeded;
    });

    return NextResponse.json({
      success: true,
      seededCount: seededHolidays.length,
      holidays: seededHolidays,
    });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to seed company holidays." },
      { status: 500 }
    );
  }
}
