import { prisma } from "../../../../../lib/db";
import { writeAuditLog } from "../../../../../lib/server/audit/write-audit-log";
import { withPrivateNoStoreHeaders } from "../../../../../lib/server/http/headers";
import { renderReportPdf, formatReportGeneratedAt } from "../../../../../lib/server/reports/pdf";
import { documentAcknowledgementReportNotes } from "../../../../../lib/server/reports/report-notes";
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

export async function GET(request: Request) {
  try {
    const actor = await requireRole(["SITE_ADMIN", "HR_ADMIN"], {
      attemptedAction: "REPORT_DOCUMENT_ACKNOWLEDGEMENTS_PDF_EXPORT",
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
    const pdf = renderReportPdf({
      title: documentAcknowledgementReportNotes.title,
      subtitle: documentAcknowledgementReportNotes.subtitle,
      generatedAt: formatReportGeneratedAt(),
      notes: documentAcknowledgementReportNotes,
      appliedFilters: [
        { label: "Status", value: filters.status },
        { label: "As of Date", value: filters.asOfDate },
        { label: "Document", value: filters.documentId || "All documents" },
        { label: "Category", value: filters.category || "All categories" },
        { label: "Employee Search", value: filters.employee || "None" },
        { label: "Assigned By", value: filters.assignedById || "All assigners" },
        {
          label: "Assigned Range",
          value:
            filters.assignedDateFrom || filters.assignedDateTo
              ? `${filters.assignedDateFrom || "Any"} to ${filters.assignedDateTo || "Any"}`
              : "Any",
        },
        {
          label: "Acknowledged Range",
          value:
            filters.acknowledgedDateFrom || filters.acknowledgedDateTo
              ? `${filters.acknowledgedDateFrom || "Any"} to ${filters.acknowledgedDateTo || "Any"}`
              : "Any",
        },
        { label: "Sort", value: `${filters.sort} (${filters.direction})` },
      ],
      columns: [
        { label: "Employee", width: 16 },
        { label: "Emp ID", width: 10 },
        { label: "Document", width: 18 },
        { label: "Version", width: 10 },
        { label: "Category", width: 12 },
        { label: "Assigned", width: 10 },
        { label: "Due", width: 10 },
        { label: "Ack Date", width: 10 },
        { label: "Status", width: 10 },
        { label: "Assigned By", width: 14 },
      ],
      rows: rows.map((row) => [
        row.employeeName,
        row.employeeIdentifier,
        row.documentName,
        row.documentVersion,
        row.documentCategory ?? "",
        row.assignedAt.split("T")[0],
        row.dueDate ? row.dueDate.split("T")[0] : "",
        row.acknowledgedAt ? row.acknowledgedAt.split("T")[0] : "",
        row.status,
        row.assignedByName,
      ]),
    });

    await writeAuditLog(prisma, {
      userId: actor.id,
      action: "REPORT_DOCUMENT_ACKNOWLEDGEMENTS_PDF_EXPORT",
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

    return new Response(pdf, {
      ...withPrivateNoStoreHeaders({
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="document_acknowledgements_${formatDateForFilename(
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
      "Failed to export document acknowledgement PDF.",
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}
