import Link from "next/link";
import ReportNotesPanel from "../../../components/reports/report-notes-panel";
import { ptoLedgerReportNotes } from "../../../lib/server/reports/report-notes";

import {
  getPtoLedgerFilters,
  getPtoLedgerReport,
  type PtoLedgerSortDirection,
  type PtoLedgerSortKey,
} from "../../../lib/server/reports/pto-ledger";
import {
  isAuthorizationError,
  requireRole,
} from "../../../lib/server/authorization";

type SearchParams = Promise<{
  employee?: string;
  entryType?: string;
  asOfDate?: string;
  dateFrom?: string;
  dateTo?: string;
  department?: string;
  status?: string;
  balanceState?: string;
  sort?: string;
  direction?: string;
  page?: string;
}>;

function buildQueryString(
  params: Record<string, string | number | null | undefined>
) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") {
      continue;
    }

    searchParams.set(key, String(value));
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatHours(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}

function SortLink({
  label,
  sortKey,
  currentSort,
  currentDirection,
  baseParams,
}: {
  label: string;
  sortKey: PtoLedgerSortKey;
  currentSort: PtoLedgerSortKey;
  currentDirection: PtoLedgerSortDirection;
  baseParams: Record<string, string | number | null | undefined>;
}) {
  const isActive = currentSort === sortKey;
  const nextDirection =
    isActive && currentDirection === "asc" ? "desc" : "asc";

  return (
    <Link
      href={`/reports/pto-ledger${buildQueryString({
        ...baseParams,
        sort: sortKey,
        direction: nextDirection,
        page: 1,
      })}`}
      className="inline-flex items-center gap-1 hover:text-slate-900"
    >
      <span>{label}</span>
      {isActive ? (
        <span className="text-xs text-slate-500">
          {currentDirection === "asc" ? "▲" : "▼"}
        </span>
      ) : null}
    </Link>
  );
}

function getEntryTypeClasses(entryType: string) {
  if (entryType === "FORFEITURE") {
    return "bg-amber-100 text-amber-900";
  }

  if (entryType === "USAGE" || entryType === "MANUAL_SUBTRACT") {
    return "bg-rose-100 text-rose-800";
  }

  return "bg-slate-100 text-slate-700";
}

export default async function PtoLedgerReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  try {
    await requireRole(["SITE_ADMIN", "HR_ADMIN"], {
      attemptedAction: "REPORT_PTO_LEDGER_VIEW",
      entityType: "Report",
      entityId: "pto-ledger",
    });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return (
        <div className="text-red-600">
          You do not have access to the PTO ledger report.
        </div>
      );
    }

    throw error;
  }

  const resolvedSearchParams = await searchParams;
  const filters = getPtoLedgerFilters(resolvedSearchParams);
  const report = await getPtoLedgerReport(filters);

  const baseParams = {
    employee: report.filters.employee,
    entryType: report.filters.entryType,
    asOfDate: report.filters.asOfDate,
    dateFrom: report.filters.dateFrom,
    dateTo: report.filters.dateTo,
    department: report.filters.department,
    status: report.filters.status,
    balanceState: report.filters.balanceState,
  };

  const exportHref = `/api/reports/pto-ledger/export${buildQueryString({
    ...baseParams,
    sort: report.filters.sort,
    direction: report.filters.direction,
  })}`;
  const exportPdfHref = `/api/reports/pto-ledger/export-pdf${buildQueryString({
    ...baseParams,
    sort: report.filters.sort,
    direction: report.filters.direction,
  })}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            PTO Ledger / Balance Report
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            PTO activity history and current ledger balances
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={exportHref}
            className="inline-flex w-full items-center justify-center rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 sm:w-auto"
          >
            Export CSV
          </Link>
          <Link
            href={exportPdfHref}
            className="inline-flex w-full items-center justify-center rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 sm:w-auto"
          >
            Export PDF
          </Link>
          <Link
            href={`/reports/pto-ledger${buildQueryString({
              ...baseParams,
              sort: report.filters.sort,
              direction: report.filters.direction,
              page: report.filters.page,
            })}`}
            className="inline-flex w-full items-center justify-center rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 sm:w-auto"
          >
            Refresh
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded bg-white p-5 shadow">
          <div className="text-sm text-slate-500">Total Ledger Entries</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {report.summary.totalLedgerEntries}
          </div>
        </div>
        <div className="rounded bg-white p-5 shadow">
          <div className="text-sm text-slate-500">
            Total Active Employees in Scope
          </div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {report.summary.totalActiveEmployeesInScope}
          </div>
        </div>
        <div className="rounded bg-white p-5 shadow">
          <div className="text-sm text-slate-500">
            Current Aggregate PTO Balance
          </div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {report.summary.currentAggregatePtoBalance.toFixed(2)}
          </div>
        </div>
        <div className="rounded bg-white p-5 shadow">
          <div className="text-sm text-slate-500">Negative Balance Employees</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {report.summary.negativeBalanceEmployees}
          </div>
        </div>
      </div>

      <ReportNotesPanel
        purpose={ptoLedgerReportNotes.purpose}
        sourceOfTruth={ptoLedgerReportNotes.sourceOfTruth}
        definitions={ptoLedgerReportNotes.definitions}
        filterExportNote={ptoLedgerReportNotes.filterExportNote}
      />

      <div className="rounded bg-white p-4 shadow">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div>
            <label className="mb-2 block text-sm font-medium">Employee</label>
            <input
              type="text"
              name="employee"
              defaultValue={report.filters.employee}
              placeholder="Search employee name or ID"
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Entry Type</label>
            <select
              name="entryType"
              defaultValue={report.filters.entryType}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">All entry types</option>
              {report.filterOptions.entryTypes.map((entryType) => (
                <option key={entryType} value={entryType}>
                  {entryType}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">As of Date</label>
            <input
              type="date"
              name="asOfDate"
              defaultValue={report.filters.asOfDate}
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Date From</label>
            <input
              type="date"
              name="dateFrom"
              defaultValue={report.filters.dateFrom}
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Date To</label>
            <input
              type="date"
              name="dateTo"
              defaultValue={report.filters.dateTo}
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Department</label>
            <select
              name="department"
              defaultValue={report.filters.department}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">All departments</option>
              {report.filterOptions.departments.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Status</label>
            <select
              name="status"
              defaultValue={report.filters.status}
              className="w-full rounded border px-3 py-2"
            >
              <option value="ALL">All</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Balance State
            </label>
            <select
              name="balanceState"
              defaultValue={report.filters.balanceState}
              className="w-full rounded border px-3 py-2"
            >
              <option value="ALL">All balances</option>
              <option value="NEGATIVE">Negative Balance Only</option>
              <option value="ZERO">Zero Balance Only</option>
              <option value="POSITIVE">Positive Balance Only</option>
            </select>
          </div>

          <input type="hidden" name="sort" value={report.filters.sort} />
          <input type="hidden" name="direction" value={report.filters.direction} />

          <div className="flex flex-col gap-3 md:col-span-2 xl:col-span-6 sm:flex-row">
            <button
              type="submit"
              className="w-full rounded bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-800 sm:w-auto"
            >
              Apply Filters
            </button>
            <Link
              href="/reports/pto-ledger"
              className="inline-flex w-full items-center justify-center rounded border border-slate-300 px-4 py-2.5 hover:bg-slate-50 sm:w-auto"
            >
              Reset
            </Link>
          </div>
        </form>
      </div>

      <div className="hidden overflow-hidden rounded bg-white shadow lg:block">
        <table className="w-full">
          <thead className="bg-slate-100 text-left text-sm">
            <tr>
              <th className="p-3">
                <SortLink
                  label="Employee Name"
                  sortKey="employeeName"
                  currentSort={report.filters.sort}
                  currentDirection={report.filters.direction}
                  baseParams={baseParams}
                />
              </th>
              <th className="p-3">Employee ID</th>
              <th className="p-3">
                <SortLink
                  label="Entry Date"
                  sortKey="effectiveDate"
                  currentSort={report.filters.sort}
                  currentDirection={report.filters.direction}
                  baseParams={baseParams}
                />
              </th>
              <th className="p-3">
                <SortLink
                  label="Entry Type"
                  sortKey="entryType"
                  currentSort={report.filters.sort}
                  currentDirection={report.filters.direction}
                  baseParams={baseParams}
                />
              </th>
              <th className="p-3">
                <SortLink
                  label="Hours"
                  sortKey="hours"
                  currentSort={report.filters.sort}
                  currentDirection={report.filters.direction}
                  baseParams={baseParams}
                />
              </th>
              <th className="p-3">
                <SortLink
                  label="Balance After Entry"
                  sortKey="balance"
                  currentSort={report.filters.sort}
                  currentDirection={report.filters.direction}
                  baseParams={baseParams}
                />
              </th>
              <th className="p-3">Reason / Description</th>
              <th className="p-3">Related Request or Source</th>
              <th className="p-3">Department</th>
              <th className="p-3">Employee Status</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr
                key={row.ledgerEntryId}
                className="border-t border-slate-200 align-top text-sm"
              >
                <td className="p-3 font-medium text-slate-900">
                  <Link
                    href={`/employees/${row.employeeId}`}
                    className="hover:text-slate-700 hover:underline"
                  >
                    {row.employeeName}
                  </Link>
                </td>
                <td className="p-3 text-slate-600">{row.employeeIdentifier}</td>
                <td className="p-3 text-slate-600">{formatDate(row.effectiveDate)}</td>
                <td className="p-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getEntryTypeClasses(
                      row.entryType
                    )}`}
                  >
                    {row.entryTypeLabel}
                  </span>
                </td>
                <td
                  className={`p-3 font-medium ${
                    row.hours < 0 ? "text-rose-700" : "text-emerald-700"
                  }`}
                >
                  {formatHours(row.hours)}
                </td>
                <td
                  className={`p-3 font-medium ${
                    row.balanceAfterEntry < 0 ? "text-rose-700" : "text-slate-900"
                  }`}
                >
                  {row.balanceAfterEntry.toFixed(2)}
                </td>
                <td className="p-3 text-slate-600">{row.reason ?? "—"}</td>
                <td className="p-3 text-slate-600">{row.relatedSource}</td>
                <td className="p-3 text-slate-600">{row.department ?? "—"}</td>
                <td className="p-3 text-slate-600">{row.employeeStatus}</td>
              </tr>
            ))}

            {report.rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-6 text-center text-sm text-slate-500">
                  No PTO ledger entries matched your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="space-y-4 lg:hidden">
        {report.rows.map((row) => (
          <div key={row.ledgerEntryId} className="rounded bg-white p-4 shadow">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link
                  href={`/employees/${row.employeeId}`}
                  className="font-semibold text-slate-900 hover:underline"
                >
                  {row.employeeName}
                </Link>
                <div className="text-sm text-slate-500">{row.employeeIdentifier}</div>
              </div>
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getEntryTypeClasses(
                  row.entryType
                )}`}
              >
                {row.entryTypeLabel}
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Entry Date</dt>
                <dd className="text-slate-900">{formatDate(row.effectiveDate)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Hours</dt>
                <dd
                  className={
                    row.hours < 0 ? "text-rose-700 font-medium" : "text-emerald-700 font-medium"
                  }
                >
                  {formatHours(row.hours)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Balance After Entry</dt>
                <dd
                  className={
                    row.balanceAfterEntry < 0
                      ? "text-rose-700 font-medium"
                      : "text-slate-900 font-medium"
                  }
                >
                  {row.balanceAfterEntry.toFixed(2)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Related Source</dt>
                <dd className="text-slate-900">{row.relatedSource}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Department</dt>
                <dd className="text-slate-900">{row.department ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Employee Status</dt>
                <dd className="text-slate-900">{row.employeeStatus}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-slate-500">Reason / Description</dt>
                <dd className="text-slate-900">{row.reason ?? "—"}</dd>
              </div>
            </dl>
          </div>
        ))}

        {report.rows.length === 0 ? (
          <div className="rounded bg-white p-6 text-sm text-slate-500 shadow">
            No PTO ledger entries matched your filters.
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 rounded bg-white p-4 shadow sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-600">
          Showing{" "}
          <span className="font-medium text-slate-900">
            {report.pagination.totalRows === 0
              ? 0
              : (report.pagination.page - 1) * report.pagination.pageSize + 1}
          </span>{" "}
          to{" "}
          <span className="font-medium text-slate-900">
            {Math.min(
              report.pagination.page * report.pagination.pageSize,
              report.pagination.totalRows
            )}
          </span>{" "}
          of{" "}
          <span className="font-medium text-slate-900">
            {report.pagination.totalRows}
          </span>{" "}
          ledger entries
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/reports/pto-ledger${buildQueryString({
              ...baseParams,
              sort: report.filters.sort,
              direction: report.filters.direction,
              page: Math.max(1, report.pagination.page - 1),
            })}`}
            className={`rounded border px-3 py-1.5 text-sm ${
              report.pagination.page <= 1
                ? "pointer-events-none border-slate-200 text-slate-400"
                : "border-slate-300 hover:bg-slate-50"
            }`}
          >
            Previous
          </Link>
          <div className="text-sm text-slate-600">
            Page {report.pagination.page} of {report.pagination.totalPages}
          </div>
          <Link
            href={`/reports/pto-ledger${buildQueryString({
              ...baseParams,
              sort: report.filters.sort,
              direction: report.filters.direction,
              page: Math.min(
                report.pagination.totalPages,
                report.pagination.page + 1
              ),
            })}`}
            className={`rounded border px-3 py-1.5 text-sm ${
              report.pagination.page >= report.pagination.totalPages
                ? "pointer-events-none border-slate-200 text-slate-400"
                : "border-slate-300 hover:bg-slate-50"
            }`}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}
