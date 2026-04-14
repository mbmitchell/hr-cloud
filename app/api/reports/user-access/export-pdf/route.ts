import { prisma } from "../../../../../lib/db";
import { writeAuditLog } from "../../../../../lib/server/audit/write-audit-log";
import { withPrivateNoStoreHeaders } from "../../../../../lib/server/http/headers";
import { renderReportPdf, formatReportGeneratedAt } from "../../../../../lib/server/reports/pdf";
import { userAccessReportNotes } from "../../../../../lib/server/reports/report-notes";
import {
  getUserAccessExportRows,
  getUserAccessFilters,
} from "../../../../../lib/server/reports/user-access";
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
      attemptedAction: "REPORT_USER_ACCESS_PDF_EXPORT",
      entityType: "Report",
      entityId: "user-access",
    });

    const url = new URL(request.url);
    const filters = getUserAccessFilters({
      status: url.searchParams.get("status") ?? undefined,
      role: url.searchParams.get("role") ?? undefined,
      department: url.searchParams.get("department") ?? undefined,
      manager: url.searchParams.get("manager") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      accessLevel: url.searchParams.get("accessLevel") ?? undefined,
      sort: url.searchParams.get("sort") ?? undefined,
      direction: url.searchParams.get("direction") ?? undefined,
      page: "1",
      pageSize: "10000",
    });

    const rows = await getUserAccessExportRows(filters);
    const pdf = renderReportPdf({
      title: userAccessReportNotes.title,
      subtitle: userAccessReportNotes.subtitle,
      generatedAt: formatReportGeneratedAt(),
      notes: userAccessReportNotes,
      appliedFilters: [
        { label: "Status", value: filters.status },
        { label: "Role", value: filters.role || "All roles" },
        { label: "Department", value: filters.department || "All departments" },
        { label: "Manager", value: filters.managerId || "All managers" },
        { label: "Employee Search", value: filters.search || "None" },
        { label: "Access Level", value: filters.accessLevel },
        { label: "Sort", value: `${filters.sort} (${filters.direction})` },
      ],
      columns: [
        { label: "Employee", width: 18 },
        { label: "Emp ID", width: 10 },
        { label: "Status", width: 8 },
        { label: "Dept", width: 12 },
        { label: "Manager", width: 16 },
        { label: "Roles", width: 18 },
        { label: "Access", width: 10 },
        { label: "Work Email", width: 20 },
        { label: "Hire Date", width: 10 },
      ],
      rows: rows.map((row) => [
        row.employeeName,
        row.employeeIdentifier,
        row.status,
        row.department ?? "",
        row.managerName ?? "",
        row.currentRoles,
        row.accessLevel,
        row.workEmail,
        row.hireDate.split("T")[0],
      ]),
    });

    await writeAuditLog(prisma, {
      userId: actor.id,
      action: "REPORT_USER_ACCESS_PDF_EXPORT",
      entityType: "Report",
      entityId: "user-access",
      newValue: {
        rowCount: rows.length,
        filters: {
          status: filters.status,
          role: filters.role || null,
          department: filters.department || null,
          managerId: filters.managerId || null,
          search: filters.search || null,
          accessLevel: filters.accessLevel,
        },
      },
    });

    return new Response(pdf, {
      ...withPrivateNoStoreHeaders({
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="user_access_${formatDateForFilename(
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
      "Failed to export user access PDF.",
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}
