import { prisma } from "../../../../../lib/db";
import { writeAuditLog } from "../../../../../lib/server/audit/write-audit-log";
import { withPrivateNoStoreHeaders } from "../../../../../lib/server/http/headers";
import { renderReportPdf, formatReportGeneratedAt } from "../../../../../lib/server/reports/pdf";
import { reportingStructureReportNotes } from "../../../../../lib/server/reports/report-notes";
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
      attemptedAction: "REPORT_REPORTING_STRUCTURE_PDF_EXPORT",
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
    const pdf = renderReportPdf({
      title: reportingStructureReportNotes.title,
      subtitle: reportingStructureReportNotes.subtitle,
      generatedAt: formatReportGeneratedAt(),
      notes: reportingStructureReportNotes,
      appliedFilters: [
        { label: "Status", value: filters.status },
        { label: "Department", value: filters.department || "All departments" },
        { label: "Manager", value: filters.managerId || "All managers" },
        { label: "Employee Search", value: filters.search || "None" },
        { label: "Show", value: filters.show },
        { label: "Sort", value: `${filters.sort} (${filters.direction})` },
      ],
      columns: [
        { label: "Employee", width: 18 },
        { label: "Emp ID", width: 10 },
        { label: "Title", width: 12 },
        { label: "Dept", width: 12 },
        { label: "Manager", width: 18 },
        { label: "Mgr ID", width: 10 },
        { label: "Status", width: 8 },
        { label: "Hire Date", width: 10 },
        { label: "Role", width: 14 },
        { label: "Location", width: 10 },
      ],
      rows: rows.map((row) => [
        row.employeeName,
        row.employeeIdentifier,
        row.jobTitle ?? "",
        row.department ?? "",
        row.managerName ?? "No manager assigned",
        row.managerId ?? "",
        row.status,
        row.hireDate.split("T")[0],
        row.role,
        row.workLocation ?? "",
      ]),
    });

    await writeAuditLog(prisma, {
      userId: actor.id,
      action: "REPORT_REPORTING_STRUCTURE_PDF_EXPORT",
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

    return new Response(pdf, {
      ...withPrivateNoStoreHeaders({
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="reporting_structure_${formatDateForFilename(
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
      "Failed to export reporting structure PDF.",
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}
