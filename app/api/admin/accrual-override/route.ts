import { prisma } from "../../../../lib/db";
import { NextResponse } from "next/server";
import {
  canCurrentUserManageAccrualOverride,
  requireCurrentUser,
} from "../../../../lib/auth/access";

export async function POST(request: Request) {
  try {
    const allowed = await canCurrentUserManageAccrualOverride();

    if (!allowed) {
      return NextResponse.json(
        { error: "You do not have permission to manage accrual overrides." },
        { status: 403 }
      );
    }

    const currentUser = await requireCurrentUser();
    const body = await request.json();

    const employeeId = String(body.employeeId || "").trim();
    const monthlyAccrualOverride =
      body.monthlyAccrualOverride == null
        ? null
        : Number(body.monthlyAccrualOverride);
    const accrualOverrideReason =
      body.accrualOverrideReason == null
        ? null
        : String(body.accrualOverrideReason).trim();

    if (!employeeId) {
      return NextResponse.json(
        { error: "Employee ID is required." },
        { status: 400 }
      );
    }

    if (
      monthlyAccrualOverride != null &&
      (Number.isNaN(monthlyAccrualOverride) || monthlyAccrualOverride < 0)
    ) {
      return NextResponse.json(
        { error: "Monthly accrual override must be zero or greater." },
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

    const updatedEmployee = await prisma.employee.update({
      where: { id: employeeId },
      data: {
        monthlyAccrualOverride,
        accrualOverrideReason,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "ACCRUAL_OVERRIDE_UPDATE",
        entityType: "Employee",
        entityId: updatedEmployee.id,
        oldValue: JSON.stringify({
          monthlyAccrualOverride: employee.monthlyAccrualOverride,
          accrualOverrideReason: employee.accrualOverrideReason,
        }),
        newValue: JSON.stringify({
          monthlyAccrualOverride: updatedEmployee.monthlyAccrualOverride,
          accrualOverrideReason: updatedEmployee.accrualOverrideReason,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      employee: updatedEmployee,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to save accrual override." },
      { status: 500 }
    );
  }
}