import { prisma } from "../../../../../lib/db";
import { csvEscape } from "../../../../../lib/server/csv";
import { writeAuditLog } from "../../../../../lib/server/audit/write-audit-log";
import { withPrivateNoStoreHeaders } from "../../../../../lib/server/http/headers";
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
      attemptedAction: "REPORT_USER_ACCESS_EXPORT",
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

    const csv = [
      [
        "Employee Name",
        "Employee ID",
        "Status",
        "Department",
        "Manager Name",
        "Current Role(s)",
        "Access Level",
        "Work Email",
        "Hire Date",
        "Job Title",
        "Work Location",
      ]
        .map(csvEscape)
        .join(","),
      ...rows.map((row) =>
        [
          row.employeeName,
          row.employeeIdentifier,
          row.status,
          row.department ?? "",
          row.managerName ?? "",
          row.currentRoles,
          row.accessLevel.replace("_", " "),
          row.workEmail,
          row.hireDate.split("T")[0],
          row.jobTitle ?? "",
          row.workLocation ?? "",
        ]
          .map(csvEscape)
          .join(",")
      ),
    ].join("\n");

    await writeAuditLog(prisma, {
      userId: actor.id,
      action: "REPORT_USER_ACCESS_EXPORT",
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

    return new Response(csv, {
      ...withPrivateNoStoreHeaders({
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="user_access_${formatDateForFilename(
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
      "Failed to export user access report.",
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}
