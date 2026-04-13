"use client";

import { useEffect, useState } from "react";

type EmployeeOption = {
  id: string;
  firstName: string;
  lastName: string;
  department: string | null;
};

type EmployeeCompensation = {
  id: string;
  firstName: string;
  lastName: string;
  profileId: string | null;
  payType: "SALARY" | "HOURLY" | null;
  hourlyRate: string | null;
  annualSalary: string | null;
  standardHours: string;
  payrollFrequency: "BIWEEKLY" | "SEMI_MONTHLY" | "MONTHLY";
  effectiveDate: string;
  notes: string | null;
  hasProfile: boolean;
};

export default function CompensationAdminClient() {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [employeeDetail, setEmployeeDetail] = useState<EmployeeCompensation | null>(null);

  const [payType, setPayType] = useState("SALARY");
  const [hourlyRate, setHourlyRate] = useState("");
  const [annualSalary, setAnnualSalary] = useState("");
  const [standardHours, setStandardHours] = useState("40.00");
  const [payrollFrequency, setPayrollFrequency] = useState("BIWEEKLY");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [notes, setNotes] = useState("");

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
        const response = await fetch(`/api/admin/compensation/${employeeId}`);
        const data = await response.json();

        if (!response.ok) {
          setMessage(data.error || "Unable to load employee compensation.");
          setEmployeeDetail(null);
          return;
        }

        setEmployeeDetail(data);
        setPayType(data.payType ?? "SALARY");
        setHourlyRate(data.hourlyRate ?? "");
        setAnnualSalary(data.annualSalary ?? "");
        setStandardHours(data.standardHours ?? "40.00");
        setPayrollFrequency(data.payrollFrequency ?? "BIWEEKLY");
        setEffectiveDate(data.effectiveDate ?? "");
        setNotes(data.notes ?? "");
      } catch {
        setMessage("Unable to load employee compensation.");
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
      const response = await fetch("/api/admin/compensation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId,
          payType,
          hourlyRate: payType === "HOURLY" ? hourlyRate : null,
          annualSalary: payType === "SALARY" ? annualSalary : null,
          standardHours,
          payrollFrequency,
          effectiveDate,
          notes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to save compensation.");
      } else {
        setMessage("Compensation updated successfully.");

        const refreshResponse = await fetch(`/api/admin/compensation/${employeeId}`);
        const refreshData = await refreshResponse.json();

        if (refreshResponse.ok) {
          setEmployeeDetail(refreshData);
          setPayType(refreshData.payType ?? "SALARY");
          setHourlyRate(refreshData.hourlyRate ?? "");
          setAnnualSalary(refreshData.annualSalary ?? "");
          setStandardHours(refreshData.standardHours ?? "40.00");
          setPayrollFrequency(refreshData.payrollFrequency ?? "BIWEEKLY");
          setEffectiveDate(refreshData.effectiveDate ?? "");
          setNotes(refreshData.notes ?? "");
        }
      }
    } catch {
      setMessage("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold">Compensation Management</h2>
        <p className="text-sm text-slate-600 mt-1">
          Maintain the employee compensation profile used for HR and payroll-supporting reporting.
        </p>
      </div>

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

          <div className="bg-slate-50 border rounded p-4 text-sm">
            {loadingEmployee ? (
              <div className="text-slate-500">Loading employee compensation...</div>
            ) : employeeDetail ? (
              <div className="space-y-1">
                <div>
                  <b>Current Pay Type:</b> {employeeDetail.payType ?? "-"}
                </div>
                <div>
                  <b>Current Hourly Rate:</b>{" "}
                  {employeeDetail.hourlyRate != null
                    ? `$${employeeDetail.hourlyRate}`
                    : "-"}
                </div>
                <div>
                  <b>Current Annual Salary:</b>{" "}
                  {employeeDetail.annualSalary != null
                    ? `$${employeeDetail.annualSalary}`
                    : "-"}
                </div>
                <div>
                  <b>Current Standard Hours:</b> {employeeDetail.standardHours}
                </div>
                <div>
                  <b>Payroll Frequency:</b> {employeeDetail.payrollFrequency}
                </div>
                <div>
                  <b>Effective Date:</b> {employeeDetail.effectiveDate}
                </div>
              </div>
            ) : (
              <div className="text-slate-500">No employee selected.</div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Pay Type</label>
            <select
              value={payType}
              onChange={(e) => setPayType(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="HOURLY">Hourly</option>
              <option value="SALARY">Salary</option>
            </select>
          </div>

          {payType === "HOURLY" && (
            <div>
              <label className="block text-sm font-medium mb-2">Hourly Rate</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="Example: 34.00"
                required
              />
            </div>
          )}

          {payType === "SALARY" && (
            <div>
              <label className="block text-sm font-medium mb-2">Annual Salary</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={annualSalary}
                onChange={(e) => setAnnualSalary(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="Example: 95000"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Standard Hours</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={standardHours}
              onChange={(e) => setStandardHours(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="Example: 40.00"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Payroll Frequency</label>
            <select
              value={payrollFrequency}
              onChange={(e) => setPayrollFrequency(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="BIWEEKLY">BIWEEKLY</option>
              <option value="SEMI_MONTHLY">SEMI_MONTHLY</option>
              <option value="MONTHLY">MONTHLY</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Effective Date</label>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border rounded px-3 py-2"
              rows={3}
              placeholder="Optional compensation notes"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Compensation"}
          </button>

          {message && <div className="text-sm text-slate-700">{message}</div>}
        </form>
      </div>
    </div>
  );
}
