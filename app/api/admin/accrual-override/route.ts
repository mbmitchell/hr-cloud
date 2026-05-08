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
    const accrualMode = String(body.accrualMode || "STANDARD_TENURE").trim();
    const monthlyAccrualOverride =
      body.monthlyAccrualOverride == null
        ? null
        : Number(body.monthlyAccrualOverride);
    const accrualOverrideReason =
      body.accrualOverrideReason == null
        ? null
        : String(body.accrualOverrideReason).trim();
    const advancedAccrualTier =
      body.advancedAccrualTier == null
        ? null
        : String(body.advancedAccrualTier).trim();
    const advancedAccrualEffectiveDate =
      body.advancedAccrualEffectiveDate == null || body.advancedAccrualEffectiveDate === ""
        ? null
        : new Date(String(body.advancedAccrualEffectiveDate));
    const advancedAccrualReason =
      body.advancedAccrualReason == null
        ? null
        : String(body.advancedAccrualReason).trim();
    const validAccrualModes = ["STANDARD_TENURE", "ADVANCED_TIER", "MANUAL_ONLY"];
    const validAdvancedTiers = [
      "YEARS_1_TO_5",
      "YEARS_6_TO_10",
      "YEARS_11_PLUS",
    ];

    if (!employeeId) {
      return NextResponse.json(
        { error: "Employee ID is required." },
        { status: 400 }
      );
    }

    if (!validAccrualModes.includes(accrualMode)) {
      return NextResponse.json(
        { error: "Accrual mode is invalid." },
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

    if (
      advancedAccrualTier != null &&
      !validAdvancedTiers.includes(advancedAccrualTier)
    ) {
      return NextResponse.json(
        { error: "Advanced accrual tier is invalid." },
        { status: 400 }
      );
    }

    if (
      advancedAccrualEffectiveDate &&
      Number.isNaN(advancedAccrualEffectiveDate.getTime())
    ) {
      return NextResponse.json(
        { error: "Advanced accrual effective date is invalid." },
        { status: 400 }
      );
    }

    if (
      advancedAccrualEffectiveDate &&
      advancedAccrualEffectiveDate.getDate() !== 1
    ) {
      return NextResponse.json(
        { error: "Advanced accrual effective date must be the first day of a month." },
        { status: 400 }
      );
    }

    if (accrualMode === "MANUAL_ONLY" && monthlyAccrualOverride == null) {
      return NextResponse.json(
        { error: "Manual-only accrual mode requires a monthly accrual override." },
        { status: 400 }
      );
    }

    if (
      accrualMode === "ADVANCED_TIER" &&
      (!advancedAccrualTier || !advancedAccrualEffectiveDate)
    ) {
      return NextResponse.json(
        {
          error:
            "Advanced accrual mode requires both an advanced tier and an effective date.",
        },
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
          accrualMode: accrualMode as
            | "STANDARD_TENURE"
            | "ADVANCED_TIER"
            | "MANUAL_ONLY",
          monthlyAccrualOverride:
            accrualMode === "MANUAL_ONLY" ? monthlyAccrualOverride : null,
          accrualOverrideReason:
            accrualMode === "MANUAL_ONLY" ? accrualOverrideReason : null,
          advancedAccrualTier:
            accrualMode === "ADVANCED_TIER"
              ? (advancedAccrualTier as
                  | "YEARS_1_TO_5"
                  | "YEARS_6_TO_10"
                  | "YEARS_11_PLUS")
              : null,
          advancedAccrualEffectiveDate:
            accrualMode === "ADVANCED_TIER" ? advancedAccrualEffectiveDate : null,
          advancedAccrualReason:
            accrualMode === "ADVANCED_TIER" ? advancedAccrualReason : null,
        },
      });

      await writeAuditLog(tx, {
        userId: currentUser.id,
        action: "ACCRUAL_OVERRIDE_UPDATE",
        entityType: "Employee",
        entityId: saved.id,
        oldValue: {
          accrualMode: employee.accrualMode,
          monthlyAccrualOverride: employee.monthlyAccrualOverride,
          accrualOverrideReason: employee.accrualOverrideReason,
          advancedAccrualTier: employee.advancedAccrualTier,
          advancedAccrualEffectiveDate: employee.advancedAccrualEffectiveDate,
          advancedAccrualReason: employee.advancedAccrualReason,
        },
        newValue: {
          accrualMode: saved.accrualMode,
          monthlyAccrualOverride: saved.monthlyAccrualOverride,
          accrualOverrideReason: saved.accrualOverrideReason,
          advancedAccrualTier: saved.advancedAccrualTier,
          advancedAccrualEffectiveDate: saved.advancedAccrualEffectiveDate,
          advancedAccrualReason: saved.advancedAccrualReason,
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
