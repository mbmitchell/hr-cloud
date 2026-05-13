import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "../../../../../lib/db";
import { dateToDateOnlyString, parseDateOnly } from "../../../../../lib/date-only";
import { serializeCompanyHoliday } from "../../../../../lib/company-holidays/service";
import {
  isAuthorizationError,
  requireAdmin,
} from "../../../../../lib/server/authorization";
import { writeAuditLog } from "../../../../../lib/server/audit/write-audit-log";

function getHolidayYear(date: Date) {
  return Number(dateToDateOnlyString(date).slice(0, 4));
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAdmin({
      attemptedAction: "COMPANY_HOLIDAY_UPDATE",
      entityType: "CompanyHoliday",
    });
    const { id } = await context.params;
    const holidayId = String(id || "").trim();

    if (!holidayId) {
      return NextResponse.json({ error: "Holiday ID is required." }, { status: 400 });
    }

    const body = await request.json();
    const existingHoliday = await prisma.companyHoliday.findUnique({
      where: { id: holidayId },
    });

    if (!existingHoliday) {
      return NextResponse.json({ error: "Holiday not found." }, { status: 404 });
    }

    const name = String(body.name || "").trim();
    const dateValue = String(body.date || "").trim();
    const parsedDate = parseDateOnly(dateValue);
    const notes = body.notes ? String(body.notes).trim() : null;
    const countsAsCompanyHoliday =
      body.countsAsCompanyHoliday == null
        ? existingHoliday.countsAsCompanyHoliday
        : Boolean(body.countsAsCompanyHoliday);
    const isActive =
      body.isActive == null ? existingHoliday.isActive : Boolean(body.isActive);

    if (!name || !parsedDate) {
      return NextResponse.json(
        { error: "Holiday name and date are required." },
        { status: 400 }
      );
    }

    const updatedHoliday = await prisma.$transaction(async (tx) => {
      const updated = await tx.companyHoliday.update({
        where: { id: holidayId },
        data: {
          name,
          date: parsedDate,
          year: getHolidayYear(parsedDate),
          countsAsCompanyHoliday,
          isActive,
          notes,
        },
      });

      await writeAuditLog(tx, {
        userId: actor.id,
        action: "COMPANY_HOLIDAY_UPDATED",
        entityType: "CompanyHoliday",
        entityId: updated.id,
        oldValue: {
          name: existingHoliday.name,
          date: dateToDateOnlyString(existingHoliday.date),
          year: existingHoliday.year,
          source: existingHoliday.source,
          countsAsCompanyHoliday: existingHoliday.countsAsCompanyHoliday,
          isActive: existingHoliday.isActive,
          notes: existingHoliday.notes,
        },
        newValue: {
          name: updated.name,
          date: dateToDateOnlyString(updated.date),
          year: updated.year,
          source: updated.source,
          countsAsCompanyHoliday: updated.countsAsCompanyHoliday,
          isActive: updated.isActive,
          notes: updated.notes,
        },
      });

      return updated;
    });

    return NextResponse.json({
      holiday: serializeCompanyHoliday(updatedHoliday),
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
      { error: "Failed to update company holiday." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAdmin({
      attemptedAction: "COMPANY_HOLIDAY_DELETE",
      entityType: "CompanyHoliday",
    });
    const { id } = await context.params;
    const holidayId = String(id || "").trim();

    if (!holidayId) {
      return NextResponse.json({ error: "Holiday ID is required." }, { status: 400 });
    }

    const existingHoliday = await prisma.companyHoliday.findUnique({
      where: { id: holidayId },
    });

    if (!existingHoliday) {
      return NextResponse.json({ error: "Holiday not found." }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.companyHoliday.delete({
        where: { id: holidayId },
      });

      await writeAuditLog(tx, {
        userId: actor.id,
        action: "COMPANY_HOLIDAY_DELETED",
        entityType: "CompanyHoliday",
        entityId: holidayId,
        oldValue: {
          name: existingHoliday.name,
          date: dateToDateOnlyString(existingHoliday.date),
          year: existingHoliday.year,
          source: existingHoliday.source,
          countsAsCompanyHoliday: existingHoliday.countsAsCompanyHoliday,
          isActive: existingHoliday.isActive,
          notes: existingHoliday.notes,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete company holiday." },
      { status: 500 }
    );
  }
}
