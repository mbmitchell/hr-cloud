import { prisma } from "../../../../lib/db";
import { NextResponse } from "next/server";
import {
  assertCanViewEmployee,
  isAuthorizationError,
  requireActor,
} from "../../../../lib/server/authorization";
import { getVisibleEmployeeIds } from "../../../../lib/server/employee-visibility";

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const { searchParams } = new URL(request.url);

    const employeeId = String(searchParams.get("employeeId") || "").trim();
    const startDate = String(searchParams.get("startDate") || "").trim();
    const endDate = String(searchParams.get("endDate") || "").trim();
    const excludeRequestId = String(searchParams.get("excludeRequestId") || "").trim();

    if (!employeeId || !startDate || !endDate) {
      return NextResponse.json(
        { error: "employeeId, startDate, and endDate are required." },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        department: true,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found." },
        { status: 404 }
      );
    }

    await assertCanViewEmployee(actor.id, employeeId);
    const visibleEmployeeIds = new Set(await getVisibleEmployeeIds(actor.id));

    if (!employee.department) {
      return NextResponse.json({
        department: null,
        conflictCount: 0,
        approvedCount: 0,
        pendingCount: 0,
        employeesOff: [],
      });
    }

    const overlaps = await prisma.pTORequest.findMany({
      where: {
        employee: {
          department: employee.department,
        },
        employeeId: {
          not: employeeId,
        },
        ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
        status: {
          in: ["APPROVED", "PENDING"],
        },
        startDate: {
          lte: new Date(endDate),
        },
        endDate: {
          gte: new Date(startDate),
        },
      },
      include: {
        employee: true,
      },
      orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
    });

    const approved = overlaps.filter((r) => r.status === "APPROVED");
    const pending = overlaps.filter((r) => r.status === "PENDING");
    const visibleEmployeesOff = overlaps.map((request) => ({
      id: request.id,
      employeeId: request.employeeId,
      employeeName: visibleEmployeeIds.has(request.employeeId)
        ? `${request.employee.firstName} ${request.employee.lastName}`
        : "Unavailable",
      leaveType: request.leaveType,
      status: request.status,
      startDate: request.startDate.toISOString(),
      endDate: request.endDate.toISOString(),
    }));

    return NextResponse.json({
      department: employee.department,
      conflictCount: overlaps.length,
      approvedCount: approved.length,
      pendingCount: pending.length,
      employeesOff: visibleEmployeesOff,
    });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to load staffing conflicts." },
      { status: 500 }
    );
  }
}
