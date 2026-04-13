import { prisma } from "../../../../lib/db";
import { csvEscape } from "../../../../lib/server/csv";
import { writeAuditLog } from "../../../../lib/server/audit/write-audit-log";
import { calculatePerPaycheckWithholding } from "../../../../lib/server/employees/benefits";
import { withPrivateNoStoreHeaders } from "../../../../lib/server/http/headers";
import {
  isAuthorizationError,
  requireRole,
} from "../../../../lib/server/authorization";

export async function GET() {
  try {
    const actor = await requireRole(
      ["SITE_ADMIN", "HR_ADMIN"],
      {
        attemptedAction: "PAYROLL_BENEFIT_WITHHOLDING_EXPORT",
        entityType: "Report",
        entityId: "benefit-withholding-export",
      }
    );

    const employees = await prisma.employee.findMany({
      where: {
        benefitElections: {
          some: {
            electionStatus: "ENROLLED",
          },
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        payrollFrequency: true,
        benefitElections: {
          where: {
            electionStatus: "ENROLLED",
          },
          select: {
            benefitType: true,
            planName: true,
            coverageLevel: true,
            effectiveDate: true,
            employeeMonthlyCost: true,
          },
          orderBy: [
            { effectiveDate: "desc" },
            { createdAt: "desc" },
          ],
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    const header = [
      "Employee ID",
      "First Name",
      "Last Name",
      "Payroll Frequency",
      "Benefit Type",
      "Plan Name",
      "Coverage Level",
      "Effective Date",
      "Employee Monthly Cost",
      "Estimated Per-Paycheck Withholding",
    ];

    const rows = employees.flatMap((employee) =>
      employee.benefitElections.map((election) => [
        employee.id,
        employee.firstName,
        employee.lastName,
        employee.payrollFrequency,
        election.benefitType,
        election.planName,
        election.coverageLevel ?? "",
        election.effectiveDate.toISOString().split("T")[0],
        election.employeeMonthlyCost.toFixed(2),
        calculatePerPaycheckWithholding(
          election.employeeMonthlyCost,
          employee.payrollFrequency
        ),
      ])
    );

    const csv = [
      header.map(csvEscape).join(","),
      ...rows.map((row: string[]) => row.map(csvEscape).join(",")),
    ].join("\n");

    await writeAuditLog(prisma, {
      userId: actor.id,
      action: "PAYROLL_BENEFIT_WITHHOLDING_EXPORT",
      entityType: "Report",
      entityId: "benefit-withholding-export",
      newValue: {
        rowCount: rows.length,
        employeeCount: employees.length,
      },
    });

    return new Response(
      csv,
      withPrivateNoStoreHeaders({
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="benefit-withholding-export.csv"',
        },
      })
    );
  } catch (error) {
    if (isAuthorizationError(error)) {
      return new Response(
        error.message,
        withPrivateNoStoreHeaders({ status: error.status })
      );
    }

    return new Response(
      "Failed to export benefit withholding data.",
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}
