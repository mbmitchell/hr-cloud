import { prisma } from "../../../lib/db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const employeeId = String(body.employeeId || "").trim();
    const leaveType = String(body.leaveType || "").trim();
    const startDate = String(body.startDate || "").trim();
    const endDate = String(body.endDate || "").trim();
    const hours = Number(body.hours);
    const notes = body.notes ? String(body.notes) : null;

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

    const created = await prisma.pTORequest.create({
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

    return NextResponse.json(created);
  } catch {
    return NextResponse.json(
      { error: "Failed to create PTO request." },
      { status: 500 }
    );
  }
}