import { prisma } from "../../../lib/db";
import { NextResponse } from "next/server";
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

    const events = requests.map((request) => ({
      id: request.id,
      employeeId: request.employeeId,
      employeeName: `${request.employee.firstName} ${request.employee.lastName}`,
      leaveType: request.leaveType,
      start: request.startDate,
      end: request.endDate,
      hours: request.hours,
      status: request.status,
    }));

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
