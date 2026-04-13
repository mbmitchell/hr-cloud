import { NextResponse } from "next/server";

import { prisma } from "../../../../../lib/db";
import {
  isAuthorizationError,
  requireAdmin,
} from "../../../../../lib/server/authorization";
import { writeAuditLog } from "../../../../../lib/server/audit/write-audit-log";
import { withPrivateNoStoreHeaders } from "../../../../../lib/server/http/headers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await requireAdmin({
      attemptedAction: "EMPLOYEE_ROLE_VIEW",
      entityType: "Employee",
      entityId: id,
    });

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
        withPrivateNoStoreHeaders({ status: 404 })
      );
    }

    const allRoles = await prisma.role.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(
      {
        employeeId: employee.id,
        assignedRoleCodes: employee.roleAssignments.map(
          (assignment) => assignment.role.code
        ),
        roles: allRoles.map((role) => ({
          id: role.id,
          code: role.code,
          name: role.name,
        })),
      },
      withPrivateNoStoreHeaders()
    );
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        withPrivateNoStoreHeaders({ status: error.status })
      );
    }

    return NextResponse.json(
      { error: "Failed to load employee roles." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await requireAdmin({
      attemptedAction: "EMPLOYEE_ROLE_UPDATE",
      entityType: "Employee",
      entityId: id,
    });
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

      await writeAuditLog(tx, {
        userId: currentUser.id,
        action: "EMPLOYEE_ROLE_UPDATE",
        entityType: "Employee",
        entityId: employee.id,
        oldValue: {
          roles: currentRoleCodes,
        },
        newValue: {
          roles: validRoleCodes,
        },
      });
    });

    return NextResponse.json({
      success: true,
      employeeId: employee.id,
      roleCodes: validRoleCodes,
    });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to update employee roles." },
      { status: 500 }
    );
  }
}
