"use client";

import { useState } from "react";

type CompensationProfile = {
  employeeId: string;
  payType: "SALARY" | "HOURLY" | null;
  annualSalary: string | null;
  hourlyRate: string | null;
  standardHours: string;
  payrollFrequency: "BIWEEKLY" | "SEMI_MONTHLY" | "MONTHLY";
  effectiveDate: string;
  notes: string | null;
  hasProfile: boolean;
};

export default function EmployeeCompensationPanel({
  profile,
  defaultExpanded = false,
}: {
  profile: CompensationProfile;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [payType, setPayType] = useState<"SALARY" | "HOURLY">(
    profile.payType ?? "SALARY"
  );
  const [annualSalary, setAnnualSalary] = useState(profile.annualSalary ?? "");
  const [hourlyRate, setHourlyRate] = useState(profile.hourlyRate ?? "");
  const [standardHours, setStandardHours] = useState(profile.standardHours);
  const [payrollFrequency, setPayrollFrequency] = useState(profile.payrollFrequency);
  const [effectiveDate, setEffectiveDate] = useState(profile.effectiveDate);
  const [notes, setNotes] = useState(profile.notes ?? "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/compensation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId: profile.employeeId,
          payType,
          annualSalary: payType === "SALARY" ? annualSalary : null,
          hourlyRate: payType === "HOURLY" ? hourlyRate : null,
          standardHours,
          payrollFrequency,
          effectiveDate,
          notes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to save compensation profile.");
      } else {
        setMessage(
          profile.hasProfile
            ? "Compensation profile updated successfully."
            : "Compensation profile created successfully."
        );

        setTimeout(() => {
          window.location.reload();
        }, 800);
      }
    } catch {
      setMessage("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow sm:p-6">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-4 text-left"
        aria-expanded={expanded}
      >
        <div>
          <h3 className="text-lg font-semibold">Compensation</h3>
          <p className="mt-1 text-sm text-slate-600">
            Maintain the current pay profile used for HR and payroll-supporting reporting.
          </p>
        </div>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className={`h-5 w-5 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path
            d="M5 7.5 10 12.5l5-5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {expanded && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-5">
          <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-700">
            <div>
              <span className="font-medium">Current profile:</span>{" "}
              {profile.hasProfile ? "Structured compensation profile on file" : "Using legacy employee compensation values until a profile is saved"}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Pay Type</label>
              <select
                value={payType}
                onChange={(event) => setPayType(event.target.value as "SALARY" | "HOURLY")}
                className="w-full rounded border px-3 py-2"
              >
                <option value="SALARY">SALARY</option>
                <option value="HOURLY">HOURLY</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Payroll Frequency</label>
              <select
                value={payrollFrequency}
                onChange={(event) =>
                  setPayrollFrequency(
                    event.target.value as "BIWEEKLY" | "SEMI_MONTHLY" | "MONTHLY"
                  )
                }
                className="w-full rounded border px-3 py-2"
              >
                <option value="BIWEEKLY">BIWEEKLY</option>
                <option value="SEMI_MONTHLY">SEMI_MONTHLY</option>
                <option value="MONTHLY">MONTHLY</option>
              </select>
            </div>

            {payType === "SALARY" ? (
              <div>
                <label className="mb-2 block text-sm font-medium">Annual Salary</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={annualSalary}
                  onChange={(event) => setAnnualSalary(event.target.value)}
                  className="w-full rounded border px-3 py-2"
                  required
                />
              </div>
            ) : (
              <div>
                <label className="mb-2 block text-sm font-medium">Hourly Rate</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={hourlyRate}
                  onChange={(event) => setHourlyRate(event.target.value)}
                  className="w-full rounded border px-3 py-2"
                  required
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium">Standard Hours</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={standardHours}
                onChange={(event) => setStandardHours(event.target.value)}
                className="w-full rounded border px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Effective Date</label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(event) => setEffectiveDate(event.target.value)}
                className="w-full rounded border px-3 py-2"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">Notes</label>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                className="w-full rounded border px-3 py-2"
                placeholder="Optional context for the compensation profile"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-800 disabled:opacity-50 sm:w-auto"
          >
            {saving
              ? "Saving..."
              : profile.hasProfile
                ? "Save Compensation Changes"
                : "Create Compensation Profile"}
          </button>

          {message && <div className="text-sm text-slate-700">{message}</div>}
        </form>
      )}
    </div>
  );
}
