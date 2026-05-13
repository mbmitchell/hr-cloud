import { prisma } from "../../../lib/db";
import { dateToDateOnlyString } from "../../../lib/date-only";
import { NextResponse } from "next/server";
import { buildCompanyCalendarEventId } from "../../../lib/calendar/company-event-id";
import {
  isAuthorizationError,
  requireActor,
} from "../../../lib/server/authorization";
import { getVisibleEmployeeIds } from "../../../lib/server/employee-visibility";

export async function GET() {
  try {
    const actor = await requireActor();
    const visibleEmployeeIds = await getVisibleEmployeeIds(actor.id);

    const requests = await prisma.pTORequest.findMany({
      where: {
        employeeId: {
          in: visibleEmployeeIds,
        },
      },
      include: {
        employee: true,
      },
    });
    const holidays = await prisma.companyHoliday.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ date: "asc" }, { name: "asc" }],
    });

    const events = [
      ...requests.map((request) => ({
        id: buildCompanyCalendarEventId("PTO", request.id),
        sourceId: request.id,
        eventType: "PTO" as const,
        employeeId: request.employeeId,
        employeeName: `${request.employee.firstName} ${request.employee.lastName}`,
        title: `${request.employee.firstName} ${request.employee.lastName} • ${request.leaveType}`,
        leaveType: request.leaveType,
        start: dateToDateOnlyString(request.startDate),
        end: dateToDateOnlyString(request.endDate),
        hours: request.hours,
        status: request.status,
        notes: request.notes ?? "",
      })),
      ...holidays.map((holiday) => {
        const dateOnly = dateToDateOnlyString(holiday.date);

        return {
          id: buildCompanyCalendarEventId("HOLIDAY", holiday.id),
          sourceId: holiday.id,
          eventType: "HOLIDAY" as const,
          title: `Holiday - ${holiday.name}`,
          holidayName: holiday.name,
          start: dateOnly,
          end: dateOnly,
          status: "ACTIVE",
          notes: holiday.notes ?? "",
        };
      }),
    ];

    return NextResponse.json(events);
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to load calendar events." },
      { status: 500 }
    );
  }
}
