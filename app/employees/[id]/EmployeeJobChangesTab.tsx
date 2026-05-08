"use client";

import { useEffect, useState } from "react";

import EmployeeProfileSection from "./EmployeeProfileSection";

type ManagerOption = {
  id: string;
  firstName: string;
  lastName: string;
};

type DocumentOption = {
  id: string;
  originalFileName: string;
  category: string;
};

type ChangeValues = {
  title?: string | null;
  department?: string | null;
  managerId?: string | null;
  status?: string;
  employmentClassification?: string | null;
  workLocation?: string | null;
  compensation?: {
    payType: "SALARY" | "HOURLY";
    annualSalary: string | null;
    hourlyRate: string | null;
    standardHours: string;
    payrollFrequency: "BIWEEKLY" | "SEMI_MONTHLY" | "MONTHLY";
    effectiveDate: string;
  };
};

type ChangeRequest = {
  id: string;
  status: "DRAFT" | "PENDING" | "APPROVED" | "APPLIED" | "CANCELLED";
  changeType:
    | "COMPENSATION"
    | "JOB_INFO"
    | "MANAGER"
    | "STATUS"
    | "LOCATION"
    | "CLASSIFICATION"
    | "OTHER";
  requestedBy: {
    id: string;
    name: string;
  };
  reviewedBy: {
    id: string;
    name: string;
  } | null;
  submittedAt: string | null;
  approvedAt: string | null;
  appliedAt: string | null;
  cancelledAt: string | null;
  requestedEffectiveDate: string;
  actualEffectiveDate: string | null;
  reason: string | null;
  notes: string | null;
  relatedDocument: {
    id: string;
    originalFileName: string;
    category: string;
  } | null;
  oldValues: ChangeValues;
  newValues: ChangeValues;
  summary: string[];
  createdAt: string;
  updatedAt: string;
};

type DraftFormState = {
  id?: string;
  changeType: ChangeRequest["changeType"];
  requestedEffectiveDate: string;
  reason: string;
  notes: string;
  relatedDocumentId: string;
  title: string;
  department: string;
  managerId: string;
  status: string;
  employmentClassification: string;
  workLocation: string;
  useCompensation: boolean;
  payType: "SALARY" | "HOURLY";
  annualSalary: string;
  hourlyRate: string;
  standardHours: string;
  payrollFrequency: "BIWEEKLY" | "SEMI_MONTHLY" | "MONTHLY";
  compensationEffectiveDate: string;
};

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString();
}

function statusClasses(status: ChangeRequest["status"]) {
  switch (status) {
    case "APPLIED":
      return "bg-emerald-100 text-emerald-800";
    case "APPROVED":
      return "bg-blue-100 text-blue-800";
    case "PENDING":
      return "bg-amber-100 text-amber-800";
    case "CANCELLED":
      return "bg-slate-200 text-slate-700";
    case "DRAFT":
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function emptyDraft(): DraftFormState {
  return {
    changeType: "JOB_INFO",
    requestedEffectiveDate: new Date().toISOString().split("T")[0],
    reason: "",
    notes: "",
    relatedDocumentId: "",
    title: "",
    department: "",
    managerId: "",
    status: "",
    employmentClassification: "",
    workLocation: "",
    useCompensation: false,
    payType: "SALARY",
    annualSalary: "",
    hourlyRate: "",
    standardHours: "40.00",
    payrollFrequency: "BIWEEKLY",
    compensationEffectiveDate: new Date().toISOString().split("T")[0],
  };
}

function toDraft(change: ChangeRequest): DraftFormState {
  return {
    id: change.id,
    changeType: change.changeType,
    requestedEffectiveDate: change.requestedEffectiveDate,
    reason: change.reason ?? "",
    notes: change.notes ?? "",
    relatedDocumentId: change.relatedDocument?.id ?? "",
    title: change.newValues.title ?? "",
    department: change.newValues.department ?? "",
    managerId: change.newValues.managerId ?? "",
    status: change.newValues.status ?? "",
    employmentClassification: change.newValues.employmentClassification ?? "",
    workLocation: change.newValues.workLocation ?? "",
    useCompensation: Boolean(change.newValues.compensation),
    payType: change.newValues.compensation?.payType ?? "SALARY",
    annualSalary: change.newValues.compensation?.annualSalary ?? "",
    hourlyRate: change.newValues.compensation?.hourlyRate ?? "",
    standardHours: change.newValues.compensation?.standardHours ?? "40.00",
    payrollFrequency: change.newValues.compensation?.payrollFrequency ?? "BIWEEKLY",
    compensationEffectiveDate:
      change.newValues.compensation?.effectiveDate ?? change.requestedEffectiveDate,
  };
}

function buildNewValuesPayload(draft: DraftFormState) {
  const newValues: Record<string, unknown> = {};

  if (draft.title.trim()) {
    newValues.title = draft.title.trim();
  }

  if (draft.department.trim()) {
    newValues.department = draft.department.trim();
  }

  if (draft.managerId) {
    newValues.managerId = draft.managerId;
  }

  if (draft.status.trim()) {
    newValues.status = draft.status.trim();
  }

  if (draft.employmentClassification.trim()) {
    newValues.employmentClassification = draft.employmentClassification.trim();
  }

  if (draft.workLocation.trim()) {
    newValues.workLocation = draft.workLocation.trim();
  }

  if (draft.useCompensation) {
    newValues.compensation = {
      payType: draft.payType,
      annualSalary: draft.payType === "SALARY" ? draft.annualSalary : null,
      hourlyRate: draft.payType === "HOURLY" ? draft.hourlyRate : null,
      standardHours: draft.standardHours,
      payrollFrequency: draft.payrollFrequency,
      effectiveDate: draft.compensationEffectiveDate,
    };
  }

  return newValues;
}

function renderValues(values: ChangeValues, managers: ManagerOption[]) {
  const managerMap = new Map(
    managers.map((manager) => [manager.id, `${manager.firstName} ${manager.lastName}`])
  );

  const rows: Array<{ label: string; value: string }> = [];

  if ("title" in values) {
    rows.push({ label: "Title", value: values.title ?? "-" });
  }
  if ("department" in values) {
    rows.push({ label: "Department", value: values.department ?? "-" });
  }
  if ("managerId" in values) {
    rows.push({
      label: "Manager",
      value: values.managerId ? managerMap.get(values.managerId) ?? values.managerId : "-",
    });
  }
  if ("status" in values) {
    rows.push({ label: "Employment Status", value: values.status ?? "-" });
  }
  if ("employmentClassification" in values) {
    rows.push({
      label: "Employment Classification",
      value: values.employmentClassification ?? "-",
    });
  }
  if ("workLocation" in values) {
    rows.push({ label: "Work Location", value: values.workLocation ?? "-" });
  }

  return (
    <div className="space-y-2">
      {rows.length === 0 && !values.compensation ? (
        <div className="text-sm text-slate-500">No values captured.</div>
      ) : null}

      {rows.map((row) => (
        <div key={row.label} className="text-sm">
          <b>{row.label}:</b> {row.value}
        </div>
      ))}

      {values.compensation ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <div>
            <b>Compensation Pay Type:</b> {values.compensation.payType}
          </div>
          <div>
            <b>Annual Salary:</b> {values.compensation.annualSalary ?? "-"}
          </div>
          <div>
            <b>Hourly Rate:</b> {values.compensation.hourlyRate ?? "-"}
          </div>
          <div>
            <b>Standard Hours:</b> {values.compensation.standardHours}
          </div>
          <div>
            <b>Payroll Frequency:</b> {values.compensation.payrollFrequency}
          </div>
          <div>
            <b>Compensation Effective Date:</b>{" "}
            {formatDate(values.compensation.effectiveDate)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function EmployeeJobChangesTab({
  employeeId,
  canManage,
  managers,
}: {
  employeeId: string;
  canManage: boolean;
  managers: ManagerOption[];
}) {
  const [changes, setChanges] = useState<ChangeRequest[]>([]);
  const [selectedChange, setSelectedChange] = useState<ChangeRequest | null>(null);
  const [documents, setDocuments] = useState<DocumentOption[]>([]);
  const [draft, setDraft] = useState<DraftFormState>(emptyDraft());
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadChanges(selectedId?: string) {
    setLoading(true);

    try {
      const response = await fetch(`/api/employees/${employeeId}/job-changes`);
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to load employee changes.");
        return;
      }

      const nextChanges = data.changes as ChangeRequest[];
      setChanges(nextChanges);

      const nextSelectedId = selectedId ?? selectedChange?.id ?? nextChanges[0]?.id;
      if (nextSelectedId) {
        await loadChangeDetail(nextSelectedId);
      } else {
        setSelectedChange(null);
      }
    } catch {
      setMessage("Unable to load employee changes.");
    } finally {
      setLoading(false);
    }
  }

  async function loadChangeDetail(changeId: string) {
    setLoadingDetail(true);

    try {
      const response = await fetch(`/api/employees/${employeeId}/job-changes/${changeId}`);
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to load change details.");
        return;
      }

      setSelectedChange(data.change as ChangeRequest);
    } catch {
      setMessage("Unable to load change details.");
    } finally {
      setLoadingDetail(false);
    }
  }

  useEffect(() => {
    loadChanges();
  }, [employeeId]);

  useEffect(() => {
    if (!canManage) {
      return;
    }

    async function loadDocuments() {
      try {
        const response = await fetch(`/api/employees/${employeeId}/documents`);
        const data = await response.json();

        if (response.ok) {
          setDocuments(
            (data.documents ?? []).map((document: DocumentOption) => ({
              id: document.id,
              originalFileName: document.originalFileName,
              category: document.category,
            }))
          );
        }
      } catch {
        // Keep the form usable even if document options fail to load.
      }
    }

    loadDocuments();
  }, [canManage, employeeId]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const isEdit = Boolean(draft.id);
    const url = isEdit
      ? `/api/employees/${employeeId}/job-changes/${draft.id}`
      : `/api/employees/${employeeId}/job-changes`;

    try {
      const response = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          changeType: draft.changeType,
          requestedEffectiveDate: draft.requestedEffectiveDate,
          reason: draft.reason,
          notes: draft.notes,
          relatedDocumentId: draft.relatedDocumentId || null,
          newValues: buildNewValuesPayload(draft),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to save employee change request.");
      } else {
        setMessage(
          isEdit
            ? "Employee change request updated."
            : "Employee change request draft created."
        );
        setDraft(emptyDraft());
        await loadChanges(data.change?.id);
      }
    } catch {
      setMessage("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAction(
    action: "submit" | "approve" | "apply" | "cancel",
    changeId: string
  ) {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/employees/${employeeId}/job-changes/${changeId}/${action}`,
        {
          method: "POST",
        }
      );
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to update change request.");
      } else {
        setMessage(`Change request ${action}d successfully.`);
        setDraft(emptyDraft());
        await loadChanges(changeId);
      }
    } catch {
      setMessage("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <EmployeeProfileSection title="Change History" defaultExpanded>
        {loading ? (
          <div className="text-sm text-slate-500">Loading change requests...</div>
        ) : changes.length === 0 ? (
          <div className="text-sm text-slate-500">
            No employee change requests recorded yet.
          </div>
        ) : (
          <div className="space-y-3">
            {changes.map((change) => (
              <button
                key={change.id}
                type="button"
                onClick={() => loadChangeDetail(change.id)}
                className={`w-full rounded-lg border p-4 text-left ${
                  selectedChange?.id === change.id
                    ? "border-slate-900 bg-slate-50"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-900">
                      {change.summary.join(", ") || change.changeType}
                    </div>
                    <div className="text-sm text-slate-600">
                      Requested effective date: {formatDate(change.requestedEffectiveDate)}
                    </div>
                    <div className="text-sm text-slate-600">
                      Created by {change.requestedBy.name}
                    </div>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses(change.status)}`}
                  >
                    {change.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </EmployeeProfileSection>

      {selectedChange ? (
        <EmployeeProfileSection title="Change Detail" defaultExpanded>
          {loadingDetail ? (
            <div className="text-sm text-slate-500">Loading change details...</div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Request
                  </div>
                  <div className="mt-2 space-y-2 text-sm">
                    <div>
                      <b>Status:</b> {selectedChange.status}
                    </div>
                    <div>
                      <b>Type:</b> {selectedChange.changeType}
                    </div>
                    <div>
                      <b>Requested Effective Date:</b>{" "}
                      {formatDate(selectedChange.requestedEffectiveDate)}
                    </div>
                    <div>
                      <b>Actual Effective Date:</b>{" "}
                      {formatDate(selectedChange.actualEffectiveDate)}
                    </div>
                    <div>
                      <b>Requested By:</b> {selectedChange.requestedBy.name}
                    </div>
                    <div>
                      <b>Reviewed By:</b> {selectedChange.reviewedBy?.name ?? "-"}
                    </div>
                    <div>
                      <b>Reason:</b> {selectedChange.reason ?? "-"}
                    </div>
                    <div>
                      <b>Notes:</b> {selectedChange.notes ?? "-"}
                    </div>
                    <div>
                      <b>Supporting Document:</b>{" "}
                      {selectedChange.relatedDocument
                        ? `${selectedChange.relatedDocument.originalFileName} (${selectedChange.relatedDocument.category})`
                        : "-"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="rounded-lg border border-slate-200 p-4">
                    <div className="mb-3 text-xs uppercase tracking-wide text-slate-500">
                      Old Values
                    </div>
                    {renderValues(selectedChange.oldValues, managers)}
                  </div>

                  <div className="rounded-lg border border-slate-200 p-4">
                    <div className="mb-3 text-xs uppercase tracking-wide text-slate-500">
                      New Values
                    </div>
                    {renderValues(selectedChange.newValues, managers)}
                  </div>
                </div>
              </div>

              {canManage ? (
                <div className="flex flex-wrap gap-2">
                  {selectedChange.status === "DRAFT" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setDraft(toDraft(selectedChange))}
                        className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        Edit Draft
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAction("submit", selectedChange.id)}
                        disabled={saving}
                        className="rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        Submit
                      </button>
                    </>
                  ) : null}

                  {selectedChange.status === "PENDING" ? (
                    <button
                      type="button"
                      onClick={() => handleAction("approve", selectedChange.id)}
                      disabled={saving}
                      className="rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      Approve
                    </button>
                  ) : null}

                  {selectedChange.status === "APPROVED" ? (
                    <button
                      type="button"
                      onClick={() => handleAction("apply", selectedChange.id)}
                      disabled={saving}
                      className="rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      Apply
                    </button>
                  ) : null}

                  {selectedChange.status !== "APPLIED" &&
                  selectedChange.status !== "CANCELLED" ? (
                    <button
                      type="button"
                      onClick={() => handleAction("cancel", selectedChange.id)}
                      disabled={saving}
                      className="rounded border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </EmployeeProfileSection>
      ) : null}

      {canManage ? (
        <EmployeeProfileSection
          title={draft.id ? "Edit Draft Change Request" : "Create Change Request"}
          defaultExpanded
        >
          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">Change Type</label>
                <select
                  value={draft.changeType}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      changeType: event.target.value as DraftFormState["changeType"],
                    }))
                  }
                  className="w-full rounded border px-3 py-2"
                >
                  <option value="JOB_INFO">JOB_INFO</option>
                  <option value="COMPENSATION">COMPENSATION</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="STATUS">STATUS</option>
                  <option value="LOCATION">LOCATION</option>
                  <option value="CLASSIFICATION">CLASSIFICATION</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Requested Effective Date
                </label>
                <input
                  type="date"
                  value={draft.requestedEffectiveDate}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      requestedEffectiveDate: event.target.value,
                    }))
                  }
                  className="w-full rounded border px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Title</label>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, title: event.target.value }))
                  }
                  className="w-full rounded border px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Department</label>
                <input
                  type="text"
                  value={draft.department}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      department: event.target.value,
                    }))
                  }
                  className="w-full rounded border px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Manager</label>
                <select
                  value={draft.managerId}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, managerId: event.target.value }))
                  }
                  className="w-full rounded border px-3 py-2"
                >
                  <option value="">No change</option>
                  {managers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.firstName} {manager.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Employment Status</label>
                <select
                  value={draft.status}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, status: event.target.value }))
                  }
                  className="w-full rounded border px-3 py-2"
                >
                  <option value="">No change</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="ON_LEAVE">ON_LEAVE</option>
                  <option value="TERMINATED">TERMINATED</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Employment Classification
                </label>
                <input
                  type="text"
                  value={draft.employmentClassification}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      employmentClassification: event.target.value,
                    }))
                  }
                  className="w-full rounded border px-3 py-2"
                  placeholder="Example: Full-Time"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Work Location</label>
                <input
                  type="text"
                  value={draft.workLocation}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      workLocation: event.target.value,
                    }))
                  }
                  className="w-full rounded border px-3 py-2"
                  placeholder="Example: Dallas Office"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Supporting Document</label>
                <select
                  value={draft.relatedDocumentId}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      relatedDocumentId: event.target.value,
                    }))
                  }
                  className="w-full rounded border px-3 py-2"
                >
                  <option value="">None</option>
                  {documents.map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.originalFileName} ({document.category})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <label className="flex items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={draft.useCompensation}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      useCompensation: event.target.checked,
                    }))
                  }
                />
                Include compensation change
              </label>

              {draft.useCompensation ? (
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium">Pay Type</label>
                    <select
                      value={draft.payType}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          payType: event.target.value as "SALARY" | "HOURLY",
                        }))
                      }
                      className="w-full rounded border px-3 py-2"
                    >
                      <option value="SALARY">SALARY</option>
                      <option value="HOURLY">HOURLY</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Payroll Frequency
                    </label>
                    <select
                      value={draft.payrollFrequency}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          payrollFrequency: event.target.value as DraftFormState["payrollFrequency"],
                        }))
                      }
                      className="w-full rounded border px-3 py-2"
                    >
                      <option value="BIWEEKLY">BIWEEKLY</option>
                      <option value="SEMI_MONTHLY">SEMI_MONTHLY</option>
                      <option value="MONTHLY">MONTHLY</option>
                    </select>
                  </div>

                  {draft.payType === "SALARY" ? (
                    <div>
                      <label className="mb-2 block text-sm font-medium">Annual Salary</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={draft.annualSalary}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            annualSalary: event.target.value,
                          }))
                        }
                        className="w-full rounded border px-3 py-2"
                        required={draft.useCompensation}
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="mb-2 block text-sm font-medium">Hourly Rate</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={draft.hourlyRate}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            hourlyRate: event.target.value,
                          }))
                        }
                        className="w-full rounded border px-3 py-2"
                        required={draft.useCompensation}
                      />
                    </div>
                  )}

                  <div>
                    <label className="mb-2 block text-sm font-medium">Standard Hours</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={draft.standardHours}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          standardHours: event.target.value,
                        }))
                      }
                      className="w-full rounded border px-3 py-2"
                      required={draft.useCompensation}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Compensation Effective Date
                    </label>
                    <input
                      type="date"
                      value={draft.compensationEffectiveDate}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          compensationEffectiveDate: event.target.value,
                        }))
                      }
                      className="w-full rounded border px-3 py-2"
                      required={draft.useCompensation}
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">Reason</label>
                <textarea
                  value={draft.reason}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, reason: event.target.value }))
                  }
                  rows={3}
                  className="w-full rounded border px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Notes</label>
                <textarea
                  value={draft.notes}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, notes: event.target.value }))
                  }
                  rows={3}
                  className="w-full rounded border px-3 py-2"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : draft.id
                    ? "Save Draft Changes"
                    : "Create Draft"}
              </button>

              {draft.id ? (
                <button
                  type="button"
                  onClick={() => setDraft(emptyDraft())}
                  className="rounded border border-slate-300 px-4 py-2.5 hover:bg-slate-50"
                >
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </form>
        </EmployeeProfileSection>
      ) : null}

      {message ? <div className="text-sm text-slate-700">{message}</div> : null}
    </div>
  );
}
