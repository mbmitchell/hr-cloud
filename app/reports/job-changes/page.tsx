import Link from "next/link";
import ReportNotesPanel from "../../../components/reports/report-notes-panel";
import { jobChangeHistoryReportNotes } from "../../../lib/server/reports/report-notes";

import {
  getJobChangeHistoryFilters,
  getJobChangeHistoryReport,
  type JobChangeHistorySortDirection,
  type JobChangeHistorySortKey,
} from "../../../lib/server/reports/job-changes";
import {
  isAuthorizationError,
  requireRole,
} from "../../../lib/server/authorization";

type SearchParams = Promise<{
  status?: string;
  changeType?: string;
  employee?: string;
  requestedBy?: string;
  reviewedBy?: string;
  dateFrom?: string;
  dateTo?: string;
  effectiveDateFrom?: string;
  effectiveDateTo?: string;
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

function SortLink({
  label,
  sortKey,
  currentSort,
  currentDirection,
  baseParams,
}: {
  label: string;
  sortKey: JobChangeHistorySortKey;
  currentSort: JobChangeHistorySortKey;
  currentDirection: JobChangeHistorySortDirection;
  baseParams: Record<string, string | number | null | undefined>;
}) {
  const isActive = currentSort === sortKey;
  const nextDirection =
    isActive && currentDirection === "asc" ? "desc" : "asc";

  return (
    <Link
      href={`/reports/job-changes${buildQueryString({
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

function statusBadgeClass(status: string) {
  switch (status) {
    case "DRAFT":
      return "bg-slate-100 text-slate-700";
    case "PENDING":
      return "bg-amber-100 text-amber-800";
    case "APPROVED":
      return "bg-blue-100 text-blue-800";
    case "APPLIED":
      return "bg-emerald-100 text-emerald-800";
    case "CANCELLED":
      return "bg-red-100 text-red-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default async function JobChangeHistoryReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  try {
    await requireRole(["SITE_ADMIN", "HR_ADMIN"], {
      attemptedAction: "REPORT_JOB_CHANGE_HISTORY_VIEW",
      entityType: "Report",
      entityId: "job-changes",
    });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return (
        <div className="text-red-600">
          You do not have access to the job change history report.
        </div>
      );
    }

    throw error;
  }

  const resolvedSearchParams = await searchParams;
  const filters = getJobChangeHistoryFilters(resolvedSearchParams);
  const report = await getJobChangeHistoryReport(filters);

  const baseParams = {
    status: report.filters.status,
    changeType: report.filters.changeType,
    employee: report.filters.employee,
    requestedBy: report.filters.requestedById,
    reviewedBy: report.filters.reviewedById,
    dateFrom: report.filters.dateFrom,
    dateTo: report.filters.dateTo,
    effectiveDateFrom: report.filters.effectiveDateFrom,
    effectiveDateTo: report.filters.effectiveDateTo,
  };

  const exportHref = `/api/reports/job-changes/export${buildQueryString({
    ...baseParams,
    sort: report.filters.sort,
    direction: report.filters.direction,
  })}`;
  const exportPdfHref = `/api/reports/job-changes/export-pdf${buildQueryString({
    ...baseParams,
    sort: report.filters.sort,
    direction: report.filters.direction,
  })}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Job Change History Report
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Structured employee change requests and status history
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
            href={`/reports/job-changes${buildQueryString({
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
          <div className="text-sm text-slate-500">Total Change Requests</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {report.summary.totalChangeRequests}
          </div>
        </div>
        <div className="rounded bg-white p-5 shadow">
          <div className="text-sm text-slate-500">Pending Change Requests</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {report.summary.pendingChangeRequests}
          </div>
        </div>
        <div className="rounded bg-white p-5 shadow">
          <div className="text-sm text-slate-500">Approved Not Yet Applied</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {report.summary.approvedNotYetApplied}
          </div>
        </div>
        <div className="rounded bg-white p-5 shadow">
          <div className="text-sm text-slate-500">Applied Change Requests</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {report.summary.appliedChangeRequests}
          </div>
        </div>
      </div>

      <ReportNotesPanel
        purpose={jobChangeHistoryReportNotes.purpose}
        sourceOfTruth={jobChangeHistoryReportNotes.sourceOfTruth}
        definitions={jobChangeHistoryReportNotes.definitions}
        filterExportNote={jobChangeHistoryReportNotes.filterExportNote}
      />

      <div className="rounded bg-white p-4 shadow">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div>
            <label className="mb-2 block text-sm font-medium">Status</label>
            <select
              name="status"
              defaultValue={report.filters.status}
              className="w-full rounded border px-3 py-2"
            >
              <option value="ALL">All</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="APPLIED">Applied</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Change Type</label>
            <select
              name="changeType"
              defaultValue={report.filters.changeType}
              className="w-full rounded border px-3 py-2"
            >
              <option value="ALL">All change types</option>
              {report.filterOptions.changeTypes.map((changeType) => (
                <option key={changeType} value={changeType}>
                  {changeType}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Employee</label>
            <select
              name="employee"
              defaultValue={report.filters.employee}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">All employees</option>
              {report.filterOptions.employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Requested By</label>
            <select
              name="requestedBy"
              defaultValue={report.filters.requestedById}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">All requesters</option>
              {report.filterOptions.requestedBy.map((requester) => (
                <option key={requester.id} value={requester.id}>
                  {requester.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Reviewed By</label>
            <select
              name="reviewedBy"
              defaultValue={report.filters.reviewedById}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">All reviewers</option>
              {report.filterOptions.reviewedBy.map((reviewer) => (
                <option key={reviewer.id} value={reviewer.id}>
                  {reviewer.name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Base date filter uses created date for consistent history filtering across drafts and submitted requests.
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Created From</label>
            <input
              type="date"
              name="dateFrom"
              defaultValue={report.filters.dateFrom}
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Created To</label>
            <input
              type="date"
              name="dateTo"
              defaultValue={report.filters.dateTo}
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Effective Date From
            </label>
            <input
              type="date"
              name="effectiveDateFrom"
              defaultValue={report.filters.effectiveDateFrom}
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Effective Date To
            </label>
            <input
              type="date"
              name="effectiveDateTo"
              defaultValue={report.filters.effectiveDateTo}
              className="w-full rounded border px-3 py-2"
            />
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
              href="/reports/job-changes"
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
                  label="Change Type"
                  sortKey="changeType"
                  currentSort={report.filters.sort}
                  currentDirection={report.filters.direction}
                  baseParams={baseParams}
                />
              </th>
              <th className="p-3">
                <SortLink
                  label="Status"
                  sortKey="status"
                  currentSort={report.filters.sort}
                  currentDirection={report.filters.direction}
                  baseParams={baseParams}
                />
              </th>
              <th className="p-3">Requested By</th>
              <th className="p-3">Reviewed By</th>
              <th className="p-3">
                <SortLink
                  label="Requested Effective Date"
                  sortKey="requestedEffectiveDate"
                  currentSort={report.filters.sort}
                  currentDirection={report.filters.direction}
                  baseParams={baseParams}
                />
              </th>
              <th className="p-3">Actual Effective Date</th>
              <th className="p-3">
                <SortLink
                  label="Submitted At"
                  sortKey="submittedAt"
                  currentSort={report.filters.sort}
                  currentDirection={report.filters.direction}
                  baseParams={baseParams}
                />
              </th>
              <th className="p-3">
                <SortLink
                  label="Applied At"
                  sortKey="appliedAt"
                  currentSort={report.filters.sort}
                  currentDirection={report.filters.direction}
                  baseParams={baseParams}
                />
              </th>
              <th className="p-3">Change Summary</th>
              <th className="p-3">Related Document</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-3">
                  <Link
                    href={`/employees/${row.employeeId}?tab=job-changes`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {row.employeeName}
                  </Link>
                </td>
                <td className="p-3 font-mono text-xs">{row.employeeIdentifier}</td>
                <td className="p-3">{row.changeType}</td>
                <td className="p-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClass(
                      row.status
                    )}`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="p-3">{row.requestedByName}</td>
                <td className="p-3">{row.reviewedByName ?? "-"}</td>
                <td className="p-3">
                  {new Date(row.requestedEffectiveDate).toLocaleDateString()}
                </td>
                <td className="p-3">
                  {row.actualEffectiveDate
                    ? new Date(row.actualEffectiveDate).toLocaleDateString()
                    : "-"}
                </td>
                <td className="p-3">
                  {row.submittedAt
                    ? new Date(row.submittedAt).toLocaleString()
                    : "-"}
                </td>
                <td className="p-3">
                  {row.appliedAt ? new Date(row.appliedAt).toLocaleString() : "-"}
                </td>
                <td className="p-3">{row.changeSummary}</td>
                <td className="p-3">
                  {row.relatedDocumentLinked ? row.relatedDocumentLabel : "None"}
                </td>
              </tr>
            ))}
            {report.rows.length === 0 ? (
              <tr>
                <td colSpan={12} className="p-6 text-sm text-slate-500">
                  No employee change requests matched the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="space-y-4 lg:hidden">
        {report.rows.length === 0 ? (
          <div className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow">
            No employee change requests matched the current filters.
          </div>
        ) : (
          report.rows.map((row) => (
            <div key={row.id} className="rounded-xl bg-white p-4 shadow">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/employees/${row.employeeId}?tab=job-changes`}
                    className="text-base font-semibold text-blue-600 hover:underline"
                  >
                    {row.employeeName}
                  </Link>
                  <div className="mt-1 font-mono text-xs text-slate-500">
                    {row.employeeIdentifier}
                  </div>
                </div>
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClass(
                    row.status
                  )}`}
                >
                  {row.status}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-slate-500">Change Type</div>
                  <div className="font-medium text-slate-900">{row.changeType}</div>
                </div>
                <div>
                  <div className="text-slate-500">Requested By</div>
                  <div className="font-medium text-slate-900">{row.requestedByName}</div>
                </div>
                <div>
                  <div className="text-slate-500">Reviewed By</div>
                  <div className="font-medium text-slate-900">
                    {row.reviewedByName ?? "-"}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Requested Effective</div>
                  <div className="font-medium text-slate-900">
                    {new Date(row.requestedEffectiveDate).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Submitted At</div>
                  <div className="font-medium text-slate-900">
                    {row.submittedAt ? new Date(row.submittedAt).toLocaleString() : "-"}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Applied At</div>
                  <div className="font-medium text-slate-900">
                    {row.appliedAt ? new Date(row.appliedAt).toLocaleString() : "-"}
                  </div>
                </div>
              </div>

              <div className="mt-3 text-sm">
                <div className="text-slate-500">Change Summary</div>
                <div className="text-slate-900">{row.changeSummary}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col gap-3 rounded bg-white p-4 shadow sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-600">
          Showing{" "}
          {report.pagination.totalRows === 0
            ? 0
            : (report.pagination.page - 1) * report.pagination.pageSize + 1}
          {" - "}
          {Math.min(
            report.pagination.page * report.pagination.pageSize,
            report.pagination.totalRows
          )}{" "}
          of {report.pagination.totalRows} change requests
        </div>
        <div className="flex gap-2">
          <Link
            href={`/reports/job-changes${buildQueryString({
              ...baseParams,
              sort: report.filters.sort,
              direction: report.filters.direction,
              page: Math.max(1, report.pagination.page - 1),
            })}`}
            className={`inline-flex items-center justify-center rounded border px-3 py-2 text-sm ${
              report.pagination.page <= 1
                ? "pointer-events-none border-slate-200 text-slate-400"
                : "border-slate-300 hover:bg-slate-50"
            }`}
          >
            Previous
          </Link>
          <div className="inline-flex items-center px-2 text-sm text-slate-600">
            Page {report.pagination.page} of {report.pagination.totalPages}
          </div>
          <Link
            href={`/reports/job-changes${buildQueryString({
              ...baseParams,
              sort: report.filters.sort,
              direction: report.filters.direction,
              page: Math.min(
                report.pagination.totalPages,
                report.pagination.page + 1
              ),
            })}`}
            className={`inline-flex items-center justify-center rounded border px-3 py-2 text-sm ${
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
