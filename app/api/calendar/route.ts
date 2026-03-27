import { prisma } from "../../../lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const requests = await prisma.pTORequest.findMany({
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
  } catch {
    return NextResponse.json(
      { error: "Failed to load calendar events." },
      { status: 500 }
    );
  }
}