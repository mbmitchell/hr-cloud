import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db";
import {
  currentUserHasAnyRole,
  requireCurrentUser,
} from "../../../../../lib/auth/access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const allowed = await currentUserHasAnyRole(["SITE_ADMIN", "HR_ADMIN"]);

    if (!allowed) {
      return NextResponse.json(
        { error: "You do not have permission to view role assignments." },
        { status: 403 }
      );
    }

    const { id } = await params;

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        roleAssignments: {
          where: { isActive: true },
          include: { role: true },
        },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found." },
        { status: 404 }
      );
    }

    const allRoles = await prisma.role.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      employeeId: employee.id,
      assignedRoleCodes: employee.roleAssignments.map(
        (assignment) => assignment.role.code
      ),
      roles: allRoles.map((role) => ({
        id: role.id,
        code: role.code,
        name: role.name,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load employee roles." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const allowed = await currentUserHasAnyRole(["SITE_ADMIN", "HR_ADMIN"]);

    if (!allowed) {
      return NextResponse.json(
        { error: "You do not have permission to update role assignments." },
        { status: 403 }
      );
    }

    const currentUser = await requireCurrentUser();
    const { id } = await params;
    const body = await request.json();

    const requestedRoleCodes = Array.isArray(body.roleCodes)
      ? body.roleCodes.map((value: unknown) => String(value).trim()).filter(Boolean)
      : [];

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        roleAssignments: {
          where: { isActive: true },
          include: { role: true },
        },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found." },
        { status: 404 }
      );
    }

    const validRoles = await prisma.role.findMany({
      where: {
        isActive: true,
        code: { in: requestedRoleCodes },
      },
    });

    const validRoleCodes = validRoles.map((role) => role.code);

    if (validRoleCodes.length !== requestedRoleCodes.length) {
      return NextResponse.json(
        { error: "One or more selected roles are invalid." },
        { status: 400 }
      );
    }

    const currentAssignments = employee.roleAssignments;
    const currentRoleCodes = currentAssignments.map((assignment) => assignment.role.code);

    await prisma.$transaction(async (tx) => {
      await tx.employeeRoleAssignment.updateMany({
        where: {
          employeeId: employee.id,
          isActive: true,
        },
        data: {
          isActive: false,
          effectiveEndDate: new Date(),
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
          action: "EMPLOYEE_ROLE_UPDATE",
          entityType: "Employee",
          entityId: employee.id,
          oldValue: JSON.stringify({
            roles: currentRoleCodes,
          }),
          newValue: JSON.stringify({
            roles: validRoleCodes,
          }),
        },
      });
    });

    return NextResponse.json({
      success: true,
      employeeId: employee.id,
      roleCodes: validRoleCodes,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to update employee roles." },
      { status: 500 }
    );
  }
}