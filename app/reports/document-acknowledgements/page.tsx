import Link from "next/link";
import ReportNotesPanel from "../../../components/reports/report-notes-panel";
import { documentAcknowledgementReportNotes } from "../../../lib/server/reports/report-notes";

import {
  getDocumentAcknowledgementFilters,
  getDocumentAcknowledgementReport,
  type DocumentAcknowledgementSortDirection,
  type DocumentAcknowledgementSortKey,
} from "../../../lib/server/reports/document-acknowledgements";
import {
  isAuthorizationError,
  requireRole,
} from "../../../lib/server/authorization";

type SearchParams = Promise<{
  status?: string;
  document?: string;
  category?: string;
  employee?: string;
  assignedBy?: string;
  assignedDateFrom?: string;
  assignedDateTo?: string;
  acknowledgedDateFrom?: string;
  acknowledgedDateTo?: string;
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

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getStatusClasses(status: "ACKNOWLEDGED" | "PENDING" | "OVERDUE") {
  switch (status) {
    case "ACKNOWLEDGED":
      return "bg-emerald-100 text-emerald-800";
    case "OVERDUE":
      return "bg-amber-100 text-amber-900";
    case "PENDING":
    default:
      return "bg-slate-100 text-slate-700";
  }
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

function SortLink({
  label,
  sortKey,
  currentSort,
  currentDirection,
  baseParams,
}: {
  label: string;
  sortKey: DocumentAcknowledgementSortKey;
  currentSort: DocumentAcknowledgementSortKey;
  currentDirection: DocumentAcknowledgementSortDirection;
  baseParams: Record<string, string | number | null | undefined>;
}) {
  const isActive = currentSort === sortKey;
  const nextDirection =
    isActive && currentDirection === "asc" ? "desc" : "asc";

  return (
    <Link
      href={`/reports/document-acknowledgements${buildQueryString({
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

export default async function DocumentAcknowledgementReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  try {
    await requireRole(["SITE_ADMIN", "HR_ADMIN"], {
      attemptedAction: "REPORT_DOCUMENT_ACKNOWLEDGEMENTS_VIEW",
      entityType: "Report",
      entityId: "document-acknowledgements",
    });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return (
        <div className="text-red-600">
          You do not have access to the document acknowledgement report.
        </div>
      );
    }

    throw error;
  }

  const resolvedSearchParams = await searchParams;
  const filters = getDocumentAcknowledgementFilters(resolvedSearchParams);
  const report = await getDocumentAcknowledgementReport(filters);

  const baseParams = {
    status: report.filters.status,
    document: report.filters.documentId,
    category: report.filters.category,
    employee: report.filters.employee,
    assignedBy: report.filters.assignedById,
    assignedDateFrom: report.filters.assignedDateFrom,
    assignedDateTo: report.filters.assignedDateTo,
    acknowledgedDateFrom: report.filters.acknowledgedDateFrom,
    acknowledgedDateTo: report.filters.acknowledgedDateTo,
  };

  const exportHref = `/api/reports/document-acknowledgements/export${buildQueryString({
    ...baseParams,
    sort: report.filters.sort,
    direction: report.filters.direction,
  })}`;
  const exportPdfHref = `/api/reports/document-acknowledgements/export-pdf${buildQueryString({
    ...baseParams,
    sort: report.filters.sort,
    direction: report.filters.direction,
  })}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Document Acknowledgement Report
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Employee document assignments and acknowledgement status
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
            href={`/reports/document-acknowledgements${buildQueryString({
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
          <div className="text-sm text-slate-500">Total Assignments</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {report.summary.totalAssignments}
          </div>
        </div>
        <div className="rounded bg-white p-5 shadow">
          <div className="text-sm text-slate-500">Acknowledged</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {report.summary.acknowledged}
          </div>
        </div>
        <div className="rounded bg-white p-5 shadow">
          <div className="text-sm text-slate-500">Pending</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {report.summary.pending}
          </div>
        </div>
        <div className="rounded bg-white p-5 shadow">
          <div className="text-sm text-slate-500">Overdue</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {report.summary.overdue}
          </div>
        </div>
      </div>

      <ReportNotesPanel
        purpose={documentAcknowledgementReportNotes.purpose}
        sourceOfTruth={documentAcknowledgementReportNotes.sourceOfTruth}
        definitions={documentAcknowledgementReportNotes.definitions}
        filterExportNote={documentAcknowledgementReportNotes.filterExportNote}
      />

      <div className="rounded bg-white p-4 shadow">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium">Status</label>
            <select
              name="status"
              defaultValue={report.filters.status}
              className="w-full rounded border px-3 py-2"
            >
              <option value="ALL">All</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="PENDING">Pending</option>
              <option value="OVERDUE">Overdue</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Document</label>
            <select
              name="document"
              defaultValue={report.filters.documentId}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">All documents</option>
              {report.filterOptions.documents.map((document) => (
                <option key={document.id} value={document.id}>
                  {document.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Document Category
            </label>
            <select
              name="category"
              defaultValue={report.filters.category}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">All categories</option>
              {report.filterOptions.categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

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
            <label className="mb-2 block text-sm font-medium">Assigned By</label>
            <select
              name="assignedBy"
              defaultValue={report.filters.assignedById}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">All assigners</option>
              {report.filterOptions.assignedBy.map((assignedBy) => (
                <option key={assignedBy.id} value={assignedBy.id}>
                  {assignedBy.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Assigned From
            </label>
            <input
              type="date"
              name="assignedDateFrom"
              defaultValue={report.filters.assignedDateFrom}
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Assigned To</label>
            <input
              type="date"
              name="assignedDateTo"
              defaultValue={report.filters.assignedDateTo}
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Acknowledged From
            </label>
            <input
              type="date"
              name="acknowledgedDateFrom"
              defaultValue={report.filters.acknowledgedDateFrom}
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Acknowledged To
            </label>
            <input
              type="date"
              name="acknowledgedDateTo"
              defaultValue={report.filters.acknowledgedDateTo}
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <input type="hidden" name="sort" value={report.filters.sort} />
          <input type="hidden" name="direction" value={report.filters.direction} />

          <div className="flex flex-col gap-3 md:col-span-2 xl:col-span-4 sm:flex-row">
            <button
              type="submit"
              className="w-full rounded bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-800 sm:w-auto"
            >
              Apply Filters
            </button>
            <Link
              href="/reports/document-acknowledgements"
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
                  label="Document Name"
                  sortKey="documentName"
                  currentSort={report.filters.sort}
                  currentDirection={report.filters.direction}
                  baseParams={baseParams}
                />
              </th>
              <th className="p-3">Document Version</th>
              <th className="p-3">Document Category</th>
              <th className="p-3">
                <SortLink
                  label="Assigned Date"
                  sortKey="assignedAt"
                  currentSort={report.filters.sort}
                  currentDirection={report.filters.direction}
                  baseParams={baseParams}
                />
              </th>
              <th className="p-3">Due Date</th>
              <th className="p-3">
                <SortLink
                  label="Acknowledged Date"
                  sortKey="acknowledgedAt"
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
              <th className="p-3">Assigned By</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr
                key={row.assignmentId}
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
                <td className="p-3 text-slate-900">{row.documentName}</td>
                <td className="p-3 text-slate-600">{row.documentVersion}</td>
                <td className="p-3 text-slate-600">
                  {row.documentCategory ?? "—"}
                </td>
                <td className="p-3 text-slate-600">{formatDate(row.assignedAt)}</td>
                <td className="p-3 text-slate-600">{formatDate(row.dueDate)}</td>
                <td className="p-3 text-slate-600">
                  {formatDate(row.acknowledgedAt)}
                </td>
                <td className="p-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClasses(
                      row.status
                    )}`}
                  >
                    {getStatusLabel(row.status)}
                  </span>
                </td>
                <td className="p-3 text-slate-600">{row.assignedByName}</td>
              </tr>
            ))}

            {report.rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-6 text-center text-sm text-slate-500">
                  No document assignments matched your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="space-y-4 lg:hidden">
        {report.rows.map((row) => (
          <div key={row.assignmentId} className="rounded bg-white p-4 shadow">
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
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClasses(
                  row.status
                )}`}
              >
                {getStatusLabel(row.status)}
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Document</dt>
                <dd className="text-slate-900">{row.documentName}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Version</dt>
                <dd className="text-slate-900">{row.documentVersion}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Category</dt>
                <dd className="text-slate-900">{row.documentCategory ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Assigned By</dt>
                <dd className="text-slate-900">{row.assignedByName}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Assigned Date</dt>
                <dd className="text-slate-900">{formatDate(row.assignedAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Due Date</dt>
                <dd className="text-slate-900">{formatDate(row.dueDate)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Acknowledged Date</dt>
                <dd className="text-slate-900">
                  {formatDate(row.acknowledgedAt)}
                </dd>
              </div>
            </dl>
          </div>
        ))}

        {report.rows.length === 0 ? (
          <div className="rounded bg-white p-6 text-sm text-slate-500 shadow">
            No document assignments matched your filters.
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
          assignments
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/reports/document-acknowledgements${buildQueryString({
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
            href={`/reports/document-acknowledgements${buildQueryString({
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
