"use client";

import { useState } from "react";

type AccrualDetail = {
  employeeId: string;
  employeeName: string;
  status: "CREATED" | "SKIPPED";
  reason: string;
  hours?: number;
  newBalance?: number;
};

type AccrualResult = {
  runDate: string;
  processedEmployees: number;
  skippedEmployees: number;
  createdEntries: number;
  details: AccrualDetail[];
};

function todayForInput() {
  return new Date().toISOString().split("T")[0];
}

export default function RunAccrualsClient() {
  const [runDate, setRunDate] = useState(todayForInput());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<AccrualResult | null>(null);

  async function handleRun() {
    setLoading(true);
    setMessage("");
    setResult(null);

    try {
      const response = await fetch("/api/admin/run-accruals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ runDate }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to run accruals.");
      } else {
        setResult(data);
        setMessage("Monthly accruals completed.");
      }
    } catch {
      setMessage("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Run Monthly Accruals</h2>
        <p className="text-sm text-slate-600 mt-1">
          Posts PTO accruals to the PTO bucket for active employees on the first of the month.
        </p>
      </div>

      <div className="bg-white rounded shadow p-6 space-y-5 max-w-3xl">
        <div>
          <label className="block text-sm font-medium mb-2">Run Date</label>
          <input
            type="date"
            value={runDate}
            onChange={(e) => setRunDate(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <p className="text-xs text-slate-500 mt-2">
            The job uses the first day of the selected month as the accrual effective date.
          </p>
        </div>

        <button
          onClick={handleRun}
          disabled={loading}
          className="bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? "Running..." : "Run Monthly Accruals"}
        </button>

        {message && <div className="text-sm text-slate-700">{message}</div>}
      </div>

      {result && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded shadow">
              <div className="text-sm text-slate-500">Processed Employees</div>
              <div className="text-3xl font-semibold mt-2">
                {result.processedEmployees}
              </div>
            </div>

            <div className="bg-white p-5 rounded shadow">
              <div className="text-sm text-slate-500">Created Entries</div>
              <div className="text-3xl font-semibold mt-2">
                {result.createdEntries}
              </div>
            </div>

            <div className="bg-white p-5 rounded shadow">
              <div className="text-sm text-slate-500">Skipped</div>
              <div className="text-3xl font-semibold mt-2">
                {result.skippedEmployees}
              </div>
            </div>
          </div>

          <div className="bg-white rounded shadow overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold">
                Accrual Run Details for{" "}
                {new Date(result.runDate).toLocaleDateString()}
              </h3>
            </div>

            <table className="w-full">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Hours</th>
                  <th className="p-3">New Balance</th>
                  <th className="p-3">Reason</th>
                </tr>
              </thead>
              <tbody>
                {result.details.map((detail) => (
                  <tr key={detail.employeeId} className="border-t">
                    <td className="p-3">{detail.employeeName}</td>
                    <td className="p-3">{detail.status}</td>
                    <td className="p-3">
                      {detail.hours != null ? detail.hours.toFixed(2) : "-"}
                    </td>
                    <td className="p-3">
                      {detail.newBalance != null ? detail.newBalance.toFixed(2) : "-"}
                    </td>
                    <td className="p-3">{detail.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}