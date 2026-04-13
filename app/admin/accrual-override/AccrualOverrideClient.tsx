"use client";

import { useEffect, useState } from "react";

type EmployeeOption = {
  id: string;
  firstName: string;
  lastName: string;
  department: string | null;
};

type EmployeeDetail = {
  id: string;
  firstName: string;
  lastName: string;
  currentPtoBalance: number;
  currentCompBalance: number;
  accrualMode?: "STANDARD_TENURE" | "ADVANCED_TIER" | "MANUAL_ONLY";
  monthlyAccrualOverride?: number | null;
  accrualOverrideReason?: string | null;
  advancedAccrualTier?: "YEARS_1_TO_5" | "YEARS_6_TO_10" | "YEARS_11_PLUS" | null;
  advancedAccrualEffectiveDate?: string | null;
  advancedAccrualReason?: string | null;
  accrualSummary?: {
    mode: string;
    source: string;
    currentMonthlyRate: number;
    tenureTier: string;
    activeTier: string | null;
    nextTier: {
      tier: string;
      monthlyRate: number;
      effectiveDate: string;
    } | null;
  };
};

export default function AccrualOverrideClient() {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [employeeDetail, setEmployeeDetail] = useState<EmployeeDetail | null>(null);
  const [accrualMode, setAccrualMode] = useState<
    "STANDARD_TENURE" | "ADVANCED_TIER" | "MANUAL_ONLY"
  >("STANDARD_TENURE");
  const [monthlyOverride, setMonthlyOverride] = useState("");
  const [reason, setReason] = useState("");
  const [advancedTier, setAdvancedTier] = useState<
    "YEARS_1_TO_5" | "YEARS_6_TO_10" | "YEARS_11_PLUS"
  >("YEARS_6_TO_10");
  const [advancedEffectiveDate, setAdvancedEffectiveDate] = useState("");
  const [advancedReason, setAdvancedReason] = useState("");
  const [message, setMessage] = useState("");
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingEmployee, setLoadingEmployee] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadEmployees() {
      try {
        const response = await fetch("/api/employees");
        const data = await response.json();

        if (response.ok) {
          setEmployees(data);
          if (data.length > 0) {
            setEmployeeId(data[0].id);
          }
        } else {
          setMessage("Unable to load employees.");
        }
      } catch {
        setMessage("Unable to load employees.");
      } finally {
        setLoadingEmployees(false);
      }
    }

    loadEmployees();
  }, []);

  useEffect(() => {
    async function loadEmployee() {
      if (!employeeId) {
        setEmployeeDetail(null);
        return;
      }

      setLoadingEmployee(true);

      try {
        const response = await fetch(`/api/employees/${employeeId}`);
        const data = await response.json();

        if (response.ok) {
          setEmployeeDetail(data);
          setAccrualMode(data.accrualMode ?? "STANDARD_TENURE");
          setMonthlyOverride(
            data.monthlyAccrualOverride != null
              ? String(data.monthlyAccrualOverride)
              : ""
          );
          setReason(data.accrualOverrideReason ?? "");
          setAdvancedTier(data.advancedAccrualTier ?? "YEARS_6_TO_10");
          setAdvancedEffectiveDate(
            data.advancedAccrualEffectiveDate
              ? String(data.advancedAccrualEffectiveDate).split("T")[0]
              : ""
          );
          setAdvancedReason(data.advancedAccrualReason ?? "");
        } else {
          setEmployeeDetail(null);
        }
      } catch {
        setEmployeeDetail(null);
      } finally {
        setLoadingEmployee(false);
      }
    }

    loadEmployee();
  }, [employeeId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/accrual-override", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          employeeId,
          accrualMode,
          monthlyAccrualOverride:
            monthlyOverride.trim() === "" ? null : Number(monthlyOverride),
          accrualOverrideReason: reason.trim() === "" ? null : reason.trim(),
          advancedAccrualTier: advancedTier,
          advancedAccrualEffectiveDate:
            advancedEffectiveDate.trim() === "" ? null : advancedEffectiveDate,
          advancedAccrualReason:
            advancedReason.trim() === "" ? null : advancedReason.trim(),
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to save override.");
      } else {
        setMessage("Accrual settings saved successfully.");

        const refresh = await fetch(`/api/employees/${employeeId}`);
        const refreshData = await refresh.json();
        if (refresh.ok) {
          setEmployeeDetail(refreshData);
        }
      }
    } catch {
      setMessage("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/accrual-override", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          employeeId,
          accrualMode: "STANDARD_TENURE",
          monthlyAccrualOverride: null,
          accrualOverrideReason: null,
          advancedAccrualTier: null,
          advancedAccrualEffectiveDate: null,
          advancedAccrualReason: null,
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to clear override.");
      } else {
        setMessage("Accrual settings reset to standard tenure.");
        setAccrualMode("STANDARD_TENURE");
        setMonthlyOverride("");
        setReason("");
        setAdvancedTier("YEARS_6_TO_10");
        setAdvancedEffectiveDate("");
        setAdvancedReason("");

        const refresh = await fetch(`/api/employees/${employeeId}`);
        const refreshData = await refresh.json();
        if (refresh.ok) {
          setEmployeeDetail(refreshData);
        }
      }
    } catch {
      setMessage("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-2xl font-bold">Accrual Settings</h2>

      <div className="bg-white rounded shadow p-6">
        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2">Employee</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full border rounded px-3 py-2"
              disabled={loadingEmployees}
              required
            >
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.firstName} {employee.lastName}
                  {employee.department ? ` — ${employee.department}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-slate-50 border rounded p-4">
            {loadingEmployee ? (
              <div className="text-sm text-slate-500">Loading employee details...</div>
            ) : employeeDetail ? (
              <div className="space-y-1 text-sm">
                <div>
                  <b>Current PTO Balance:</b> {employeeDetail.currentPtoBalance} hours
                </div>
                <div>
                  <b>Current Mode:</b> {employeeDetail.accrualMode ?? "STANDARD_TENURE"}
                </div>
                <div>
                  <b>Current Rate:</b>{" "}
                  {employeeDetail.accrualSummary?.currentMonthlyRate.toFixed(2) ?? "0.00"} hrs/month
                </div>
                <div>
                  <b>Current Tier:</b> {employeeDetail.accrualSummary?.activeTier ?? "Manual only"}
                </div>
                <div>
                  <b>Next Tier:</b>{" "}
                  {employeeDetail.accrualSummary?.nextTier
                    ? `${employeeDetail.accrualSummary.nextTier.tier} on ${new Date(
                        employeeDetail.accrualSummary.nextTier.effectiveDate
                      ).toLocaleDateString()}`
                    : "No further automatic tier changes"}
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">No employee selected.</div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Accrual Mode</label>
            <select
              value={accrualMode}
              onChange={(e) =>
                setAccrualMode(
                  e.target.value as "STANDARD_TENURE" | "ADVANCED_TIER" | "MANUAL_ONLY"
                )
              }
              className="w-full border rounded px-3 py-2"
            >
              <option value="STANDARD_TENURE">Standard tenure accrual</option>
              <option value="ADVANCED_TIER">Advanced accrual tier</option>
              <option value="MANUAL_ONLY">Manual-only accrual</option>
            </select>
          </div>

          {accrualMode === "ADVANCED_TIER" && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Advanced Tier
                </label>
                <select
                  value={advancedTier}
                  onChange={(e) =>
                    setAdvancedTier(
                      e.target.value as
                        | "YEARS_1_TO_5"
                        | "YEARS_6_TO_10"
                        | "YEARS_11_PLUS"
                    )
                  }
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="YEARS_1_TO_5">Years 1-5 (10.00 hrs/month)</option>
                  <option value="YEARS_6_TO_10">Years 6-10 (13.33 hrs/month)</option>
                  <option value="YEARS_11_PLUS">Years 11+ (16.67 hrs/month)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Effective Date
                </label>
                <input
                  type="date"
                  value={advancedEffectiveDate}
                  onChange={(e) => setAdvancedEffectiveDate(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Use the first day of the month so future monthly accruals apply cleanly.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Reason</label>
                <textarea
                  value={advancedReason}
                  onChange={(e) => setAdvancedReason(e.target.value)}
                  className="w-full border rounded px-3 py-2 min-h-28"
                  placeholder="Reason for early tier advancement"
                />
              </div>
            </>
          )}

          {accrualMode === "MANUAL_ONLY" && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Monthly Accrual Override
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={monthlyOverride}
                  onChange={(e) => setMonthlyOverride(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Example: 13.33"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Manual-only mode disables automatic tenure progression until the mode changes.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Reason</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full border rounded px-3 py-2 min-h-28"
                  placeholder="Reason for manual-only accrual"
                />
              </div>
            </>
          )}

          {accrualMode === "STANDARD_TENURE" && (
            <div className="rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Standard tenure accrual uses the employee's hire date and continues automatic progression through future tiers.
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>

            <button
              type="button"
              onClick={handleClear}
              disabled={saving}
              className="border border-slate-300 px-4 py-2 rounded hover:bg-slate-50 disabled:opacity-50"
            >
              Reset to Standard
            </button>
          </div>

          {message && <div className="text-sm text-slate-700">{message}</div>}
        </form>
      </div>
    </div>
  );
}
