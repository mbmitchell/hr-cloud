import { prisma } from "../../../../../lib/db";
import { writeAuditLog } from "../../../../../lib/server/audit/write-audit-log";
import { csvEscape } from "../../../../../lib/server/csv";
import { withPrivateNoStoreHeaders } from "../../../../../lib/server/http/headers";
import {
  getPtoLiabilityExportRows,
  getPtoLiabilityFilters,
} from "../../../../../lib/server/reports/pto-liability";
import {
  isAuthorizationError,
  requireRole,
} from "../../../../../lib/server/authorization";

function formatDateForFilename(date: Date) {
  return date.toISOString().split("T")[0];
}

export async function GET(request: Request) {
  try {
    const actor = await requireRole(["SITE_ADMIN", "HR_ADMIN"], {
      attemptedAction: "REPORT_PTO_LIABILITY_EXPORT",
      entityType: "Report",
      entityId: "pto-liability",
    });

    const url = new URL(request.url);
    const filters = getPtoLiabilityFilters({
      employee: url.searchParams.get("employee") ?? undefined,
      department: url.searchParams.get("department") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      payrollFrequency: url.searchParams.get("payrollFrequency") ?? undefined,
      workLocation: url.searchParams.get("workLocation") ?? undefined,
      liabilityStatus: url.searchParams.get("liabilityStatus") ?? undefined,
      asOfDate: url.searchParams.get("asOfDate") ?? undefined,
      sort: url.searchParams.get("sort") ?? undefined,
      direction: url.searchParams.get("direction") ?? undefined,
      page: "1",
      pageSize: "10000",
    });

    const rows = await getPtoLiabilityExportRows(filters);

    const csv = [
      [
        "Employee Name",
        "Employee ID",
        "Department",
        "Employee Status",
        "Job Title",
        "Work Location",
        "Payroll Frequency",
        "Estimated PTO Liability",
        "Liability Status",
        "Snapshot Date",
      ]
        .map(csvEscape)
        .join(","),
      ...rows.map((row) =>
        [
          row.employeeName,
          row.employeeIdentifier,
          row.department ?? "",
          row.employeeStatus,
          row.jobTitle ?? "",
          row.workLocation ?? "",
          row.payrollFrequency,
          row.estimatedPtoLiability.toFixed(2),
          row.liabilityStatusLabel,
          row.snapshotDate,
        ]
          .map(csvEscape)
          .join(",")
      ),
    ].join("\n");

    await writeAuditLog(prisma, {
      userId: actor.id,
      action: "REPORT_PTO_LIABILITY_EXPORT",
      entityType: "Report",
      entityId: "pto-liability",
      newValue: {
        rowCount: rows.length,
        filters: {
          employee: filters.employee || null,
          department: filters.department || null,
          status: filters.status,
          payrollFrequency: filters.payrollFrequency || null,
          workLocation: filters.workLocation || null,
          liabilityStatus: filters.liabilityStatus,
          asOfDate: filters.asOfDate,
        },
      },
    });

    return new Response(csv, {
      ...withPrivateNoStoreHeaders({
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="pto_liability_${formatDateForFilename(
            new Date(filters.asOfDate)
          )}.csv"`,
        },
      }),
    });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return new Response(
        error.message,
        withPrivateNoStoreHeaders({ status: error.status })
      );
    }

    return new Response(
      "Failed to export PTO liability report.",
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}
