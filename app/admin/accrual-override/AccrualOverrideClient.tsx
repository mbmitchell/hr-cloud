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
  monthlyAccrualOverride?: number | null;
  accrualOverrideReason?: string | null;
};

export default function AccrualOverrideClient() {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [employeeDetail, setEmployeeDetail] = useState<EmployeeDetail | null>(null);
  const [monthlyOverride, setMonthlyOverride] = useState("");
  const [reason, setReason] = useState("");
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
          setMonthlyOverride(
            data.monthlyAccrualOverride != null
              ? String(data.monthlyAccrualOverride)
              : ""
          );
          setReason(data.accrualOverrideReason ?? "");
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
          monthlyAccrualOverride:
            monthlyOverride.trim() === "" ? null : Number(monthlyOverride),
          accrualOverrideReason: reason.trim() === "" ? null : reason.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to save override.");
      } else {
        setMessage("Accrual override saved successfully.");

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
          monthlyAccrualOverride: null,
          accrualOverrideReason: null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to clear override.");
      } else {
        setMessage("Accrual override cleared.");
        setMonthlyOverride("");
        setReason("");

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
      <h2 className="text-2xl font-bold">Accrual Override</h2>

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
                  <b>Current Override:</b>{" "}
                  {employeeDetail.monthlyAccrualOverride != null
                    ? `${employeeDetail.monthlyAccrualOverride} hrs/month`
                    : "None"}
                </div>
                <div>
                  <b>Reason:</b> {employeeDetail.accrualOverrideReason ?? "-"}
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">No employee selected.</div>
            )}
          </div>

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
              Leave blank to remove the override and use tenure-based accrual.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border rounded px-3 py-2 min-h-28"
              placeholder="Reason for override"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Override"}
            </button>

            <button
              type="button"
              onClick={handleClear}
              disabled={saving}
              className="border border-slate-300 px-4 py-2 rounded hover:bg-slate-50 disabled:opacity-50"
            >
              Clear Override
            </button>
          </div>

          {message && <div className="text-sm text-slate-700">{message}</div>}
        </form>
      </div>
    </div>
  );
}