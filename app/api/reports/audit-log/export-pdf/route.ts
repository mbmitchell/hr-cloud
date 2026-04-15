import { prisma } from "../../../../../lib/db";
import { writeAuditLog } from "../../../../../lib/server/audit/write-audit-log";
import { withPrivateNoStoreHeaders } from "../../../../../lib/server/http/headers";
import { renderReportPdf, formatReportGeneratedAt } from "../../../../../lib/server/reports/pdf";
import { auditLogReportNotes } from "../../../../../lib/server/reports/report-notes";
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
      attemptedAction: "REPORT_AUDIT_LOG_PDF_EXPORT",
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
    const pdf = renderReportPdf({
      title: auditLogReportNotes.title,
      subtitle: auditLogReportNotes.subtitle,
      generatedAt: formatReportGeneratedAt(),
      notes: auditLogReportNotes,
      appliedFilters: [
        { label: "As of Date", value: filters.asOfDate },
        {
          label: "Date Range",
          value:
            filters.dateFrom || filters.dateTo
              ? `${filters.dateFrom || "Any"} to ${filters.dateTo || "Any"}`
              : "Any",
        },
        { label: "Actor", value: filters.actor || "All actors" },
        { label: "Action", value: filters.action || "All actions" },
        { label: "Entity Type", value: filters.entityType || "All entity types" },
        { label: "Outcome", value: filters.outcome },
        {
          label: "Related Employee",
          value: filters.relatedEmployee || "All related employees",
        },
        { label: "Sort", value: `${filters.sort} (${filters.direction})` },
      ],
      columns: [
        { label: "Timestamp", width: 18 },
        { label: "Actor", width: 16 },
        { label: "Actor ID", width: 12 },
        { label: "Action", width: 18 },
        { label: "Entity", width: 12 },
        { label: "Entity ID", width: 12 },
        { label: "Related Emp", width: 16 },
        { label: "Outcome", width: 8 },
        { label: "Summary", width: 18 },
      ],
      rows: rows.map((row) => [
        row.timestamp.replace("T", " ").slice(0, 16),
        row.actorName ?? "",
        row.actorId,
        row.action,
        row.entityType,
        row.entityId,
        row.relatedEmployeeName ?? row.relatedEmployeeId ?? "",
        row.outcome,
        row.summary,
      ]),
    });

    await writeAuditLog(prisma, {
      userId: actor.id,
      action: "REPORT_AUDIT_LOG_PDF_EXPORT",
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

    return new Response(pdf, {
      ...withPrivateNoStoreHeaders({
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="audit_log_${formatDateForFilename(
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
      "Failed to export audit log PDF.",
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}
