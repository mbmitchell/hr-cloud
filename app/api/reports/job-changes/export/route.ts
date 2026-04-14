import { prisma } from "../../../../../lib/db";
import { csvEscape } from "../../../../../lib/server/csv";
import { writeAuditLog } from "../../../../../lib/server/audit/write-audit-log";
import { withPrivateNoStoreHeaders } from "../../../../../lib/server/http/headers";
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
      attemptedAction: "REPORT_JOB_CHANGE_HISTORY_EXPORT",
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

    const csv = [
      [
        "Employee Name",
        "Employee ID",
        "Change Type",
        "Status",
        "Requested By",
        "Reviewed By",
        "Requested Effective Date",
        "Actual Effective Date",
        "Submitted At",
        "Approved At",
        "Applied At",
        "Cancelled At",
        "Change Summary",
        "Related Document",
      ]
        .map(csvEscape)
        .join(","),
      ...rows.map((row) =>
        [
          row.employeeName,
          row.employeeIdentifier,
          row.changeType,
          row.status,
          row.requestedByName,
          row.reviewedByName ?? "",
          row.requestedEffectiveDate,
          row.actualEffectiveDate ?? "",
          row.submittedAt ?? "",
          row.approvedAt ?? "",
          row.appliedAt ?? "",
          row.cancelledAt ?? "",
          row.changeSummary,
          row.relatedDocumentLinked ? row.relatedDocumentLabel : "None",
        ]
          .map(csvEscape)
          .join(",")
      ),
    ].join("\n");

    await writeAuditLog(prisma, {
      userId: actor.id,
      action: "REPORT_JOB_CHANGE_HISTORY_EXPORT",
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
          dateFilterBasis: "createdAt",
        },
      },
    });

    return new Response(csv, {
      ...withPrivateNoStoreHeaders({
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="job_change_history_${formatDateForFilename(
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
      "Failed to export job change history report.",
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}
