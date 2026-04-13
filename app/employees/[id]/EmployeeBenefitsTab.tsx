"use client";

import { useState } from "react";

import EmployeeProfileSection from "./EmployeeProfileSection";

type BenefitElection = {
  id: string;
  benefitType: "MEDICAL" | "DENTAL" | "VISION" | "LIFE" | "OTHER";
  planName: string;
  coverageLevel: string | null;
  electionStatus: "ENROLLED" | "WAIVED";
  effectiveDate: string;
  totalMonthlyCost: string;
  companyMonthlyCost: string;
  employeeMonthlyCost: string;
  estimatedPerPaycheckWithholding: string | null;
  payrollFrequency: "BIWEEKLY" | "SEMI_MONTHLY" | "MONTHLY";
  notes: string | null;
};

type DraftBenefitElection = {
  id?: string;
  benefitType: BenefitElection["benefitType"];
  planName: string;
  coverageLevel: string;
  electionStatus: BenefitElection["electionStatus"];
  effectiveDate: string;
  totalMonthlyCost: string;
  companyMonthlyCost: string;
  employeeMonthlyCost: string;
  notes: string;
};

function formatCurrency(value: string) {
  return Number(value).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function toDraft(election?: BenefitElection): DraftBenefitElection {
  return {
    id: election?.id,
    benefitType: election?.benefitType ?? "MEDICAL",
    planName: election?.planName ?? "",
    coverageLevel: election?.coverageLevel ?? "",
    electionStatus: election?.electionStatus ?? "ENROLLED",
    effectiveDate: election?.effectiveDate ?? "",
    totalMonthlyCost: election?.totalMonthlyCost ?? "0.00",
    companyMonthlyCost: election?.companyMonthlyCost ?? "0.00",
    employeeMonthlyCost: election?.employeeMonthlyCost ?? "0.00",
    notes: election?.notes ?? "",
  };
}

export default function EmployeeBenefitsTab({
  employeeId,
  elections,
  canManage,
  payrollFrequency,
}: {
  employeeId: string;
  elections: BenefitElection[];
  canManage: boolean;
  payrollFrequency: "BIWEEKLY" | "SEMI_MONTHLY" | "MONTHLY";
}) {
  const [draft, setDraft] = useState<DraftBenefitElection>(toDraft());
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const isEdit = Boolean(draft.id);
    const url = isEdit
      ? `/api/employees/${employeeId}/benefits/${draft.id}`
      : `/api/employees/${employeeId}/benefits`;

    try {
      const response = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draft),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to save benefit election.");
      } else {
        setMessage(
          isEdit
            ? "Benefit election updated successfully."
            : "Benefit election added successfully."
        );
        setDraft(toDraft());
        setTimeout(() => {
          window.location.reload();
        }, 700);
      }
    } catch {
      setMessage("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(benefitId: string) {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(`/api/employees/${employeeId}/benefits/${benefitId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to delete benefit election.");
      } else {
        setMessage("Benefit election removed.");
        setDraft(toDraft());
        setTimeout(() => {
          window.location.reload();
        }, 700);
      }
    } catch {
      setMessage("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <EmployeeProfileSection title="Benefit Elections" defaultExpanded>
        <div className="space-y-4">
          {elections.length === 0 ? (
            <div className="text-sm text-slate-500">No benefit elections recorded yet.</div>
          ) : (
            elections.map((election) => (
              <div
                key={election.id}
                className="rounded-lg border border-slate-200 p-4 text-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-900">
                      {election.benefitType} • {election.planName}
                    </div>
                    <div>
                      <b>Status:</b> {election.electionStatus}
                    </div>
                    <div>
                      <b>Coverage:</b> {election.coverageLevel ?? "-"}
                    </div>
                    <div>
                      <b>Effective Date:</b>{" "}
                      {new Date(election.effectiveDate).toLocaleDateString()}
                    </div>
                    <div>
                      <b>Total Monthly Cost:</b> {formatCurrency(election.totalMonthlyCost)}
                    </div>
                    <div>
                      <b>Company Monthly Cost:</b>{" "}
                      {formatCurrency(election.companyMonthlyCost)}
                    </div>
                    <div>
                      <b>Employee Monthly Cost:</b>{" "}
                      {formatCurrency(election.employeeMonthlyCost)}
                    </div>
                    {election.electionStatus === "ENROLLED" ? (
                      <>
                        <div>
                          <b>Estimated Per-Paycheck Withholding:</b>{" "}
                          {election.estimatedPerPaycheckWithholding
                            ? formatCurrency(election.estimatedPerPaycheckWithholding)
                            : "-"}
                        </div>
                        <div>
                          <b>Payroll Frequency Used:</b>{" "}
                          {election.payrollFrequency ?? payrollFrequency}
                        </div>
                      </>
                    ) : null}
                    <div>
                      <b>Notes:</b> {election.notes ?? "-"}
                    </div>
                  </div>

                  {canManage ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setDraft(toDraft(election))}
                        className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(election.id)}
                        disabled={saving}
                        className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </EmployeeProfileSection>

      {canManage ? (
        <EmployeeProfileSection
          title={draft.id ? "Edit Benefit Election" : "Add Benefit Election"}
          defaultExpanded
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">Benefit Type</label>
                <select
                  value={draft.benefitType}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      benefitType: event.target.value as DraftBenefitElection["benefitType"],
                    }))
                  }
                  className="w-full rounded border px-3 py-2"
                >
                  <option value="MEDICAL">MEDICAL</option>
                  <option value="DENTAL">DENTAL</option>
                  <option value="VISION">VISION</option>
                  <option value="LIFE">LIFE</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Election Status</label>
                <select
                  value={draft.electionStatus}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      electionStatus: event.target.value as DraftBenefitElection["electionStatus"],
                    }))
                  }
                  className="w-full rounded border px-3 py-2"
                >
                  <option value="ENROLLED">ENROLLED</option>
                  <option value="WAIVED">WAIVED</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Plan Name</label>
                <input
                  type="text"
                  value={draft.planName}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, planName: event.target.value }))
                  }
                  className="w-full rounded border px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Coverage Level</label>
                <input
                  type="text"
                  value={draft.coverageLevel}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      coverageLevel: event.target.value,
                    }))
                  }
                  className="w-full rounded border px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Effective Date</label>
                <input
                  type="date"
                  value={draft.effectiveDate}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      effectiveDate: event.target.value,
                    }))
                  }
                  className="w-full rounded border px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Total Monthly Cost</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={draft.totalMonthlyCost}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      totalMonthlyCost: event.target.value,
                    }))
                  }
                  className="w-full rounded border px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Company Monthly Cost</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={draft.companyMonthlyCost}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      companyMonthlyCost: event.target.value,
                    }))
                  }
                  className="w-full rounded border px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Employee Monthly Cost</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={draft.employeeMonthlyCost}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      employeeMonthlyCost: event.target.value,
                    }))
                  }
                  className="w-full rounded border px-3 py-2"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium">Notes</label>
                <textarea
                  value={draft.notes}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, notes: event.target.value }))
                  }
                  className="min-h-24 w-full rounded border px-3 py-2"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={saving}
                className="rounded bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : draft.id ? "Save Election" : "Add Election"}
              </button>

              {draft.id ? (
                <button
                  type="button"
                  onClick={() => setDraft(toDraft())}
                  className="rounded border border-slate-300 px-4 py-2.5 hover:bg-slate-50"
                >
                  Cancel Edit
                </button>
              ) : null}
            </div>

            {message ? <div className="text-sm text-slate-700">{message}</div> : null}
          </form>
        </EmployeeProfileSection>
      ) : null}
    </div>
  );
}
