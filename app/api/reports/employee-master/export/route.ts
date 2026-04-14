import { prisma } from "../../../../../lib/db";
import { csvEscape } from "../../../../../lib/server/csv";
import { writeAuditLog } from "../../../../../lib/server/audit/write-audit-log";
import { withPrivateNoStoreHeaders } from "../../../../../lib/server/http/headers";
import {
  getEmployeeMasterExportRows,
  getEmployeeMasterFilters,
} from "../../../../../lib/server/reports/employee-master";
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
      attemptedAction: "REPORT_EMPLOYEE_MASTER_EXPORT",
      entityType: "Report",
      entityId: "employee-master",
    });

    const url = new URL(request.url);
    const filters = getEmployeeMasterFilters({
      status: url.searchParams.get("status") ?? undefined,
      department: url.searchParams.get("department") ?? undefined,
      role: url.searchParams.get("role") ?? undefined,
      manager: url.searchParams.get("manager") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      employmentClassification:
        url.searchParams.get("employmentClassification") ?? undefined,
      sort: url.searchParams.get("sort") ?? undefined,
      direction: url.searchParams.get("direction") ?? undefined,
      page: "1",
      pageSize: "10000",
    });

    const rows = await getEmployeeMasterExportRows(filters);

    const csv = [
      [
        "Employee Name",
        "Employee ID",
        "Status",
        "Job Title",
        "Department",
        "Manager Name",
        "Role",
        "Hire Date",
        "Work Location",
        "Employment Classification",
        "Work Email",
        "Payroll Frequency",
      ]
        .map(csvEscape)
        .join(","),
      ...rows.map((row) =>
        [
          row.employeeName,
          row.employeeIdentifier,
          row.status,
          row.jobTitle ?? "",
          row.department ?? "",
          row.managerName ?? "",
          row.role,
          row.hireDate.split("T")[0],
          row.workLocation ?? "",
          row.employmentClassification ?? "",
          row.workEmail,
          row.payrollFrequency,
        ]
          .map(csvEscape)
          .join(",")
      ),
    ].join("\n");

    await writeAuditLog(prisma, {
      userId: actor.id,
      action: "REPORT_EMPLOYEE_MASTER_EXPORT",
      entityType: "Report",
      entityId: "employee-master",
      newValue: {
        rowCount: rows.length,
        filters: {
          status: filters.status,
          department: filters.department || null,
          role: filters.role || null,
          managerId: filters.managerId || null,
          search: filters.search || null,
          employmentClassification:
            filters.employmentClassification || null,
        },
      },
    });

    return new Response(csv, {
      ...withPrivateNoStoreHeaders({
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="employee_master_${formatDateForFilename(
            new Date()
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
      "Failed to export employee master report.",
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}
