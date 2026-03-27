"use client";

import { useEffect, useState } from "react";

type EmployeeOption = {
  id: string;
  firstName: string;
  lastName: string;
  department: string | null;
};

export default function AdminAdjustmentsClient() {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [bucket, setBucket] = useState("COMP");
  const [adjustmentType, setAdjustmentType] = useState("MANUAL_ADD");
  const [hours, setHours] = useState("1");
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

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
      }
    }

    loadEmployees();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/adjustments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId,
          bucket,
          adjustmentType,
          hours: Number(hours),
          effectiveDate,
          reason,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to post adjustment.");
      } else {
        setMessage("Adjustment posted successfully.");
        setHours("1");
        setReason("");
      }
    } catch {
      setMessage("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-2xl font-bold">Admin Adjustments</h2>

      <div className="bg-white rounded shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2">Employee</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full border rounded px-3 py-2"
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Bucket</label>
              <select
                value={bucket}
                onChange={(e) => setBucket(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="PTO">PTO</option>
                <option value="COMP">COMP</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Adjustment Type
              </label>
              <select
                value={adjustmentType}
                onChange={(e) => setAdjustmentType(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="MANUAL_ADD">Manual Add</option>
                <option value="MANUAL_SUBTRACT">Manual Subtract</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Hours</label>
              <input
                type="number"
                min="0.25"
                step="0.25"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Effective Date
              </label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border rounded px-3 py-2 min-h-28"
              placeholder="Required reason for adjustment"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "Posting..." : "Post Adjustment"}
          </button>

          {message && <div className="text-sm text-slate-700">{message}</div>}
        </form>
      </div>
    </div>
  );
}