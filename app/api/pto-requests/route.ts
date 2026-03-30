import { prisma } from "../../../lib/db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("=== PTO REQUEST ROUTE HIT ===", body);

    const employeeId = String(body.employeeId || "").trim();
    const leaveType = String(body.leaveType || "").trim();
    const startDate = String(body.startDate || "").trim();
    const endDate = String(body.endDate || "").trim();
    const hours = Number(body.hours);
    const notes = body.notes ? String(body.notes).trim() : null;

    if (!employeeId || !leaveType || !startDate || !endDate || !hours) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found." },
        { status: 404 }
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const requestRecord = await tx.pTORequest.create({
        data: {
          employeeId,
          leaveType,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          hours,
          status: "PENDING",
          notes,
        },
      });

      await tx.pTORequestAction.create({
        data: {
          requestId: requestRecord.id,
          action: "SUBMITTED",
          actionById: employeeId,
          comment: notes,
        },
      });

      return requestRecord;
    });

    return NextResponse.json(created);
  } catch (error) {
    console.error("Failed to create PTO request:", error);

    return NextResponse.json(
      { error: "Failed to create PTO request." },
      { status: 500 }
    );
  }
}