import { NextResponse } from "next/server";

import { prisma } from "../../../../lib/db";
import {
  isAuthorizationError,
  requireRole,
} from "../../../../lib/server/authorization";
import { writeAuditLog } from "../../../../lib/server/audit/write-audit-log";

export async function POST(request: Request) {
  try {
    const currentUser = await requireRole(
      ["SITE_ADMIN", "HR_ADMIN", "ACCOUNTING"],
      {
        attemptedAction: "COMPENSATION_UPDATE",
        entityType: "Employee",
      }
    );
    const body = await request.json();

    const employeeId = String(body.employeeId || "").trim();
    const payType = body.payType ? String(body.payType).trim() : null;
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

    if (!employeeId) {
      return NextResponse.json(
        { error: "Employee ID is required." },
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
          payType,
          hourlyRate: payType === "HOURLY" ? hourlyRate : null,
          annualSalary: payType === "SALARY" ? annualSalary : null,
          fte,
        },
      });

      await writeAuditLog(tx, {
        userId: currentUser.id,
        action: "COMPENSATION_UPDATE",
        entityType: "Employee",
        entityId: saved.id,
        oldValue: {
          payType: employee.payType,
          hourlyRate: employee.hourlyRate,
          annualSalary: employee.annualSalary,
          fte: employee.fte,
        },
        newValue: {
          payType: saved.payType,
          hourlyRate: saved.hourlyRate,
          annualSalary: saved.annualSalary,
          fte: saved.fte,
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
      { error: "Failed to update compensation." },
      { status: 500 }
    );
  }
}
