import { prisma } from "../../../../../lib/db";
import { csvEscape } from "../../../../../lib/server/csv";
import { writeAuditLog } from "../../../../../lib/server/audit/write-audit-log";
import { withPrivateNoStoreHeaders } from "../../../../../lib/server/http/headers";
import {
  getReportingStructureExportRows,
  getReportingStructureFilters,
} from "../../../../../lib/server/reports/reporting-structure";
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
      attemptedAction: "REPORT_REPORTING_STRUCTURE_EXPORT",
      entityType: "Report",
      entityId: "reporting-structure",
    });

    const url = new URL(request.url);
    const filters = getReportingStructureFilters({
      status: url.searchParams.get("status") ?? undefined,
      department: url.searchParams.get("department") ?? undefined,
      manager: url.searchParams.get("manager") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      show: url.searchParams.get("show") ?? undefined,
      sort: url.searchParams.get("sort") ?? undefined,
      direction: url.searchParams.get("direction") ?? undefined,
      page: "1",
      pageSize: "10000",
    });

    const rows = await getReportingStructureExportRows(filters);

    const csv = [
      [
        "Employee Name",
        "Employee ID",
        "Job Title",
        "Department",
        "Manager Name",
        "Manager ID",
        "Status",
        "Hire Date",
        "Role",
        "Work Location",
        "Employment Classification",
      ]
        .map(csvEscape)
        .join(","),
      ...rows.map((row) =>
        [
          row.employeeName,
          row.employeeIdentifier,
          row.jobTitle ?? "",
          row.department ?? "",
          row.managerName ?? "",
          row.managerId ?? "",
          row.status,
          row.hireDate.split("T")[0],
          row.role,
          row.workLocation ?? "",
          row.employmentClassification ?? "",
        ]
          .map(csvEscape)
          .join(",")
      ),
    ].join("\n");

    await writeAuditLog(prisma, {
      userId: actor.id,
      action: "REPORT_REPORTING_STRUCTURE_EXPORT",
      entityType: "Report",
      entityId: "reporting-structure",
      newValue: {
        rowCount: rows.length,
        filters: {
          status: filters.status,
          department: filters.department || null,
          managerId: filters.managerId || null,
          search: filters.search || null,
          show: filters.show,
        },
      },
    });

    return new Response(csv, {
      ...withPrivateNoStoreHeaders({
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="reporting_structure_${formatDateForFilename(
            new Date()
          )}.csv"`,
        },
      }),
    });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return new Response(error.message, withPrivateNoStoreHeaders({ status: error.status }));
    }

    return new Response(
      "Failed to export reporting structure report.",
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}
