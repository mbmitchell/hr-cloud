"use client";

import { useEffect, useMemo, useState } from "react";
import {
  isBalanceTrackedLeaveType,
  isCompLeaveType,
  isPtoBucketLeaveType,
  isWorkflowOnlyLeaveType,
} from "../../../lib/pto/leave-types";

type EmployeeOption = {
  id: string;
  firstName: string;
  lastName: string;
  department: string | null;
};

type CurrentUserInfo = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
  canRequestForOthers: boolean;
};

type Projection = {
  monthlyRate: number;
  accrualCount: number;
  accruedBeforeRequest: number;
  projectedBalance: number;
  accrualSummaryText?: string;
};

type EmployeeBalance = {
  id: string;
  firstName: string;
  lastName: string;
  currentPtoBalance: number;
  currentCompBalance: number;
  accrualMode?: string | null;
  monthlyAccrualOverride?: number | null;
  accrualOverrideReason?: string | null;
  advancedAccrualTier?: string | null;
  advancedAccrualEffectiveDate?: string | null;
  advancedAccrualReason?: string | null;
  accrualSummary?: {
    mode: string;
    source: string;
    currentMonthlyRate: number;
    tenureTier: string;
    activeTier: string | null;
    advancedTier: string | null;
    advancedEffectiveDate: string | null;
    manualOverrideRate: number | null;
    reason: string | null;
    nextTier: {
      tier: string;
      monthlyRate: number;
      effectiveDate: string;
    } | null;
  };
  ptoProjection: Projection | null;
};

type StaffingConflict = {
  department: string | null;
  conflictCount: number;
  approvedCount: number;
  pendingCount: number;
  employeesOff: Array<{
    id: string;
    employeeId: string;
    employeeName: string;
    leaveType: string;
    status: string;
    startDate: string;
    endDate: string;
  }>;
};


function countWeekdaysInclusive(start: string, end: string) {
  if (!start || !end) return 0;

  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);

  if (endDate < startDate) return 0;

  let count = 0;
  const current = new Date(startDate);

  while (current <= endDate) {
    const day = current.getDay();

    if (day !== 0 && day !== 6) {
      count += 1;
    }

    current.setDate(current.getDate() + 1);
  }

  return count;
}

export default function PTORequestClient() {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUserInfo | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [employeeBalance, setEmployeeBalance] = useState<EmployeeBalance | null>(null);
  const [staffingConflict, setStaffingConflict] = useState<StaffingConflict | null>(null);
  const [leaveType, setLeaveType] = useState("PTO");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [hours, setHours] = useState("8");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [loadingConflicts, setLoadingConflicts] = useState(false);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [employeesResponse, meResponse] = await Promise.all([
          fetch("/api/employees"),
          fetch("/api/me"),
        ]);

        const employeesData = await employeesResponse.json();
        const meData = await meResponse.json();

        if (!employeesResponse.ok) {
          setMessage("Unable to load employees.");
          return;
        }

        setEmployees(employeesData);

        if (meResponse.ok) {
          setCurrentUser(meData);

          const currentEmployee = employeesData.find(
            (employee: EmployeeOption) => employee.id === meData.id
          );

          if (currentEmployee) {
            setEmployeeId(currentEmployee.id);
          } else if (employeesData.length > 0) {
            setEmployeeId(employeesData[0].id);
          }
        } else if (employeesData.length > 0) {
          setEmployeeId(employeesData[0].id);
        }
      } catch {
        setMessage("Unable to load request form data.");
      } finally {
        setLoadingEmployees(false);
      }
    }

    loadInitialData();
  }, []);

  useEffect(() => {
    async function loadBalance() {
      if (!employeeId) {
        setEmployeeBalance(null);
        return;
      }

      setLoadingBalance(true);

      try {
        const query = startDate
          ? `?requestStartDate=${encodeURIComponent(startDate)}`
          : "";

        const response = await fetch(`/api/employees/${employeeId}${query}`);
        const data = await response.json();

        if (response.ok) {
          setEmployeeBalance(data);
        } else {
          setEmployeeBalance(null);
        }
      } catch {
        setEmployeeBalance(null);
      } finally {
        setLoadingBalance(false);
      }
    }

    loadBalance();
  }, [employeeId, startDate]);

  useEffect(() => {
    async function loadConflicts() {
      if (!employeeId || !startDate || !endDate) {
        setStaffingConflict(null);
        return;
      }

      setLoadingConflicts(true);

      try {
        const params = new URLSearchParams({
          employeeId,
          startDate,
          endDate,
        });

        const response = await fetch(`/api/staffing/conflicts?${params.toString()}`);
        const data = await response.json();

        if (response.ok) {
          setStaffingConflict(data);
        } else {
          setStaffingConflict(null);
        }
      } catch {
        setStaffingConflict(null);
      } finally {
        setLoadingConflicts(false);
      }
    }

    loadConflicts();
  }, [employeeId, startDate, endDate]);

  useEffect(() => {
    if (!startDate || !endDate) return;
    if (isCompLeaveType(leaveType)) return;

    const workdayCount = countWeekdaysInclusive(startDate, endDate);
    const calculatedHours = workdayCount * 8;

    if (calculatedHours > 0) {
      setHours(String(calculatedHours));
    }
  }, [startDate, endDate, leaveType]);

  const requestedHours = useMemo(() => Number(hours || 0), [hours]);

  const isPtoBucketRequest = isPtoBucketLeaveType(leaveType);
  const isCompRequest = isCompLeaveType(leaveType);
  const isWorkflowOnlyRequest = isWorkflowOnlyLeaveType(leaveType);
  const isBalanceTrackedRequest = isBalanceTrackedLeaveType(leaveType);

  const activeBalance = isCompRequest
    ? employeeBalance?.currentCompBalance ?? 0
    : employeeBalance?.currentPtoBalance ?? 0;

  const projectedPtoBalance =
    employeeBalance?.ptoProjection?.projectedBalance ?? activeBalance;

  const displayAvailableBalance = isCompRequest ? activeBalance : projectedPtoBalance;
  const projectedShortfall =
    isBalanceTrackedRequest && requestedHours > displayAvailableBalance;

  const canRequestForOthers = currentUser?.canRequestForOthers ?? false;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/pto-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId,
          leaveType,
          startDate,
          endDate,
          hours: Number(hours),
          notes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to submit PTO request.");
      } else {
        setMessage(
          projectedShortfall
            ? "Request submitted. Warning: projected available hours may still be below the requested amount by the requested date."
            : "Leave request submitted successfully."
        );

        setLeaveType("PTO");
        setStartDate("");
        setEndDate("");
        setHours("8");
        setNotes("");
        setStaffingConflict(null);
      }
    } catch {
      setMessage("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-2xl font-bold">Submit Time-Off Request</h2>

      <div className="rounded-xl bg-white p-4 shadow sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2">Employee</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full rounded border px-3 py-2.5 text-base"
              disabled={
                loadingEmployees || employees.length === 0 || !canRequestForOthers
              }
              required
            >
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.firstName} {employee.lastName}
                  {employee.department ? ` — ${employee.department}` : ""}
                </option>
              ))}
            </select>

            {!canRequestForOthers && currentUser && (
              <p className="text-xs text-slate-500 mt-2">
                You can submit requests for yourself only.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded border bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-700 mb-1">
                Current PTO Balance
              </div>
              {loadingBalance ? (
                <div className="text-sm text-slate-500">Loading...</div>
              ) : (
                <div className="text-lg font-semibold">
                  {employeeBalance?.currentPtoBalance ?? 0} hours
                </div>
              )}
            </div>

            <div className="rounded border bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-700 mb-1">
                Current COMP Balance
              </div>
              {loadingBalance ? (
                <div className="text-sm text-slate-500">Loading...</div>
              ) : (
                <div className="text-lg font-semibold">
                  {employeeBalance?.currentCompBalance ?? 0} hours
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Request Type</label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              className="w-full rounded border px-3 py-2.5 text-base"
            >
              <option value="PTO">PTO</option>
              <option value="SICK">SICK</option>
              <option value="COMP">COMP</option>
              <option value="BEREAVEMENT">BEREAVEMENT</option>
            </select>
          </div>

          {isPtoBucketRequest && startDate && employeeBalance?.ptoProjection && (
            <div className="bg-blue-50 border border-blue-200 rounded p-4 space-y-2">
              <div className="text-sm font-medium text-blue-900">
                Projected PTO Balance on {new Date(startDate).toLocaleDateString()}
              </div>
              <div className="text-lg font-semibold text-blue-900">
                {employeeBalance.ptoProjection.projectedBalance.toFixed(2)} hours
              </div>
              <div className="text-sm text-blue-800">
                {employeeBalance.ptoProjection.accrualSummaryText ??
                  `${employeeBalance.ptoProjection.accrualCount} accrual(s) × ${employeeBalance.ptoProjection.monthlyRate.toFixed(
                    2
                  )} hrs/month`}
              </div>
              {employeeBalance.accrualSummary?.source !== "STANDARD_TENURE" && (
                <div className="text-xs text-amber-700">
                  {employeeBalance.accrualSummary?.source === "MANUAL_ONLY"
                    ? `Manual-only accrual in use: ${employeeBalance.accrualSummary.currentMonthlyRate.toFixed(2)} hrs/month`
                    : `Advanced tier in use: ${employeeBalance.accrualSummary?.activeTier ?? "N/A"} (${employeeBalance.accrualSummary?.currentMonthlyRate.toFixed(2)} hrs/month)`}
                  {employeeBalance.accrualSummary?.reason
                    ? ` — ${employeeBalance.accrualSummary.reason}`
                    : ""}
                </div>
              )}
            </div>
          )}

          {isCompRequest && (
            <div className="bg-blue-50 border border-blue-200 rounded p-4">
              <div className="text-sm font-medium text-blue-900">
                COMP requests use the COMP bucket only.
              </div>
              <div className="text-sm text-blue-800 mt-1">
                No automatic accrual projection applies to COMP time.
              </div>
            </div>
          )}

          {isWorkflowOnlyRequest && (
            <div className="bg-emerald-50 border border-emerald-200 rounded p-4">
              <div className="text-sm font-medium text-emerald-900">
                Bereavement leave is workflow-only.
              </div>
              <div className="text-sm text-emerald-800 mt-1">
                Approved bereavement requests do not reduce PTO or COMP balances and do not use accrual projections.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium mb-2">Start Date</label>
<input
  type="date"
  value={startDate}
  onChange={(e) => {
    const newStartDate = e.target.value;
    setStartDate(newStartDate);

    if (!endDate || endDate < newStartDate) {
      setEndDate(newStartDate);
    }
  }}
  className="w-full rounded border px-3 py-2.5 text-base"
  required
/>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">End Date</label>
<input
  type="date"
  value={endDate}
  min={startDate || undefined}
  onChange={(e) => setEndDate(e.target.value)}
  className="w-full rounded border px-3 py-2.5 text-base"
  required
/>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Hours</label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-full rounded border px-3 py-2.5 text-base"
                required
              />
              <p className="text-xs text-slate-500 mt-1">
  Hours default based on weekdays selected, but can be adjusted for partial days.
</p>
{Number(hours) === 0 && startDate && endDate && (
  <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 mt-2">
    Selected dates do not include any weekdays. PTO is normally requested for workdays only.
  </div>
)}
            </div>
          </div>

          {projectedShortfall && startDate && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
              {isCompRequest
                ? "Requested COMP hours exceed the currently available COMP balance. The request can still be submitted for manager review."
                : "Projected PTO balance on the request date is below the requested hours. The request can still be submitted for manager review."}
            </div>
          )}

          {loadingConflicts ? (
            <div className="text-sm text-slate-500">Checking staffing conflicts...</div>
          ) : staffingConflict && staffingConflict.conflictCount > 0 ? (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 space-y-2">
              <div>
                {staffingConflict.conflictCount} overlapping request(s) found in{" "}
                {staffingConflict.department ?? "this department"} for the selected dates.
              </div>
              <div>
                Approved: {staffingConflict.approvedCount} • Pending: {staffingConflict.pendingCount}
              </div>
              <div className="space-y-1">
                {staffingConflict.employeesOff.slice(0, 5).map((item) => (
                  <div key={item.id}>
                    {item.employeeName} • {item.leaveType} • {item.status}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <label className="block text-sm font-medium mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-28 w-full rounded border px-3 py-2.5 text-base"
              placeholder="Optional notes"
            />
          </div>

          <button
            type="submit"
            disabled={loading || loadingEmployees || employees.length === 0}
            className="w-full rounded bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 sm:w-auto"
          >
            {loading ? "Submitting..." : "Submit Request"}
          </button>

          {message && (
            <div className="text-sm text-slate-700 pt-2">{message}</div>
          )}
        </form>
      </div>
    </div>
  );
}
