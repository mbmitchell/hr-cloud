import { prisma } from "../../../../../lib/db";
import { writeAuditLog } from "../../../../../lib/server/audit/write-audit-log";
import { withPrivateNoStoreHeaders } from "../../../../../lib/server/http/headers";
import { renderReportPdf, formatReportGeneratedAt } from "../../../../../lib/server/reports/pdf";
import { ptoLedgerReportNotes } from "../../../../../lib/server/reports/report-notes";
import {
  getPtoLedgerExportRows,
  getPtoLedgerFilters,
} from "../../../../../lib/server/reports/pto-ledger";
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
      attemptedAction: "REPORT_PTO_LEDGER_PDF_EXPORT",
      entityType: "Report",
      entityId: "pto-ledger",
    });

    const url = new URL(request.url);
    const filters = getPtoLedgerFilters({
      employee: url.searchParams.get("employee") ?? undefined,
      entryType: url.searchParams.get("entryType") ?? undefined,
      asOfDate: url.searchParams.get("asOfDate") ?? undefined,
      dateFrom: url.searchParams.get("dateFrom") ?? undefined,
      dateTo: url.searchParams.get("dateTo") ?? undefined,
      department: url.searchParams.get("department") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      balanceState: url.searchParams.get("balanceState") ?? undefined,
      sort: url.searchParams.get("sort") ?? undefined,
      direction: url.searchParams.get("direction") ?? undefined,
      page: "1",
      pageSize: "10000",
    });

    const rows = await getPtoLedgerExportRows(filters);
    const pdf = renderReportPdf({
      title: ptoLedgerReportNotes.title,
      subtitle: ptoLedgerReportNotes.subtitle,
      generatedAt: formatReportGeneratedAt(),
      notes: ptoLedgerReportNotes,
      appliedFilters: [
        { label: "Employee Search", value: filters.employee || "None" },
        { label: "Entry Type", value: filters.entryType || "All entry types" },
        { label: "As of Date", value: filters.asOfDate },
        {
          label: "Date Range",
          value:
            filters.dateFrom || filters.dateTo
              ? `${filters.dateFrom || "Any"} to ${filters.dateTo || "Any"}`
              : "Any",
        },
        { label: "Department", value: filters.department || "All departments" },
        { label: "Status", value: filters.status },
        { label: "Balance State", value: filters.balanceState },
        { label: "Sort", value: `${filters.sort} (${filters.direction})` },
      ],
      columns: [
        { label: "Employee", width: 16 },
        { label: "Emp ID", width: 10 },
        { label: "Entry Date", width: 10 },
        { label: "Entry Type", width: 12 },
        { label: "Hours", width: 8 },
        { label: "Balance", width: 10 },
        { label: "Reason", width: 18 },
        { label: "Source", width: 14 },
        { label: "Dept", width: 10 },
        { label: "Status", width: 8 },
      ],
      rows: rows.map((row) => [
        row.employeeName,
        row.employeeIdentifier,
        row.effectiveDate.split("T")[0],
        row.entryTypeLabel,
        row.hours.toFixed(2),
        row.balanceAfterEntry.toFixed(2),
        row.reason ?? "",
        row.relatedSource,
        row.department ?? "",
        row.employeeStatus,
      ]),
    });

    await writeAuditLog(prisma, {
      userId: actor.id,
      action: "REPORT_PTO_LEDGER_PDF_EXPORT",
      entityType: "Report",
      entityId: "pto-ledger",
      newValue: {
        rowCount: rows.length,
        filters: {
          employee: filters.employee || null,
          entryType: filters.entryType || null,
          asOfDate: filters.asOfDate,
          dateFrom: filters.dateFrom || null,
          dateTo: filters.dateTo || null,
          department: filters.department || null,
          status: filters.status,
          balanceState: filters.balanceState,
          authoritativeDateField: "effectiveDate",
        },
      },
    });

    return new Response(pdf, {
      ...withPrivateNoStoreHeaders({
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="pto_ledger_${formatDateForFilename(
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
      "Failed to export PTO ledger PDF.",
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}
