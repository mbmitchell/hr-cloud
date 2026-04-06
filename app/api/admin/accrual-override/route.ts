import { NextResponse } from "next/server";

import { prisma } from "../../../../lib/db";
import {
  isAuthorizationError,
  requireAdmin,
} from "../../../../lib/server/authorization";
import { writeAuditLog } from "../../../../lib/server/audit/write-audit-log";

export async function POST(request: Request) {
  try {
    const currentUser = await requireAdmin({
      attemptedAction: "ACCRUAL_OVERRIDE_UPDATE",
      entityType: "Employee",
    });
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

    const updatedEmployee = await prisma.$transaction(async (tx) => {
      const saved = await tx.employee.update({
        where: { id: employeeId },
        data: {
          monthlyAccrualOverride,
          accrualOverrideReason,
        },
      });

      await writeAuditLog(tx, {
        userId: currentUser.id,
        action: "ACCRUAL_OVERRIDE_UPDATE",
        entityType: "Employee",
        entityId: saved.id,
        oldValue: {
          monthlyAccrualOverride: employee.monthlyAccrualOverride,
          accrualOverrideReason: employee.accrualOverrideReason,
        },
        newValue: {
          monthlyAccrualOverride: saved.monthlyAccrualOverride,
          accrualOverrideReason: saved.accrualOverrideReason,
        },
      });

      return saved;
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

    return NextResponse.json(
      { error: "Failed to save accrual override." },
      { status: 500 }
    );
  }
}
