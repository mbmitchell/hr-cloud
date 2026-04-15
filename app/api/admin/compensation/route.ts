import { NextResponse } from "next/server";

import { prisma } from "../../../../lib/db";
import {
  buildLegacyCompensationSync,
  parseCompensationProfileInput,
  type ParsedCompensationProfileInput,
  serializeCompensationAuditValue,
} from "../../../../lib/server/employees/compensation";
import {
  isAuthorizationError,
  requireRole,
} from "../../../../lib/server/authorization";
import { writeAuditLog } from "../../../../lib/server/audit/write-audit-log";
import { withPrivateNoStoreHeaders } from "../../../../lib/server/http/headers";

export async function POST(request: Request) {
  try {
    const currentUser = await requireRole(
      ["SITE_ADMIN", "HR_ADMIN"],
      {
        attemptedAction: "COMPENSATION_UPDATE",
        entityType: "Employee",
      }
    );
    const body = await request.json();

    const employeeId = String(body.employeeId || "").trim();

    if (!employeeId) {
      return NextResponse.json(
        { error: "Employee ID is required." },
        withPrivateNoStoreHeaders({ status: 400 })
      );
    }

    const employee = await (prisma.employee as any).findUnique({
      where: { id: employeeId },
      include: { compensationProfile: true },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found." },
        withPrivateNoStoreHeaders({ status: 404 })
      );
    }

    let parsedInput: ParsedCompensationProfileInput;

    try {
      parsedInput = parseCompensationProfileInput(body as Record<string, unknown>);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Compensation profile is invalid.",
        },
        withPrivateNoStoreHeaders({ status: 400 })
      );
    }

    const updatedEmployee = await prisma.$transaction(async (tx) => {
      const legacySync = buildLegacyCompensationSync(parsedInput);
      const compensationProfileClient = (tx as typeof tx & {
        employeeCompensationProfile: {
          update(args: {
            where: { employeeId: string };
            data: typeof parsedInput;
          }): Promise<{
            id: string;
            payType: string;
            annualSalary: import("@prisma/client").Prisma.Decimal | null;
            hourlyRate: import("@prisma/client").Prisma.Decimal | null;
            standardHours: import("@prisma/client").Prisma.Decimal;
            payrollFrequency: "BIWEEKLY" | "SEMI_MONTHLY" | "MONTHLY";
            effectiveDate: Date;
            notes: string | null;
          }>;
          create(args: {
            data: { employeeId: string } & typeof parsedInput;
          }): Promise<{
            id: string;
            payType: string;
            annualSalary: import("@prisma/client").Prisma.Decimal | null;
            hourlyRate: import("@prisma/client").Prisma.Decimal | null;
            standardHours: import("@prisma/client").Prisma.Decimal;
            payrollFrequency: "BIWEEKLY" | "SEMI_MONTHLY" | "MONTHLY";
            effectiveDate: Date;
            notes: string | null;
          }>;
        };
        employeeCompensationHistory: {
          create(args: {
            data: { employeeId: string } & typeof parsedInput;
          }): Promise<unknown>;
        };
      }).employeeCompensationProfile;
      const compensationHistoryClient = (tx as typeof tx & {
        employeeCompensationHistory: {
          create(args: {
            data: { employeeId: string } & typeof parsedInput;
          }): Promise<unknown>;
        };
      }).employeeCompensationHistory;

      const savedProfile = employee.compensationProfile
        ? await compensationProfileClient.update({
            where: { employeeId },
            data: {
              ...parsedInput,
            },
          })
        : await compensationProfileClient.create({
            data: {
              employeeId,
              ...parsedInput,
            },
          });

      const savedEmployee = await tx.employee.update({
        where: { id: employeeId },
        data: legacySync,
      });

      await compensationHistoryClient.create({
        data: {
          employeeId,
          ...parsedInput,
        },
      });

      await writeAuditLog(tx, {
        userId: currentUser.id,
        action: employee.compensationProfile
          ? "EMPLOYEE_COMPENSATION_PROFILE_UPDATE"
          : "EMPLOYEE_COMPENSATION_PROFILE_CREATE",
        entityType: "EmployeeCompensationProfile",
        entityId: savedProfile.id,
        oldValue: employee.compensationProfile
          ? serializeCompensationAuditValue(employee.compensationProfile)
          : undefined,
        newValue: serializeCompensationAuditValue(savedProfile),
      });

      return savedEmployee;
    });

    return NextResponse.json({
      success: true,
      employee: updatedEmployee,
    }, withPrivateNoStoreHeaders());
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        withPrivateNoStoreHeaders({ status: error.status })
      );
    }

    return NextResponse.json(
      { error: "Failed to update compensation." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}
