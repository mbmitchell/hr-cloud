import Link from "next/link";

import ReportNotesPanel from "../../../components/reports/report-notes-panel";
import {
  getPtoLiabilityFilters,
  getPtoLiabilityReport,
  type PtoLiabilitySortDirection,
  type PtoLiabilitySortKey,
} from "../../../lib/server/reports/pto-liability";
import { ptoLiabilityReportNotes } from "../../../lib/server/reports/report-notes";
import {
  isAuthorizationError,
  requireRole,
} from "../../../lib/server/authorization";

type SearchParams = Promise<{
  employee?: string;
  department?: string;
  status?: string;
  payrollFrequency?: string;
  workLocation?: string;
  liabilityStatus?: string;
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function SortLink({
  label,
  sortKey,
  currentSort,
  currentDirection,
  baseParams,
}: {
  label: string;
  sortKey: PtoLiabilitySortKey;
  currentSort: PtoLiabilitySortKey;
  currentDirection: PtoLiabilitySortDirection;
  baseParams: Record<string, string | number | null | undefined>;
}) {
  const isActive = currentSort === sortKey;
  const nextDirection =
    isActive && currentDirection === "asc" ? "desc" : "asc";

  return (
    <Link
      href={`/reports/pto-liability${buildQueryString({
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

function getLiabilityStatusClasses(status: string) {
  switch (status) {
    case "WITH_LIABILITY":
      return "bg-emerald-100 text-emerald-800";
    case "NEGATIVE_BALANCE_REVIEW":
      return "bg-amber-100 text-amber-900";
    case "REVIEW_REQUIRED":
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default async function PtoLiabilityReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  try {
    await requireRole(["SITE_ADMIN", "HR_ADMIN"], {
      attemptedAction: "REPORT_PTO_LIABILITY_VIEW",
      entityType: "Report",
      entityId: "pto-liability",
    });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return (
        <div className="text-red-600">
          You do not have access to the PTO liability report.
        </div>
      );
    }

    throw error;
  }

  const resolvedSearchParams = await searchParams;
  const filters = getPtoLiabilityFilters(resolvedSearchParams);
  const report = await getPtoLiabilityReport(filters);

  const baseParams = {
    employee: report.filters.employee,
    department: report.filters.department,
    status: report.filters.status,
    payrollFrequency: report.filters.payrollFrequency,
    workLocation: report.filters.workLocation,
    liabilityStatus: report.filters.liabilityStatus,
  };

  const exportHref = `/api/reports/pto-liability/export${buildQueryString({
    ...baseParams,
    sort: report.filters.sort,
    direction: report.filters.direction,
  })}`;
  const exportPdfHref = `/api/reports/pto-liability/export-pdf${buildQueryString({
    ...baseParams,
    sort: report.filters.sort,
    direction: report.filters.direction,
  })}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            PTO Liability Report
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Estimated PTO payout exposure for current employee scope
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
            href={`/reports/pto-liability${buildQueryString({
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
          <div className="text-sm text-slate-500">Total Employees in Scope</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {report.summary.totalEmployeesInScope}
          </div>
        </div>
        <div className="rounded bg-white p-5 shadow">
          <div className="text-sm text-slate-500">Employees With Liability</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {report.summary.employeesWithLiability}
          </div>
        </div>
        <div className="rounded bg-white p-5 shadow">
          <div className="text-sm text-slate-500">Negative Balance Review</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {report.summary.negativeBalanceReview}
          </div>
        </div>
        <div className="rounded bg-white p-5 shadow">
          <div className="text-sm text-slate-500">Total PTO Liability</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {formatCurrency(report.summary.totalPtoLiability)}
          </div>
        </div>
      </div>

      <ReportNotesPanel
        purpose={ptoLiabilityReportNotes.purpose}
        sourceOfTruth={ptoLiabilityReportNotes.sourceOfTruth}
        definitions={ptoLiabilityReportNotes.definitions}
        filterExportNote={ptoLiabilityReportNotes.filterExportNote}
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
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ALL">All</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Payroll Frequency
            </label>
            <select
              name="payrollFrequency"
              defaultValue={report.filters.payrollFrequency}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">All payroll frequencies</option>
              {report.filterOptions.payrollFrequencies.map((payrollFrequency) => (
                <option key={payrollFrequency} value={payrollFrequency}>
                  {payrollFrequency}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Work Location</label>
            <select
              name="workLocation"
              defaultValue={report.filters.workLocation}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">All work locations</option>
              {report.filterOptions.workLocations.map((workLocation) => (
                <option key={workLocation} value={workLocation}>
                  {workLocation}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Liability Status
            </label>
            <select
              name="liabilityStatus"
              defaultValue={report.filters.liabilityStatus}
              className="w-full rounded border px-3 py-2"
            >
              <option value="ALL">All</option>
              <option value="WITH_LIABILITY">With Liability</option>
              <option value="NO_LIABILITY">No Liability</option>
              <option value="NEGATIVE_BALANCE_REVIEW">
                Negative Balance Review
              </option>
              <option value="REVIEW_REQUIRED">Review Required</option>
            </select>
          </div>

          <input type="hidden" name="sort" value={report.filters.sort} />
          <input
            type="hidden"
            name="direction"
            value={report.filters.direction}
          />
          <input type="hidden" name="page" value="1" />

          <div className="flex items-end gap-3 md:col-span-2 xl:col-span-6">
            <button
              type="submit"
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Apply Filters
            </button>
            <Link
              href="/reports/pto-liability"
              className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
            >
              Reset
            </Link>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded bg-white shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 text-left text-sm text-slate-600">
              <tr>
                <th className="px-4 py-3">
                  <SortLink
                    label="Employee Name"
                    sortKey="employeeName"
                    currentSort={report.filters.sort}
                    currentDirection={report.filters.direction}
                    baseParams={baseParams}
                  />
                </th>
                <th className="px-4 py-3">Employee ID</th>
                <th className="px-4 py-3">
                  <SortLink
                    label="Department"
                    sortKey="department"
                    currentSort={report.filters.sort}
                    currentDirection={report.filters.direction}
                    baseParams={baseParams}
                  />
                </th>
                <th className="px-4 py-3">
                  <SortLink
                    label="Status"
                    sortKey="status"
                    currentSort={report.filters.sort}
                    currentDirection={report.filters.direction}
                    baseParams={baseParams}
                  />
                </th>
                <th className="px-4 py-3">Job Title</th>
                <th className="px-4 py-3">
                  <SortLink
                    label="Work Location"
                    sortKey="workLocation"
                    currentSort={report.filters.sort}
                    currentDirection={report.filters.direction}
                    baseParams={baseParams}
                  />
                </th>
                <th className="px-4 py-3">
                  <SortLink
                    label="Payroll Frequency"
                    sortKey="payrollFrequency"
                    currentSort={report.filters.sort}
                    currentDirection={report.filters.direction}
                    baseParams={baseParams}
                  />
                </th>
                <th className="px-4 py-3">
                  <SortLink
                    label="Estimated PTO Liability"
                    sortKey="liability"
                    currentSort={report.filters.sort}
                    currentDirection={report.filters.direction}
                    baseParams={baseParams}
                  />
                </th>
                <th className="px-4 py-3">Liability Status</th>
                <th className="px-4 py-3">Snapshot Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {report.rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                    No employees matched the current filters.
                  </td>
                </tr>
              ) : (
                report.rows.map((row) => (
                  <tr key={row.employeeId} className="align-top">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <Link
                        href={`/employees/${row.employeeId}`}
                        className="hover:underline"
                      >
                        {row.employeeName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.employeeIdentifier}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.department ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.employeeStatus}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.jobTitle ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.workLocation ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.payrollFrequency}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {formatCurrency(row.estimatedPtoLiability)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getLiabilityStatusClasses(
                          row.liabilityStatus
                        )}`}
                      >
                        {row.liabilityStatusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.snapshotDate}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
          <div>
            Page {report.pagination.page} of {report.pagination.totalPages} •{" "}
            {report.pagination.totalRows} rows
          </div>

          <div className="flex gap-2">
            <Link
              href={`/reports/pto-liability${buildQueryString({
                ...baseParams,
                sort: report.filters.sort,
                direction: report.filters.direction,
                page: Math.max(1, report.pagination.page - 1),
              })}`}
              className={`rounded border px-3 py-1.5 ${
                report.pagination.page <= 1
                  ? "pointer-events-none border-slate-200 text-slate-300"
                  : "border-slate-300 hover:bg-slate-50"
              }`}
            >
              Previous
            </Link>
            <Link
              href={`/reports/pto-liability${buildQueryString({
                ...baseParams,
                sort: report.filters.sort,
                direction: report.filters.direction,
                page: Math.min(
                  report.pagination.totalPages,
                  report.pagination.page + 1
                ),
              })}`}
              className={`rounded border px-3 py-1.5 ${
                report.pagination.page >= report.pagination.totalPages
                  ? "pointer-events-none border-slate-200 text-slate-300"
                  : "border-slate-300 hover:bg-slate-50"
              }`}
            >
              Next
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
