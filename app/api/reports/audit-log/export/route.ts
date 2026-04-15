import { prisma } from "../../../../../lib/db";
import { writeAuditLog } from "../../../../../lib/server/audit/write-audit-log";
import { csvEscape } from "../../../../../lib/server/csv";
import { withPrivateNoStoreHeaders } from "../../../../../lib/server/http/headers";
import {
  getAuditLogExportRows,
  getAuditLogFilters,
} from "../../../../../lib/server/reports/audit-log";
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
      attemptedAction: "REPORT_AUDIT_LOG_EXPORT",
      entityType: "Report",
      entityId: "audit-log",
    });

    const url = new URL(request.url);
    const filters = getAuditLogFilters({
      asOfDate: url.searchParams.get("asOfDate") ?? undefined,
      dateFrom: url.searchParams.get("dateFrom") ?? undefined,
      dateTo: url.searchParams.get("dateTo") ?? undefined,
      actor: url.searchParams.get("actor") ?? undefined,
      action: url.searchParams.get("action") ?? undefined,
      entityType: url.searchParams.get("entityType") ?? undefined,
      outcome: url.searchParams.get("outcome") ?? undefined,
      relatedEmployee: url.searchParams.get("relatedEmployee") ?? undefined,
      sort: url.searchParams.get("sort") ?? undefined,
      direction: url.searchParams.get("direction") ?? undefined,
      page: "1",
      pageSize: "10000",
    });

    const rows = await getAuditLogExportRows(filters);

    const csv = [
      [
        "Timestamp",
        "Actor Name",
        "Actor ID / Employee ID",
        "Action / Event Type",
        "Entity Type",
        "Entity ID",
        "Related Employee",
        "Outcome",
        "Summary / Details",
      ]
        .map(csvEscape)
        .join(","),
      ...rows.map((row) =>
        [
          row.timestamp,
          row.actorName ?? "",
          row.actorId,
          row.action,
          row.entityType,
          row.entityId,
          row.relatedEmployeeName ?? row.relatedEmployeeId ?? "",
          row.outcome,
          row.summary,
        ]
          .map(csvEscape)
          .join(",")
      ),
    ].join("\n");

    await writeAuditLog(prisma, {
      userId: actor.id,
      action: "REPORT_AUDIT_LOG_EXPORT",
      entityType: "Report",
      entityId: "audit-log",
      newValue: {
        rowCount: rows.length,
        filters: {
          asOfDate: filters.asOfDate,
          dateFrom: filters.dateFrom || null,
          dateTo: filters.dateTo || null,
          actor: filters.actor || null,
          action: filters.action || null,
          entityType: filters.entityType || null,
          outcome: filters.outcome,
          relatedEmployee: filters.relatedEmployee || null,
          authoritativeTimestampField: "createdAt",
        },
      },
    });

    return new Response(csv, {
      ...withPrivateNoStoreHeaders({
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="audit_log_${formatDateForFilename(
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
      "Failed to export audit log report.",
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}
