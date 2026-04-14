import { prisma } from "../../../../../lib/db";
import { writeAuditLog } from "../../../../../lib/server/audit/write-audit-log";
import { withPrivateNoStoreHeaders } from "../../../../../lib/server/http/headers";
import {
  formatReportGeneratedAt,
  renderReportPdf,
} from "../../../../../lib/server/reports/pdf";
import {
  getPtoLiabilityExportRows,
  getPtoLiabilityFilters,
} from "../../../../../lib/server/reports/pto-liability";
import { ptoLiabilityReportNotes } from "../../../../../lib/server/reports/report-notes";
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
      attemptedAction: "REPORT_PTO_LIABILITY_PDF_EXPORT",
      entityType: "Report",
      entityId: "pto-liability",
    });

    const url = new URL(request.url);
    const snapshotDate = new Date();
    const filters = getPtoLiabilityFilters({
      employee: url.searchParams.get("employee") ?? undefined,
      department: url.searchParams.get("department") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      payrollFrequency: url.searchParams.get("payrollFrequency") ?? undefined,
      workLocation: url.searchParams.get("workLocation") ?? undefined,
      liabilityStatus: url.searchParams.get("liabilityStatus") ?? undefined,
      sort: url.searchParams.get("sort") ?? undefined,
      direction: url.searchParams.get("direction") ?? undefined,
      page: "1",
      pageSize: "10000",
    });

    const rows = await getPtoLiabilityExportRows(filters, snapshotDate);
    const pdf = renderReportPdf({
      title: ptoLiabilityReportNotes.title,
      subtitle: ptoLiabilityReportNotes.subtitle,
      generatedAt: formatReportGeneratedAt(snapshotDate),
      notes: ptoLiabilityReportNotes,
      appliedFilters: [
        { label: "Employee Search", value: filters.employee || "None" },
        { label: "Department", value: filters.department || "All departments" },
        { label: "Status", value: filters.status },
        {
          label: "Payroll Frequency",
          value: filters.payrollFrequency || "All payroll frequencies",
        },
        {
          label: "Work Location",
          value: filters.workLocation || "All work locations",
        },
        {
          label: "Liability Status",
          value: filters.liabilityStatus,
        },
        { label: "Sort", value: `${filters.sort} (${filters.direction})` },
      ],
      columns: [
        { label: "Employee", width: 15 },
        { label: "Emp ID", width: 10 },
        { label: "Dept", width: 10 },
        { label: "Status", width: 8 },
        { label: "Title", width: 12 },
        { label: "Location", width: 10 },
        { label: "Pay Freq", width: 12 },
        { label: "Liability", width: 12 },
        { label: "Liability Status", width: 16 },
        { label: "Snapshot", width: 10 },
      ],
      rows: rows.map((row) => [
        row.employeeName,
        row.employeeIdentifier,
        row.department ?? "",
        row.employeeStatus,
        row.jobTitle ?? "",
        row.workLocation ?? "",
        row.payrollFrequency,
        `$${row.estimatedPtoLiability.toFixed(2)}`,
        row.liabilityStatusLabel,
        row.snapshotDate,
      ]),
    });

    await writeAuditLog(prisma, {
      userId: actor.id,
      action: "REPORT_PTO_LIABILITY_PDF_EXPORT",
      entityType: "Report",
      entityId: "pto-liability",
      newValue: {
        rowCount: rows.length,
        filters: {
          employee: filters.employee || null,
          department: filters.department || null,
          status: filters.status,
          payrollFrequency: filters.payrollFrequency || null,
          workLocation: filters.workLocation || null,
          liabilityStatus: filters.liabilityStatus,
          snapshotDate: snapshotDate.toISOString(),
        },
      },
    });

    return new Response(pdf, {
      ...withPrivateNoStoreHeaders({
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="pto_liability_${formatDateForFilename(
            snapshotDate
          )}.pdf"`,
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
      "Failed to export PTO liability PDF.",
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}
