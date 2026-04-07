"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type TemplateOption = {
  id: string;
  name: string;
};

type OffboardingSummary = {
  id: string;
  status: string;
  separationType: string;
  terminationDate: string;
  completionPercentage: number;
  totalTasks: number;
  completedTasks: number;
};

function todayValue() {
  return new Date().toISOString().split("T")[0];
}

export default function EmployeeOffboardingPanel({
  employeeId,
  offboarding,
  activeTemplates,
  canCreate,
}: {
  employeeId: string;
  offboarding: OffboardingSummary | null;
  activeTemplates: TemplateOption[];
  canCreate: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [templateId, setTemplateId] = useState(activeTemplates[0]?.id ?? "");
  const [separationType, setSeparationType] = useState("VOLUNTARY");
  const [terminationDate, setTerminationDate] = useState(todayValue());
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const canSubmit = useMemo(
    () => Boolean(separationType && terminationDate),
    [separationType, terminationDate]
  );

  async function handleCreate() {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/offboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId,
          templateId: templateId || null,
          separationType,
          terminationDate,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to create offboarding.");
      } else {
        setMessage("Offboarding created successfully.");
        setTimeout(() => {
          window.location.reload();
        }, 400);
      }
    } catch {
      setMessage("Unable to create offboarding.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow sm:p-6">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-start justify-between gap-4 text-left"
        aria-expanded={expanded}
      >
        <div>
          <h3 className="text-lg font-semibold">Offboarding</h3>
          <p className="mt-1 text-sm text-slate-600">
            Track separation workflow progress and offboarding actions for this employee.
          </p>
        </div>

        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className={`mt-0.5 h-5 w-5 shrink-0 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`}
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
        <div className="mt-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div />

            {offboarding && (
              <Link
                href={`/offboarding/${offboarding.id}`}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                View offboarding record
              </Link>
            )}
          </div>

          {offboarding ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="rounded border border-slate-200 px-4 py-3 text-sm">
                <div className="text-slate-500">Status</div>
                <div className="mt-1 font-semibold text-slate-900">
                  {offboarding.status}
                </div>
              </div>
              <div className="rounded border border-slate-200 px-4 py-3 text-sm">
                <div className="text-slate-500">Separation Type</div>
                <div className="mt-1 font-semibold text-slate-900">
                  {offboarding.separationType}
                </div>
              </div>
              <div className="rounded border border-slate-200 px-4 py-3 text-sm">
                <div className="text-slate-500">Termination Date</div>
                <div className="mt-1 font-semibold text-slate-900">
                  {offboarding.terminationDate}
                </div>
              </div>
              <div className="rounded border border-slate-200 px-4 py-3 text-sm">
                <div className="text-slate-500">Progress</div>
                <div className="mt-1 font-semibold text-slate-900">
                  {offboarding.completionPercentage}% ({offboarding.completedTasks}/
                  {offboarding.totalTasks})
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-slate-500">
                No offboarding record has been created for this employee.
              </div>

              {canCreate && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium">Separation Type</label>
                      <select
                        value={separationType}
                        onChange={(event) => setSeparationType(event.target.value)}
                        className="w-full rounded border px-3 py-2"
                      >
                        <option value="VOLUNTARY">VOLUNTARY</option>
                        <option value="INVOLUNTARY">INVOLUNTARY</option>
                        <option value="RETIREMENT">RETIREMENT</option>
                        <option value="END_OF_CONTRACT">END_OF_CONTRACT</option>
                        <option value="OTHER">OTHER</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium">Termination Date</label>
                      <input
                        type="date"
                        value={terminationDate}
                        onChange={(event) => setTerminationDate(event.target.value)}
                        className="w-full rounded border px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium">
                        Template
                      </label>
                      <select
                        value={templateId}
                        onChange={(event) => setTemplateId(event.target.value)}
                        className="w-full rounded border px-3 py-2"
                      >
                        <option value="">No template</option>
                        {activeTemplates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={!canSubmit || saving}
                      className="rounded bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {saving ? "Creating..." : "Start Offboarding"}
                    </button>
                  </div>

                  {message && <div className="text-sm text-slate-700">{message}</div>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
