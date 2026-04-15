import Link from "next/link";
import ReportNotesPanel from "../../../components/reports/report-notes-panel";
import { auditLogReportNotes } from "../../../lib/server/reports/report-notes";

import {
  getAuditLogFilters,
  getAuditLogReport,
  type AuditLogOutcomeFilter,
  type AuditLogSortDirection,
  type AuditLogSortKey,
} from "../../../lib/server/reports/audit-log";
import {
  isAuthorizationError,
  requireRole,
} from "../../../lib/server/authorization";

type SearchParams = Promise<{
  asOfDate?: string;
  dateFrom?: string;
  dateTo?: string;
  actor?: string;
  action?: string;
  entityType?: string;
  outcome?: string;
  relatedEmployee?: string;
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getOutcomeClasses(outcome: AuditLogOutcomeFilter) {
  switch (outcome) {
    case "SUCCESS":
      return "bg-emerald-100 text-emerald-800";
    case "FAILURE":
      return "bg-rose-100 text-rose-800";
    case "OTHER":
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function SortLink({
  label,
  sortKey,
  currentSort,
  currentDirection,
  baseParams,
}: {
  label: string;
  sortKey: AuditLogSortKey;
  currentSort: AuditLogSortKey;
  currentDirection: AuditLogSortDirection;
  baseParams: Record<string, string | number | null | undefined>;
}) {
  const isActive = currentSort === sortKey;
  const nextDirection =
    isActive && currentDirection === "asc" ? "desc" : "asc";

  return (
    <Link
      href={`/reports/audit-log${buildQueryString({
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

export default async function AuditLogReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  try {
    await requireRole(["SITE_ADMIN", "HR_ADMIN"], {
      attemptedAction: "REPORT_AUDIT_LOG_VIEW",
      entityType: "Report",
      entityId: "audit-log",
    });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return (
        <div className="text-red-600">
          You do not have access to the audit log report.
        </div>
      );
    }

    throw error;
  }

  const resolvedSearchParams = await searchParams;
  const filters = getAuditLogFilters(resolvedSearchParams);
  const report = await getAuditLogReport(filters);

  const baseParams = {
    asOfDate: report.filters.asOfDate,
    dateFrom: report.filters.dateFrom,
    dateTo: report.filters.dateTo,
    actor: report.filters.actor,
    action: report.filters.action,
    entityType: report.filters.entityType,
    outcome: report.filters.outcome,
    relatedEmployee: report.filters.relatedEmployee,
  };

  const exportHref = `/api/reports/audit-log/export${buildQueryString({
    ...baseParams,
    sort: report.filters.sort,
    direction: report.filters.direction,
  })}`;
  const exportPdfHref = `/api/reports/audit-log/export-pdf${buildQueryString({
    ...baseParams,
    sort: report.filters.sort,
    direction: report.filters.direction,
  })}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Log Report</h1>
          <p className="mt-1 text-sm text-slate-600">
            System activity and control evidence for HR/admin review
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
            href={`/reports/audit-log${buildQueryString({
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
          <div className="text-sm text-slate-500">Total Audit Events</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {report.summary.totalAuditEvents}
          </div>
        </div>
        <div className="rounded bg-white p-5 shadow">
          <div className="text-sm text-slate-500">Events With Actor</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {report.summary.eventsWithActor}
          </div>
        </div>
        <div className="rounded bg-white p-5 shadow">
          <div className="text-sm text-slate-500">Events Without Actor</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {report.summary.eventsWithoutActor}
          </div>
        </div>
        <div className="rounded bg-white p-5 shadow">
          <div className="text-sm text-slate-500">Distinct Actors</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {report.summary.distinctActors}
          </div>
        </div>
      </div>

      <ReportNotesPanel
        purpose={auditLogReportNotes.purpose}
        sourceOfTruth={auditLogReportNotes.sourceOfTruth}
        definitions={auditLogReportNotes.definitions}
        filterExportNote={auditLogReportNotes.filterExportNote}
      />

      <div className="rounded bg-white p-4 shadow">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
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
            <label className="mb-2 block text-sm font-medium">Actor</label>
            <input
              type="text"
              name="actor"
              defaultValue={report.filters.actor}
              placeholder="Search actor name or ID"
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Action / Event Type
            </label>
            <select
              name="action"
              defaultValue={report.filters.action}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">All actions</option>
              {report.filterOptions.actions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Entity Type</label>
            <select
              name="entityType"
              defaultValue={report.filters.entityType}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">All entity types</option>
              {report.filterOptions.entityTypes.map((entityType) => (
                <option key={entityType} value={entityType}>
                  {entityType}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Outcome</label>
            <select
              name="outcome"
              defaultValue={report.filters.outcome}
              className="w-full rounded border px-3 py-2"
            >
              <option value="ALL">All outcomes</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILURE">Failure</option>
              <option value="OTHER">Other / Unknown</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Employee / Related Employee
            </label>
            <input
              type="text"
              name="relatedEmployee"
              defaultValue={report.filters.relatedEmployee}
              placeholder="Search employee name or ID"
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
              href="/reports/audit-log"
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
                  label="Timestamp"
                  sortKey="timestamp"
                  currentSort={report.filters.sort}
                  currentDirection={report.filters.direction}
                  baseParams={baseParams}
                />
              </th>
              <th className="p-3">
                <SortLink
                  label="Actor Name"
                  sortKey="actorName"
                  currentSort={report.filters.sort}
                  currentDirection={report.filters.direction}
                  baseParams={baseParams}
                />
              </th>
              <th className="p-3">Actor ID / Employee ID</th>
              <th className="p-3">
                <SortLink
                  label="Action / Event Type"
                  sortKey="action"
                  currentSort={report.filters.sort}
                  currentDirection={report.filters.direction}
                  baseParams={baseParams}
                />
              </th>
              <th className="p-3">
                <SortLink
                  label="Entity Type"
                  sortKey="entityType"
                  currentSort={report.filters.sort}
                  currentDirection={report.filters.direction}
                  baseParams={baseParams}
                />
              </th>
              <th className="p-3">Entity ID</th>
              <th className="p-3">Related Employee</th>
              <th className="p-3">
                <SortLink
                  label="Outcome"
                  sortKey="outcome"
                  currentSort={report.filters.sort}
                  currentDirection={report.filters.direction}
                  baseParams={baseParams}
                />
              </th>
              <th className="p-3">Summary / Details</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr
                key={row.id}
                className="border-t border-slate-200 align-top text-sm"
              >
                <td className="p-3 text-slate-600">{formatDateTime(row.timestamp)}</td>
                <td className="p-3 text-slate-900">{row.actorName ?? "—"}</td>
                <td className="p-3 text-slate-600">{row.actorId || "—"}</td>
                <td className="p-3 text-slate-900">{row.action}</td>
                <td className="p-3 text-slate-600">{row.entityType}</td>
                <td className="p-3 text-slate-600">{row.entityId}</td>
                <td className="p-3 text-slate-600">
                  {row.relatedEmployeeName ?? row.relatedEmployeeId ?? "—"}
                </td>
                <td className="p-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getOutcomeClasses(
                      row.outcome
                    )}`}
                  >
                    {row.outcome}
                  </span>
                </td>
                <td className="p-3 text-slate-600">{row.summary}</td>
              </tr>
            ))}

            {report.rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-sm text-slate-500">
                  No audit log entries matched your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="space-y-4 lg:hidden">
        {report.rows.map((row) => (
          <div key={row.id} className="rounded bg-white p-4 shadow">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-slate-900">
                  {row.actorName ?? "Unknown actor"}
                </div>
                <div className="text-sm text-slate-500">{formatDateTime(row.timestamp)}</div>
              </div>
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getOutcomeClasses(
                  row.outcome
                )}`}
              >
                {row.outcome}
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Actor ID</dt>
                <dd className="text-slate-900">{row.actorId || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Action</dt>
                <dd className="text-slate-900">{row.action}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Entity Type</dt>
                <dd className="text-slate-900">{row.entityType}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Entity ID</dt>
                <dd className="text-slate-900">{row.entityId}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Related Employee</dt>
                <dd className="text-slate-900">
                  {row.relatedEmployeeName ?? row.relatedEmployeeId ?? "—"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-slate-500">Summary / Details</dt>
                <dd className="text-slate-900">{row.summary}</dd>
              </div>
            </dl>
          </div>
        ))}

        {report.rows.length === 0 ? (
          <div className="rounded bg-white p-6 text-sm text-slate-500 shadow">
            No audit log entries matched your filters.
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
          audit events
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/reports/audit-log${buildQueryString({
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
            href={`/reports/audit-log${buildQueryString({
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
