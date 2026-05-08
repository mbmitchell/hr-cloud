import { NextResponse } from "next/server";

import { prisma } from "../../../../lib/db";
import {
  isAuthorizationError,
  requireAdmin,
} from "../../../../lib/server/authorization";
import { writeAuditLog } from "../../../../lib/server/audit/write-audit-log";
import { parseEmployeeInput } from "../../../../lib/server/employees/employee-input";

export async function GET() {
  try {
    await requireAdmin({
      attemptedAction: "EMPLOYEE_CREATE_FORM_VIEW",
      entityType: "Employee",
      entityId: "new",
    });

    const [managers, roles] = await Promise.all([
      prisma.employee.findMany({
        select: {
          id: true,
          firstName: true,
          lastName: true,
          department: true,
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      prisma.role.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({
      managers,
      roles: roles.map((role) => ({
        id: role.id,
        code: role.code,
        name: role.name,
      })),
    });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to load employee creation data." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await requireAdmin({
      attemptedAction: "EMPLOYEE_CREATE",
      entityType: "Employee",
      entityId: "new",
    });
    const body = await request.json();
    const roleCodes = Array.isArray(body.roleCodes)
      ? body.roleCodes.map((value: unknown) => String(value).trim()).filter(Boolean)
      : ["EMPLOYEE"];
    const parsedInput = parseEmployeeInput(body as Record<string, unknown>, {
      normalizeEmail: true,
      includeCompensation: true,
    });

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
      payType,
      hourlyRate,
      annualSalary,
      fte,
      payrollFrequency,
    } = parsedInput.data;

    const existingEmployee = await prisma.employee.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingEmployee) {
      return NextResponse.json(
        { error: "An employee with that email already exists." },
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

    const validRoles = await prisma.role.findMany({
      where: {
        isActive: true,
        code: { in: roleCodes },
      },
    });

    if (validRoles.length !== roleCodes.length) {
      return NextResponse.json(
        { error: "One or more selected roles are invalid." },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          firstName,
          lastName,
          email,
          department,
          title,
          status,
          hireDate,
          managerId,
          payType,
          hourlyRate: payType === "HOURLY" ? hourlyRate : null,
          annualSalary: payType === "SALARY" ? annualSalary : null,
          fte,
          payrollFrequency,
        },
      });

      for (const role of validRoles) {
        await tx.employeeRoleAssignment.create({
          data: {
            employeeId: employee.id,
            roleId: role.id,
            isActive: true,
            effectiveStartDate: new Date(),
          },
        });
      }

      await writeAuditLog(tx, {
        userId: currentUser.id,
        action: "EMPLOYEE_CREATE",
        entityType: "Employee",
        entityId: employee.id,
        newValue: {
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          department: employee.department,
          title: employee.title,
          status: employee.status,
          hireDate: employee.hireDate.toISOString(),
          managerId: employee.managerId,
          payType: employee.payType,
          hourlyRate: employee.hourlyRate,
          annualSalary: employee.annualSalary,
          fte: employee.fte,
          payrollFrequency: employee.payrollFrequency,
          roles: validRoles.map((role) => role.code),
        },
      });

      return employee;
    });

    return NextResponse.json({
      success: true,
      employee: result,
    });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to create employee." },
      { status: 500 }
    );
  }
}
