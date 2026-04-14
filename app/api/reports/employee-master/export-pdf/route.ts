import { prisma } from "../../../../../lib/db";
import { writeAuditLog } from "../../../../../lib/server/audit/write-audit-log";
import { withPrivateNoStoreHeaders } from "../../../../../lib/server/http/headers";
import { renderReportPdf, formatReportGeneratedAt } from "../../../../../lib/server/reports/pdf";
import { employeeMasterReportNotes } from "../../../../../lib/server/reports/report-notes";
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
      attemptedAction: "REPORT_EMPLOYEE_MASTER_PDF_EXPORT",
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
    const pdf = renderReportPdf({
      title: employeeMasterReportNotes.title,
      subtitle: employeeMasterReportNotes.subtitle,
      generatedAt: formatReportGeneratedAt(),
      notes: employeeMasterReportNotes,
      appliedFilters: [
        { label: "Status", value: filters.status },
        { label: "Department", value: filters.department || "All departments" },
        { label: "Role", value: filters.role || "All roles" },
        { label: "Manager", value: filters.managerId || "All managers" },
        { label: "Employee Search", value: filters.search || "None" },
        {
          label: "Employment Classification",
          value: filters.employmentClassification || "All classifications",
        },
        { label: "Sort", value: `${filters.sort} (${filters.direction})` },
      ],
      columns: [
        { label: "Employee", width: 18 },
        { label: "Emp ID", width: 10 },
        { label: "Status", width: 8 },
        { label: "Title", width: 12 },
        { label: "Dept", width: 12 },
        { label: "Manager", width: 16 },
        { label: "Role", width: 14 },
        { label: "Hire Date", width: 10 },
        { label: "Location", width: 10 },
        { label: "Class", width: 10 },
      ],
      rows: rows.map((row) => [
        row.employeeName,
        row.employeeIdentifier,
        row.status,
        row.jobTitle ?? "",
        row.department ?? "",
        row.managerName ?? "No manager assigned",
        row.role,
        row.hireDate.split("T")[0],
        row.workLocation ?? "",
        row.employmentClassification ?? "",
      ]),
    });

    await writeAuditLog(prisma, {
      userId: actor.id,
      action: "REPORT_EMPLOYEE_MASTER_PDF_EXPORT",
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
          employmentClassification: filters.employmentClassification || null,
        },
      },
    });

    return new Response(pdf, {
      ...withPrivateNoStoreHeaders({
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="employee_master_${formatDateForFilename(
            new Date()
          )}.pdf"`,
        },
      }),
    });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return new Response(error.message, withPrivateNoStoreHeaders({ status: error.status }));
    }

    return new Response(
      "Failed to export employee master PDF.",
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}
