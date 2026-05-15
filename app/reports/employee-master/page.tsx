import Link from "next/link";
import ReportNotesPanel from "../../../components/reports/report-notes-panel";
import { employeeMasterReportNotes } from "../../../lib/server/reports/report-notes";

import {
  getEmployeeMasterFilters,
  getEmployeeMasterReport,
  type EmployeeMasterSortDirection,
  type EmployeeMasterSortKey,
} from "../../../lib/server/reports/employee-master";
import {
  isAuthorizationError,
  requireRole,
} from "../../../lib/server/authorization";
import { resolveTenantContext } from "../../../lib/server/tenant-context";

type SearchParams = Promise<{
  status?: string;
  department?: string;
  role?: string;
  manager?: string;
  search?: string;
  employmentClassification?: string;
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
  sortKey: EmployeeMasterSortKey;
  currentSort: EmployeeMasterSortKey;
  currentDirection: EmployeeMasterSortDirection;
  baseParams: Record<string, string | number | null | undefined>;
}) {
  const isActive = currentSort === sortKey;
  const nextDirection =
    isActive && currentDirection === "asc" ? "desc" : "asc";

  return (
    <Link
      href={`/reports/employee-master${buildQueryString({
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

export default async function EmployeeMasterReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  try {
    await requireRole(["SITE_ADMIN", "HR_ADMIN"], {
      attemptedAction: "REPORT_EMPLOYEE_MASTER_VIEW",
      entityType: "Report",
      entityId: "employee-master",
    });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return (
        <div className="text-red-600">
          You do not have access to the employee master report.
        </div>
      );
    }

    throw error;
  }

  const resolvedSearchParams = await searchParams;
  const filters = getEmployeeMasterFilters(resolvedSearchParams);
  const tenantContext = await resolveTenantContext();
  const report = await getEmployeeMasterReport(filters, { tenantContext });

  const baseParams = {
    status: report.filters.status,
    department: report.filters.department,
    role: report.filters.role,
    manager: report.filters.managerId,
    search: report.filters.search,
    employmentClassification: report.filters.employmentClassification,
  };

  const exportHref = `/api/reports/employee-master/export${buildQueryString({
    ...baseParams,
    sort: report.filters.sort,
    direction: report.filters.direction,
  })}`;
  const exportPdfHref = `/api/reports/employee-master/export-pdf${buildQueryString({
    ...baseParams,
    sort: report.filters.sort,
    direction: report.filters.direction,
  })}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employee Master Report</h1>
          <p className="mt-1 text-sm text-slate-600">
            Current employee roster and core employment data
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
            href={`/reports/employee-master${buildQueryString({
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
          <div className="text-sm text-slate-500">Total Employees</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {report.summary.totalEmployees}
          </div>
        </div>
        <div className="rounded bg-white p-5 shadow">
          <div className="text-sm text-slate-500">Active Employees</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {report.summary.activeEmployees}
          </div>
        </div>
        <div className="rounded bg-white p-5 shadow">
          <div className="text-sm text-slate-500">Inactive Employees</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {report.summary.inactiveEmployees}
          </div>
        </div>
        <div className="rounded bg-white p-5 shadow">
          <div className="text-sm text-slate-500">Employees Missing Manager</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {report.summary.employeesMissingManager}
          </div>
        </div>
      </div>

      <ReportNotesPanel
        purpose={employeeMasterReportNotes.purpose}
        sourceOfTruth={employeeMasterReportNotes.sourceOfTruth}
        definitions={employeeMasterReportNotes.definitions}
        filterExportNote={employeeMasterReportNotes.filterExportNote}
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
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ALL">All</option>
            </select>
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
            <label className="mb-2 block text-sm font-medium">Role</label>
            <select
              name="role"
              defaultValue={report.filters.role}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">All roles</option>
              {report.filterOptions.roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Manager</label>
            <select
              name="manager"
              defaultValue={report.filters.managerId}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">All managers</option>
              {report.filterOptions.managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Employment Classification
            </label>
            <select
              name="employmentClassification"
              defaultValue={report.filters.employmentClassification}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">All classifications</option>
              {report.filterOptions.employmentClassifications.map((classification) => (
                <option key={classification} value={classification}>
                  {classification}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Employee Search</label>
            <input
              type="text"
              name="search"
              defaultValue={report.filters.search}
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
              href="/reports/employee-master"
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
                  label="Status"
                  sortKey="status"
                  currentSort={report.filters.sort}
                  currentDirection={report.filters.direction}
                  baseParams={baseParams}
                />
              </th>
              <th className="p-3">Job Title</th>
              <th className="p-3">
                <SortLink
                  label="Department"
                  sortKey="department"
                  currentSort={report.filters.sort}
                  currentDirection={report.filters.direction}
                  baseParams={baseParams}
                />
              </th>
              <th className="p-3">
                <SortLink
                  label="Manager Name"
                  sortKey="managerName"
                  currentSort={report.filters.sort}
                  currentDirection={report.filters.direction}
                  baseParams={baseParams}
                />
              </th>
              <th className="p-3">Role</th>
              <th className="p-3">
                <SortLink
                  label="Hire Date"
                  sortKey="hireDate"
                  currentSort={report.filters.sort}
                  currentDirection={report.filters.direction}
                  baseParams={baseParams}
                />
              </th>
              <th className="p-3">Work Location</th>
              <th className="p-3">Employment Classification</th>
              <th className="p-3">Work Email</th>
              <th className="p-3">Payroll Frequency</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr
                key={row.employeeId}
                className={`border-t ${row.isActive ? "" : "bg-slate-50 text-slate-500"}`}
              >
                <td className="p-3">
                  <Link
                    href={`/employees/${row.employeeId}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {row.employeeName}
                  </Link>
                </td>
                <td className="p-3 font-mono text-xs">{row.employeeIdentifier}</td>
                <td className="p-3">{row.status}</td>
                <td className="p-3">{row.jobTitle ?? "-"}</td>
                <td className="p-3">{row.department ?? "-"}</td>
                <td className="p-3">
                  {row.managerName ?? (
                    <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                      No manager assigned
                    </span>
                  )}
                </td>
                <td className="p-3">{row.role}</td>
                <td className="p-3">
                  {new Date(row.hireDate).toLocaleDateString()}
                </td>
                <td className="p-3">{row.workLocation ?? "-"}</td>
                <td className="p-3">{row.employmentClassification ?? "-"}</td>
                <td className="p-3">{row.workEmail}</td>
                <td className="p-3">{row.payrollFrequency}</td>
              </tr>
            ))}
            {report.rows.length === 0 ? (
              <tr>
                <td colSpan={12} className="p-6 text-sm text-slate-500">
                  No employees matched the current employee master filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="space-y-4 lg:hidden">
        {report.rows.length === 0 ? (
          <div className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow">
            No employees matched the current employee master filters.
          </div>
        ) : (
          report.rows.map((row) => (
            <div
              key={row.employeeId}
              className={`rounded-xl bg-white p-4 shadow ${row.isActive ? "" : "text-slate-500"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/employees/${row.employeeId}`}
                    className="text-base font-semibold text-blue-600 hover:underline"
                  >
                    {row.employeeName}
                  </Link>
                  <div className="mt-1 font-mono text-xs text-slate-500">
                    {row.employeeIdentifier}
                  </div>
                </div>
                <div className="text-xs font-medium uppercase tracking-wide">
                  {row.status}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-slate-500">Department</div>
                  <div className="font-medium text-slate-900">{row.department ?? "-"}</div>
                </div>
                <div>
                  <div className="text-slate-500">Job Title</div>
                  <div className="font-medium text-slate-900">{row.jobTitle ?? "-"}</div>
                </div>
                <div>
                  <div className="text-slate-500">Manager</div>
                  <div className="font-medium text-slate-900">
                    {row.managerName ?? "No manager assigned"}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Role</div>
                  <div className="font-medium text-slate-900">{row.role}</div>
                </div>
                <div>
                  <div className="text-slate-500">Hire Date</div>
                  <div className="font-medium text-slate-900">
                    {new Date(row.hireDate).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Work Location</div>
                  <div className="font-medium text-slate-900">{row.workLocation ?? "-"}</div>
                </div>
                <div>
                  <div className="text-slate-500">Work Email</div>
                  <div className="font-medium text-slate-900 break-all">{row.workEmail}</div>
                </div>
                <div>
                  <div className="text-slate-500">Payroll Frequency</div>
                  <div className="font-medium text-slate-900">{row.payrollFrequency}</div>
                </div>
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
          of {report.pagination.totalRows} employees
        </div>
        <div className="flex gap-2">
          <Link
            href={`/reports/employee-master${buildQueryString({
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
            href={`/reports/employee-master${buildQueryString({
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
