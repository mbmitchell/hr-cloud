import { prisma } from "../../../../../lib/db";
import { writeAuditLog } from "../../../../../lib/server/audit/write-audit-log";
import { withPrivateNoStoreHeaders } from "../../../../../lib/server/http/headers";
import { renderReportPdf, formatReportGeneratedAt } from "../../../../../lib/server/reports/pdf";
import { jobChangeHistoryReportNotes } from "../../../../../lib/server/reports/report-notes";
import {
  getJobChangeHistoryExportRows,
  getJobChangeHistoryFilters,
} from "../../../../../lib/server/reports/job-changes";
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
      attemptedAction: "REPORT_JOB_CHANGE_HISTORY_PDF_EXPORT",
      entityType: "Report",
      entityId: "job-changes",
    });

    const url = new URL(request.url);
    const filters = getJobChangeHistoryFilters({
      status: url.searchParams.get("status") ?? undefined,
      changeType: url.searchParams.get("changeType") ?? undefined,
      employee: url.searchParams.get("employee") ?? undefined,
      requestedBy: url.searchParams.get("requestedBy") ?? undefined,
      reviewedBy: url.searchParams.get("reviewedBy") ?? undefined,
      dateFrom: url.searchParams.get("dateFrom") ?? undefined,
      dateTo: url.searchParams.get("dateTo") ?? undefined,
      effectiveDateFrom: url.searchParams.get("effectiveDateFrom") ?? undefined,
      effectiveDateTo: url.searchParams.get("effectiveDateTo") ?? undefined,
      sort: url.searchParams.get("sort") ?? undefined,
      direction: url.searchParams.get("direction") ?? undefined,
      page: "1",
      pageSize: "10000",
    });

    const rows = await getJobChangeHistoryExportRows(filters);
    const pdf = renderReportPdf({
      title: jobChangeHistoryReportNotes.title,
      subtitle: jobChangeHistoryReportNotes.subtitle,
      generatedAt: formatReportGeneratedAt(),
      notes: jobChangeHistoryReportNotes,
      appliedFilters: [
        { label: "Status", value: filters.status },
        { label: "Change Type", value: filters.changeType },
        { label: "Employee", value: filters.employee || "All employees" },
        { label: "Requested By", value: filters.requestedById || "All" },
        { label: "Reviewed By", value: filters.reviewedById || "All" },
        { label: "Created From", value: filters.dateFrom || "Any" },
        { label: "Created To", value: filters.dateTo || "Any" },
        {
          label: "Effective Date Range",
          value:
            filters.effectiveDateFrom || filters.effectiveDateTo
              ? `${filters.effectiveDateFrom || "Any"} to ${filters.effectiveDateTo || "Any"}`
              : "Any",
        },
        { label: "Sort", value: `${filters.sort} (${filters.direction})` },
      ],
      columns: [
        { label: "Employee", width: 16 },
        { label: "Emp ID", width: 10 },
        { label: "Type", width: 12 },
        { label: "Status", width: 10 },
        { label: "Requested By", width: 14 },
        { label: "Reviewed By", width: 14 },
        { label: "Req Eff", width: 10 },
        { label: "Applied", width: 10 },
        { label: "Summary", width: 20 },
      ],
      rows: rows.map((row) => [
        row.employeeName,
        row.employeeIdentifier,
        row.changeType,
        row.status,
        row.requestedByName,
        row.reviewedByName ?? "",
        row.requestedEffectiveDate,
        row.appliedAt ? row.appliedAt.split("T")[0] : "",
        row.changeSummary,
      ]),
    });

    await writeAuditLog(prisma, {
      userId: actor.id,
      action: "REPORT_JOB_CHANGE_HISTORY_PDF_EXPORT",
      entityType: "Report",
      entityId: "job-changes",
      newValue: {
        rowCount: rows.length,
        filters: {
          status: filters.status,
          changeType: filters.changeType,
          employee: filters.employee || null,
          requestedById: filters.requestedById || null,
          reviewedById: filters.reviewedById || null,
          dateFrom: filters.dateFrom || null,
          dateTo: filters.dateTo || null,
          effectiveDateFrom: filters.effectiveDateFrom || null,
          effectiveDateTo: filters.effectiveDateTo || null,
        },
      },
    });

    return new Response(pdf, {
      ...withPrivateNoStoreHeaders({
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="job_change_history_${formatDateForFilename(
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
      "Failed to export job change history PDF.",
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}
