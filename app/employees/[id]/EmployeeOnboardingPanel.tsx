"use client";

import Link from "next/link";
import { useState } from "react";

type TemplateOption = {
  id: string;
  name: string;
};

type Props = {
  employeeId: string;
  onboarding: {
    id: string;
    status: string;
    templateName: string | null;
    totalCount: number;
    completedCount: number;
    pendingCount: number;
    nextDueDate: string | null;
  } | null;
  activeTemplates: TemplateOption[];
  canCreate: boolean;
  defaultExpanded?: boolean;
};

export default function EmployeeOnboardingPanel({
  employeeId,
  onboarding,
  activeTemplates,
  canCreate,
  defaultExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [templateId, setTemplateId] = useState(activeTemplates[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId,
          templateId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to create onboarding.");
      } else {
        setMessage("Onboarding created successfully.");
        setTimeout(() => {
          window.location.reload();
        }, 400);
      }
    } catch {
      setMessage("Unable to create onboarding.");
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
          <h3 className="text-lg font-semibold">Onboarding</h3>
          <p className="mt-1 text-sm text-slate-600">
            Track checklist-based onboarding progress for this employee.
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

            {onboarding && (
              <Link
                href={`/onboarding/${onboarding.id}`}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                View onboarding record
              </Link>
            )}
          </div>

          {onboarding ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="rounded border border-slate-200 px-4 py-3 text-sm">
                <div className="text-slate-500">Status</div>
                <div className="mt-1 font-semibold text-slate-900">
                  {onboarding.status}
                </div>
              </div>
              <div className="rounded border border-slate-200 px-4 py-3 text-sm">
                <div className="text-slate-500">Template</div>
                <div className="mt-1 font-semibold text-slate-900">
                  {onboarding.templateName ?? "-"}
                </div>
              </div>
              <div className="rounded border border-slate-200 px-4 py-3 text-sm">
                <div className="text-slate-500">Completed</div>
                <div className="mt-1 font-semibold text-slate-900">
                  {onboarding.completedCount} / {onboarding.totalCount}
                </div>
              </div>
              <div className="rounded border border-slate-200 px-4 py-3 text-sm">
                <div className="text-slate-500">Next Due</div>
                <div className="mt-1 font-semibold text-slate-900">
                  {onboarding.nextDueDate ?? "-"}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-slate-500">
                No onboarding record has been created for this employee.
              </div>

              {canCreate && (
                <div className="space-y-3">
                  {activeTemplates.length === 0 ? (
                    <div className="text-sm text-slate-500">
                      No active onboarding templates are available yet.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="w-full sm:max-w-sm">
                        <label className="mb-2 block text-sm font-medium">Template</label>
                        <select
                          value={templateId}
                          onChange={(event) => setTemplateId(event.target.value)}
                          className="w-full rounded border px-3 py-2"
                        >
                          {activeTemplates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={handleCreate}
                        disabled={!templateId || saving}
                        className="rounded bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        {saving ? "Creating..." : "Create Onboarding"}
                      </button>
                    </div>
                  )}

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
