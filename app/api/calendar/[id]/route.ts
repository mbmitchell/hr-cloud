import { prisma } from "../../../../lib/db";
import { dateToDateOnlyString } from "../../../../lib/date-only";
import { NextResponse } from "next/server";
import { getApprovalScope } from "../../../../lib/auth/access";
import { isManagerOf } from "../../../../lib/auth/permissions";
import { parseCompanyCalendarEventId } from "../../../../lib/calendar/company-event-id";
import {
  assertCanViewEmployee,
  isAuthorizationError,
  requireActor,
} from "../../../../lib/server/authorization";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireActor();
    const { id } = await params;
    const calendarEvent = parseCompanyCalendarEventId(id);

    if (!calendarEvent) {
      return NextResponse.json(
        { error: "Calendar event not found." },
        { status: 404 }
      );
    }

    if (calendarEvent.eventType === "HOLIDAY") {
      const holiday = await prisma.companyHoliday.findUnique({
        where: { id: calendarEvent.sourceId },
      });

      if (!holiday || !holiday.isActive) {
        return NextResponse.json(
          { error: "Calendar event not found." },
          { status: 404 }
        );
      }

      const canManage = actor.roles.includes("SITE_ADMIN") || actor.roles.includes("HR_ADMIN");

      return NextResponse.json({
        id,
        sourceId: holiday.id,
        eventType: "HOLIDAY",
        title: `Holiday - ${holiday.name}`,
        holidayName: holiday.name,
        startDate: dateToDateOnlyString(holiday.date),
        endDate: dateToDateOnlyString(holiday.date),
        status: holiday.isActive ? "ACTIVE" : "INACTIVE",
        notes: holiday.notes ?? "",
        countsAsCompanyHoliday: holiday.countsAsCompanyHoliday,
        source: holiday.source,
        canManage,
      });
    }

    const requestRecord = await prisma.pTORequest.findUnique({
      where: { id: calendarEvent.sourceId },
      include: {
        employee: true,
      },
    });

    if (!requestRecord) {
      return NextResponse.json(
        { error: "Calendar event not found." },
        { status: 404 }
      );
    }

    await assertCanViewEmployee(actor.id, requestRecord.employeeId);

    const approvalAccess = await getApprovalScope();

    let canManage = false;

    if (approvalAccess.allowed) {
      if (approvalAccess.scope === "ALL") {
        canManage = true;
      } else if (approvalAccess.scope === "DIRECT_REPORTS") {
        canManage = await isManagerOf(
          approvalAccess.user.id,
          requestRecord.employeeId
        );
      }
    }

    const canSelfCancel =
      actor.id === requestRecord.employeeId && requestRecord.status === "PENDING";

    return NextResponse.json({
      id,
      sourceId: requestRecord.id,
      eventType: "PTO",
      employeeId: requestRecord.employeeId,
      employeeName: `${requestRecord.employee.firstName} ${requestRecord.employee.lastName}`,
      title: `${requestRecord.employee.firstName} ${requestRecord.employee.lastName} • ${requestRecord.leaveType}`,
      leaveType: requestRecord.leaveType,
      startDate: dateToDateOnlyString(requestRecord.startDate),
      endDate: dateToDateOnlyString(requestRecord.endDate),
      hours: requestRecord.hours,
      status: requestRecord.status,
      notes: requestRecord.notes ?? "",
      approvalComment: requestRecord.approvalComment ?? "",
      canAct: canManage && requestRecord.status === "PENDING",
      canManage,
      canSelfCancel,
    });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to load calendar event." },
      { status: 500 }
    );
  }
}
