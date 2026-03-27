import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import {
  currentUserHasAnyRole,
  requireCurrentUser,
} from "../../../../lib/auth/access";

export async function GET() {
  try {
    const allowed = await currentUserHasAnyRole(["SITE_ADMIN", "HR_ADMIN"]);

    if (!allowed) {
      return NextResponse.json(
        { error: "You do not have permission to view employee creation data." },
        { status: 403 }
      );
    }

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
  } catch {
    return NextResponse.json(
      { error: "Failed to load employee creation data." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const allowed = await currentUserHasAnyRole(["SITE_ADMIN", "HR_ADMIN"]);

    if (!allowed) {
      return NextResponse.json(
        { error: "You do not have permission to add employees." },
        { status: 403 }
      );
    }

    const currentUser = await requireCurrentUser();
    const body = await request.json();

    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const department =
      body.department == null || String(body.department).trim() === ""
        ? null
        : String(body.department).trim();
    const title =
      body.title == null || String(body.title).trim() === ""
        ? null
        : String(body.title).trim();
    const status = String(body.status || "").trim();
    const hireDate = String(body.hireDate || "").trim();
    const managerId =
      body.managerId == null || String(body.managerId).trim() === ""
        ? null
        : String(body.managerId).trim();

    const payType =
      body.payType == null || String(body.payType).trim() === ""
        ? null
        : String(body.payType).trim();

    const hourlyRate =
      body.hourlyRate == null || body.hourlyRate === ""
        ? null
        : Number(body.hourlyRate);

    const annualSalary =
      body.annualSalary == null || body.annualSalary === ""
        ? null
        : Number(body.annualSalary);

    const fte =
      body.fte == null || body.fte === ""
        ? 1
        : Number(body.fte);

    const roleCodes = Array.isArray(body.roleCodes)
      ? body.roleCodes.map((value: unknown) => String(value).trim()).filter(Boolean)
      : ["EMPLOYEE"];

    if (!firstName || !lastName || !email || !status || !hireDate) {
      return NextResponse.json(
        {
          error:
            "First name, last name, email, status, and hire date are required.",
        },
        { status: 400 }
      );
    }

    const parsedHireDate = new Date(hireDate);
    if (Number.isNaN(parsedHireDate.getTime())) {
      return NextResponse.json(
        { error: "Hire date is invalid." },
        { status: 400 }
      );
    }

    if (payType && !["HOURLY", "SALARY"].includes(payType)) {
      return NextResponse.json(
        { error: "Invalid pay type." },
        { status: 400 }
      );
    }

    if (hourlyRate != null && (Number.isNaN(hourlyRate) || hourlyRate < 0)) {
      return NextResponse.json(
        { error: "Hourly rate must be zero or greater." },
        { status: 400 }
      );
    }

    if (annualSalary != null && (Number.isNaN(annualSalary) || annualSalary < 0)) {
      return NextResponse.json(
        { error: "Annual salary must be zero or greater." },
        { status: 400 }
      );
    }

    if (Number.isNaN(fte) || fte <= 0) {
      return NextResponse.json(
        { error: "FTE must be greater than zero." },
        { status: 400 }
      );
    }

    if (payType === "HOURLY" && hourlyRate == null) {
      return NextResponse.json(
        { error: "Hourly employees require an hourly rate." },
        { status: 400 }
      );
    }

    if (payType === "SALARY" && annualSalary == null) {
      return NextResponse.json(
        { error: "Salary employees require an annual salary." },
        { status: 400 }
      );
    }

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
          hireDate: parsedHireDate,
          managerId,
          payType,
          hourlyRate: payType === "HOURLY" ? hourlyRate : null,
          annualSalary: payType === "SALARY" ? annualSalary : null,
          fte,
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

      await tx.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "EMPLOYEE_CREATE",
          entityType: "Employee",
          entityId: employee.id,
          oldValue: null,
          newValue: JSON.stringify({
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
            roles: validRoles.map((role) => role.code),
          }),
        },
      });

      return employee;
    });

    return NextResponse.json({
      success: true,
      employee: result,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to create employee." },
      { status: 500 }
    );
  }
}