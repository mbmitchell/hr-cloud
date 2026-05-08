"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateOnlyForDisplay } from "../../lib/date-only";

type Summary = {
  employeeCount: number;
  pendingRequestCount: number;
  upcomingApprovedCount: number;
  totalPtoLiabilityHours: number;
  totalPtoLiabilityDollars: number;
};

type EmployeeBalance = {
  id: string;
  name: string;
  department: string | null;
  title: string | null;
  status: string;
  ptoBalance: number;
  compBalance: number;
  payType?: string | null;
  effectiveHourlyRate: number;
  ptoLiability: number;
};

type RequestRow = {
  id: string;
  employeeName: string;
  department: string | null;
  leaveType: string;
  startDate: string;
  endDate: string;
  hours: number;
  notes: string;
  status: string;
};

type ReportResponse = {
  summary: Summary;
  employeeBalances: EmployeeBalance[];
  pendingRequests: RequestRow[];
  upcomingApproved: RequestRow[];
};

export default function ReportsClient({
  canSeeReportingStructure = false,
  canSeeEmployeeMaster = false,
  canSeeUserAccess = false,
  canSeeJobChanges = false,
  canSeeDocumentAcknowledgements = false,
  canSeePtoLedger = false,
  canSeePtoLiability = false,
  canSeeAuditLog = false,
}: {
  canSeeReportingStructure?: boolean;
  canSeeEmployeeMaster?: boolean;
  canSeeUserAccess?: boolean;
  canSeeJobChanges?: boolean;
  canSeeDocumentAcknowledgements?: boolean;
  canSeePtoLedger?: boolean;
  canSeePtoLiability?: boolean;
  canSeeAuditLog?: boolean;
}) {
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");

  useEffect(() => {
    async function loadReports() {
      setLoading(true);
      setMessage("");

      try {
        const response = await fetch("/api/reports/summary");
        const result = await response.json();

        if (!response.ok) {
          setMessage(result.error || "Unable to load reports.");
          setData(null);
        } else {
          setData(result);
        }
      } catch {
        setMessage("Unable to load reports.");
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    loadReports();
  }, []);

  const departments = useMemo(() => {
    const values = new Set<string>();

    data?.employeeBalances.forEach((employee) => {
      if (employee.department) values.add(employee.department);
    });

    return Array.from(values).sort();
  }, [data]);

  const filteredEmployees = useMemo(() => {
    const employees = data?.employeeBalances ?? [];

    if (departmentFilter === "ALL") return employees;

    return employees.filter((employee) => employee.department === departmentFilter);
  }, [data, departmentFilter]);

  const filteredPendingRequests = useMemo(() => {
    const requests = data?.pendingRequests ?? [];

    if (departmentFilter === "ALL") return requests;

    return requests.filter((request) => request.department === departmentFilter);
  }, [data, departmentFilter]);

  const filteredUpcomingApproved = useMemo(() => {
    const requests = data?.upcomingApproved ?? [];

    if (departmentFilter === "ALL") return requests;

    return requests.filter((request) => request.department === departmentFilter);
  }, [data, departmentFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Reports</h2>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div>
            <label className="block text-sm font-medium mb-2">Department</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full rounded border bg-white px-3 py-2 md:w-auto"
            >
              <option value="ALL">All</option>
              {departments.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </div>

          <a
            href="/api/reports/liability-export"
            className="inline-flex w-full items-center justify-center rounded border border-slate-300 px-4 py-2.5 text-sm hover:bg-slate-50 md:w-auto"
          >
            Export Liability CSV
          </a>
        </div>
      </div>

      {canSeeReportingStructure ? (
        <div className="rounded bg-white p-5 shadow">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Reporting Structure
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Review current manager hierarchy and employee reporting lines.
              </p>
            </div>
            <a
              href="/reports/reporting-structure"
              className="inline-flex items-center justify-center rounded border border-slate-300 px-4 py-2.5 text-sm hover:bg-slate-50"
            >
              Open Report
            </a>
          </div>
        </div>
      ) : null}

      {canSeeEmployeeMaster ? (
        <div className="rounded bg-white p-5 shadow">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Employee Master Report
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Review the current employee roster and core employment data.
              </p>
            </div>
            <a
              href="/reports/employee-master"
              className="inline-flex items-center justify-center rounded border border-slate-300 px-4 py-2.5 text-sm hover:bg-slate-50"
            >
              Open Report
            </a>
          </div>
        </div>
      ) : null}

      {canSeeUserAccess ? (
        <div className="rounded bg-white p-5 shadow">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                User Access / Role Report
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Review the current employee access roster and active role assignments.
              </p>
            </div>
            <a
              href="/reports/user-access"
              className="inline-flex items-center justify-center rounded border border-slate-300 px-4 py-2.5 text-sm hover:bg-slate-50"
            >
              Open Report
            </a>
          </div>
        </div>
      ) : null}

      {canSeeJobChanges ? (
        <div className="rounded bg-white p-5 shadow">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Job Change History Report
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Review structured employment change requests and their workflow status history.
              </p>
            </div>
            <a
              href="/reports/job-changes"
              className="inline-flex items-center justify-center rounded border border-slate-300 px-4 py-2.5 text-sm hover:bg-slate-50"
            >
              Open Report
            </a>
          </div>
        </div>
      ) : null}

      {canSeeDocumentAcknowledgements ? (
        <div className="rounded bg-white p-5 shadow">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Document Acknowledgement Report
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Review document assignments, acknowledgement status, and overdue items.
              </p>
            </div>
            <a
              href="/reports/document-acknowledgements"
              className="inline-flex items-center justify-center rounded border border-slate-300 px-4 py-2.5 text-sm hover:bg-slate-50"
            >
              Open Report
            </a>
          </div>
        </div>
      ) : null}

      {canSeePtoLedger ? (
        <div className="rounded bg-white p-5 shadow">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                PTO Ledger / Balance Report
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Review PTO ledger activity, running balances, and negative-balance exposure.
              </p>
            </div>
            <a
              href="/reports/pto-ledger"
              className="inline-flex items-center justify-center rounded border border-slate-300 px-4 py-2.5 text-sm hover:bg-slate-50"
            >
              Open Report
            </a>
          </div>
        </div>
      ) : null}

      {canSeePtoLiability ? (
        <div className="rounded bg-white p-5 shadow">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                PTO Liability Report
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Review current estimated PTO payout exposure without exposing raw pay or balance inputs.
              </p>
            </div>
            <a
              href="/reports/pto-liability"
              className="inline-flex items-center justify-center rounded border border-slate-300 px-4 py-2.5 text-sm hover:bg-slate-50"
            >
              Open Report
            </a>
          </div>
        </div>
      ) : null}

      {canSeeAuditLog ? (
        <div className="rounded bg-white p-5 shadow">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Audit Log Report
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Review system activity and control evidence across HR workflows.
              </p>
            </div>
            <a
              href="/reports/audit-log"
              className="inline-flex items-center justify-center rounded border border-slate-300 px-4 py-2.5 text-sm hover:bg-slate-50"
            >
              Open Report
            </a>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="text-slate-600">Loading reports...</div>
      ) : message ? (
        <div className="text-red-600">{message}</div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white rounded shadow p-5">
              <div className="text-sm text-slate-500">Employees</div>
              <div className="text-3xl font-semibold mt-2">
                {data.summary.employeeCount}
              </div>
            </div>

            <div className="bg-white rounded shadow p-5">
              <div className="text-sm text-slate-500">Pending Requests</div>
              <div className="text-3xl font-semibold mt-2">
                {data.summary.pendingRequestCount}
              </div>
            </div>

            <div className="bg-white rounded shadow p-5">
              <div className="text-sm text-slate-500">Upcoming Approved</div>
              <div className="text-3xl font-semibold mt-2">
                {data.summary.upcomingApprovedCount}
              </div>
            </div>

            <div className="bg-white rounded shadow p-5">
              <div className="text-sm text-slate-500">PTO Liability</div>
              <div className="text-3xl font-semibold mt-2">
                ${data.summary.totalPtoLiabilityDollars.toFixed(2)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {data.summary.totalPtoLiabilityHours.toFixed(2)} PTO hours
              </div>
            </div>
          </div>

          <div className="hidden overflow-hidden rounded bg-white shadow md:block">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">Employee Balances</h3>
            </div>

            <table className="w-full">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Title</th>
                  <th className="p-3">PTO Balance</th>
                  <th className="p-3">COMP Balance</th>
                  <th className="p-3">Hourly Rate</th>
                  <th className="p-3">PTO Liability</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="border-t">
                    <td className="p-3">{employee.name}</td>
                    <td className="p-3">{employee.department ?? "-"}</td>
                    <td className="p-3">{employee.title ?? "-"}</td>
                    <td className="p-3">{employee.ptoBalance.toFixed(2)}</td>
                    <td className="p-3">{employee.compBalance.toFixed(2)}</td>
                    <td className="p-3">${employee.effectiveHourlyRate.toFixed(2)}</td>
                    <td className="p-3">${employee.ptoLiability.toFixed(2)}</td>
                  </tr>
                ))}

                {filteredEmployees.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-4 text-sm text-slate-500">
                      No employees matched your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-4 md:hidden">
            <div className="rounded-xl bg-white p-4 shadow">
              <h3 className="text-lg font-semibold">Employee Balances</h3>
            </div>
            {filteredEmployees.length === 0 ? (
              <div className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow">
                No employees matched your filters.
              </div>
            ) : (
              filteredEmployees.map((employee) => (
                <div key={employee.id} className="rounded-xl bg-white p-4 shadow">
                  <div className="text-base font-semibold text-slate-900">
                    {employee.name}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {employee.department ?? "-"} • {employee.title ?? "-"}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-slate-500">PTO</div>
                      <div className="font-medium text-slate-900">
                        {employee.ptoBalance.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">COMP</div>
                      <div className="font-medium text-slate-900">
                        {employee.compBalance.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Hourly Rate</div>
                      <div className="font-medium text-slate-900">
                        ${employee.effectiveHourlyRate.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">PTO Liability</div>
                      <div className="font-medium text-slate-900">
                        ${employee.ptoLiability.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white rounded shadow overflow-hidden">
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold">Pending Requests</h3>
              </div>

              <div className="p-4 space-y-3">
                {filteredPendingRequests.length === 0 ? (
                  <div className="text-sm text-slate-500">
                    No pending requests found.
                  </div>
                ) : (
                  filteredPendingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="border rounded p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="font-medium">{request.employeeName}</div>
                        <div className="text-sm text-slate-600">
                          {request.leaveType} •{" "}
                          {formatDateOnlyForDisplay(request.startDate)} -{" "}
                          {formatDateOnlyForDisplay(request.endDate)}
                        </div>
                      </div>
                      <div className="text-sm font-medium">{request.hours.toFixed(2)} hrs</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded shadow overflow-hidden">
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold">Upcoming Approved Leave</h3>
              </div>

              <div className="p-4 space-y-3">
                {filteredUpcomingApproved.length === 0 ? (
                  <div className="text-sm text-slate-500">
                    No upcoming approved leave found.
                  </div>
                ) : (
                  filteredUpcomingApproved.map((request) => (
                    <div
                      key={request.id}
                      className="border rounded p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="font-medium">{request.employeeName}</div>
                        <div className="text-sm text-slate-600">
                          {request.leaveType} •{" "}
                          {formatDateOnlyForDisplay(request.startDate)} -{" "}
                          {formatDateOnlyForDisplay(request.endDate)}
                        </div>
                      </div>
                      <div className="text-sm font-medium">{request.hours.toFixed(2)} hrs</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
