import { prisma } from "../../../../../lib/db";
import { writeAuditLog } from "../../../../../lib/server/audit/write-audit-log";
import { csvEscape } from "../../../../../lib/server/csv";
import { withPrivateNoStoreHeaders } from "../../../../../lib/server/http/headers";
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
      attemptedAction: "REPORT_PTO_LEDGER_EXPORT",
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

    const csv = [
      [
        "Employee Name",
        "Employee ID",
        "Entry Date",
        "Entry Type",
        "Hours",
        "Balance After Entry",
        "Reason / Description",
        "Related Request or Source",
        "Department",
        "Employee Status",
      ]
        .map(csvEscape)
        .join(","),
      ...rows.map((row) =>
        [
          row.employeeName,
          row.employeeIdentifier,
          row.effectiveDate,
          row.entryTypeLabel,
          row.hours.toFixed(2),
          row.balanceAfterEntry.toFixed(2),
          row.reason ?? "",
          row.relatedSource,
          row.department ?? "",
          row.employeeStatus,
        ]
          .map(csvEscape)
          .join(",")
      ),
    ].join("\n");

    await writeAuditLog(prisma, {
      userId: actor.id,
      action: "REPORT_PTO_LEDGER_EXPORT",
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

    return new Response(csv, {
      ...withPrivateNoStoreHeaders({
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="pto_ledger_${formatDateForFilename(
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
      "Failed to export PTO ledger report.",
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}
