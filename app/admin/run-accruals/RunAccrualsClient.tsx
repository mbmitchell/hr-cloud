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

      <div className="max-w-3xl space-y-5 rounded bg-white p-4 shadow sm:p-6">
        <div>
          <label className="block text-sm font-medium mb-2">Run Date</label>
          <input
            type="date"
            value={runDate}
            onChange={(e) => setRunDate(e.target.value)}
            className="w-full rounded border px-3 py-2 sm:w-auto"
          />
          <p className="text-xs text-slate-500 mt-2">
            The job uses the first day of the selected month as the accrual effective date.
          </p>
        </div>

        <button
          onClick={handleRun}
          disabled={loading}
          className="w-full rounded bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-800 disabled:opacity-50 sm:w-auto"
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

          <div className="hidden overflow-hidden rounded bg-white shadow md:block">
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

          <div className="space-y-4 md:hidden">
            {result.details.map((detail) => (
              <div key={detail.employeeId} className="rounded-xl bg-white p-4 shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-base font-semibold text-slate-900">
                    {detail.employeeName}
                  </div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {detail.status}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-slate-500">Hours</div>
                    <div className="font-medium text-slate-900">
                      {detail.hours != null ? detail.hours.toFixed(2) : "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">New Balance</div>
                    <div className="font-medium text-slate-900">
                      {detail.newBalance != null ? detail.newBalance.toFixed(2) : "-"}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-sm">
                  <div className="text-slate-500">Reason</div>
                  <div className="break-words text-slate-900">{detail.reason}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
