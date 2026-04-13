import { NextResponse } from "next/server";

import { prisma } from "../../../../../lib/db";
import {
  isAuthorizationError,
  requireAdmin,
} from "../../../../../lib/server/authorization";
import { applyEmployeeUpdate } from "../../../../../lib/server/employees/apply-employee-update";
import { parseEmployeeInput } from "../../../../../lib/server/employees/employee-input";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await requireAdmin({
      attemptedAction: "EMPLOYEE_UPDATE",
      entityType: "Employee",
      entityId: id,
    });
    const body = await request.json();
    const parsedInput = parseEmployeeInput(body as Record<string, unknown>);

    if (!parsedInput.ok) {
      return NextResponse.json(
        { error: parsedInput.error },
        { status: 400 }
      );
    }

    const {
      firstName,
      lastName,
      email,
      department,
      title,
      status,
      hireDate,
      managerId,
      payrollFrequency,
    } = parsedInput.data;

    const employee = await prisma.employee.findUnique({
      where: { id },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found." },
        { status: 404 }
      );
    }

    if (managerId === id) {
      return NextResponse.json(
        { error: "An employee cannot be their own manager." },
        { status: 400 }
      );
    }

    if (managerId) {
      const manager = await prisma.employee.findUnique({
        where: { id: managerId },
        select: { id: true },
      });

      if (!manager) {
        return NextResponse.json(
          { error: "Selected manager was not found." },
          { status: 400 }
        );
      }
    }

    const emailOwner = await prisma.employee.findUnique({
      where: { email },
      select: { id: true },
    });

    if (emailOwner && emailOwner.id !== id) {
      return NextResponse.json(
        { error: "Email address is already in use by another employee." },
        { status: 400 }
      );
    }

    const updatedEmployee = await prisma.$transaction(async (tx) => {
      return applyEmployeeUpdate(tx, {
        actorId: currentUser.id,
        employeeId: id,
        existingEmployee: employee,
        update: {
          firstName,
          lastName,
          email,
          department,
          title,
          status,
          hireDate,
          managerId,
          payrollFrequency,
        },
      });
    });

    return NextResponse.json({
      success: true,
      employee: updatedEmployee,
    });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("Employee update failed:", error);

    return NextResponse.json(
      { error: "Failed to update employee information." },
      { status: 500 }
    );
  }
}
