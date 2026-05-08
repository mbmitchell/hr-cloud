import { prisma } from "../../../../../lib/db";
import { writeAuditLog } from "../../../../../lib/server/audit/write-audit-log";
import { csvEscape } from "../../../../../lib/server/csv";
import { withPrivateNoStoreHeaders } from "../../../../../lib/server/http/headers";
import {
  getDocumentAcknowledgementExportRows,
  getDocumentAcknowledgementFilters,
} from "../../../../../lib/server/reports/document-acknowledgements";
import {
  isAuthorizationError,
  requireRole,
} from "../../../../../lib/server/authorization";

function formatDateForFilename(date: Date) {
  return date.toISOString().split("T")[0];
}

function getStatusLabel(status: "ACKNOWLEDGED" | "PENDING" | "OVERDUE") {
  switch (status) {
    case "ACKNOWLEDGED":
      return "Acknowledged";
    case "OVERDUE":
      return "Overdue";
    case "PENDING":
    default:
      return "Pending";
  }
}

export async function GET(request: Request) {
  try {
    const actor = await requireRole(["SITE_ADMIN", "HR_ADMIN"], {
      attemptedAction: "REPORT_DOCUMENT_ACKNOWLEDGEMENTS_EXPORT",
      entityType: "Report",
      entityId: "document-acknowledgements",
    });

    const url = new URL(request.url);
    const filters = getDocumentAcknowledgementFilters({
      status: url.searchParams.get("status") ?? undefined,
      asOfDate: url.searchParams.get("asOfDate") ?? undefined,
      document: url.searchParams.get("document") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      employee: url.searchParams.get("employee") ?? undefined,
      assignedBy: url.searchParams.get("assignedBy") ?? undefined,
      assignedDateFrom: url.searchParams.get("assignedDateFrom") ?? undefined,
      assignedDateTo: url.searchParams.get("assignedDateTo") ?? undefined,
      acknowledgedDateFrom:
        url.searchParams.get("acknowledgedDateFrom") ?? undefined,
      acknowledgedDateTo:
        url.searchParams.get("acknowledgedDateTo") ?? undefined,
      sort: url.searchParams.get("sort") ?? undefined,
      direction: url.searchParams.get("direction") ?? undefined,
      page: "1",
      pageSize: "10000",
    });

    const rows = await getDocumentAcknowledgementExportRows(filters);

    const csv = [
      [
        "Employee Name",
        "Employee ID",
        "Document Name",
        "Document Version",
        "Document Category",
        "Assigned Date",
        "Due Date",
        "Acknowledged Date",
        "Status",
        "Assigned By",
      ]
        .map(csvEscape)
        .join(","),
      ...rows.map((row) =>
        [
          row.employeeName,
          row.employeeIdentifier,
          row.documentName,
          row.documentVersion,
          row.documentCategory ?? "",
          row.assignedAt,
          row.dueDate ?? "",
          row.acknowledgedAt ?? "",
          getStatusLabel(row.status),
          row.assignedByName,
        ]
          .map(csvEscape)
          .join(",")
      ),
    ].join("\n");

    await writeAuditLog(prisma, {
      userId: actor.id,
      action: "REPORT_DOCUMENT_ACKNOWLEDGEMENTS_EXPORT",
      entityType: "Report",
      entityId: "document-acknowledgements",
      newValue: {
        rowCount: rows.length,
        filters: {
          status: filters.status,
          asOfDate: filters.asOfDate,
          documentId: filters.documentId || null,
          category: filters.category || null,
          employee: filters.employee || null,
          assignedById: filters.assignedById || null,
          assignedDateFrom: filters.assignedDateFrom || null,
          assignedDateTo: filters.assignedDateTo || null,
          acknowledgedDateFrom: filters.acknowledgedDateFrom || null,
          acknowledgedDateTo: filters.acknowledgedDateTo || null,
        },
      },
    });

    return new Response(csv, {
      ...withPrivateNoStoreHeaders({
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="document_acknowledgements_${formatDateForFilename(
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
      "Failed to export document acknowledgement report.",
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}
