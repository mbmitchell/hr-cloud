"use client";

import { useEffect, useState } from "react";

import { EMPLOYEE_DOCUMENT_CATEGORIES } from "../../../lib/documents/constants";

type Version = {
  id: string;
  versionLabel: string;
  publishedAt: string;
  employeeDocumentId: string;
  originalFileName: string;
};

type AssignableDocument = {
  id: string;
  title: string;
  category: string;
  isActive: boolean;
  currentVersion: {
    id: string;
    versionLabel: string;
    publishedAt: string;
  } | null;
  assignmentCounts: {
    total: number;
    pending: number;
    acknowledged: number;
  };
  notificationCounts: {
    failed: number;
  };
  recentFailedNotifications?: Array<{
    id: string;
    employeeName: string;
    versionLabel: string;
    createdAt: string;
    lastError: string | null;
  }>;
  versions: Version[];
};

type EmployeeOption = {
  id: string;
  name: string;
  department: string | null;
  status: string;
};

type PublishDraft = {
  versionLabel: string;
  notes: string;
  file: File | null;
};

type AssignmentDraft = {
  targetMode: "SINGLE_EMPLOYEE" | "MULTI_SELECT" | "ALL_ACTIVE" | "DEPARTMENT";
  employeeId: string;
  employeeIds: string[];
  department: string;
  assignableDocumentVersionId: string;
  dueDate: string;
};

function getAssignmentTargetModeLabel(
  targetMode: AssignmentDraft["targetMode"]
) {
  switch (targetMode) {
    case "SINGLE_EMPLOYEE":
      return "Single Employee";
    case "MULTI_SELECT":
      return "Multiple Selected Employees";
    case "ALL_ACTIVE":
      return "All Active Employees";
    case "DEPARTMENT":
      return "By Department";
    default:
      return targetMode;
  }
}

function summarizeNotificationError(value: string | null) {
  if (!value) {
    return "Email delivery failed.";
  }

  return value.length > 120 ? `${value.slice(0, 117)}...` : value;
}

export default function DocumentAcknowledgementsAdminClient() {
  const [documents, setDocuments] = useState<AssignableDocument[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<string>(
    EMPLOYEE_DOCUMENT_CATEGORIES[0]
  );
  const [newIsActive, setNewIsActive] = useState(true);
  const [savingNew, setSavingNew] = useState(false);
  const [publishDrafts, setPublishDrafts] = useState<Record<string, PublishDraft>>({});
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, AssignmentDraft>>({});

  async function loadData() {
    try {
      const response = await fetch("/api/admin/document-acknowledgements");
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to load document acknowledgements.");
        return;
      }

      setDocuments(data.documents);
      setEmployees(data.employees);
      setPublishDrafts((current) => {
        const next = { ...current };
        for (const document of data.documents as AssignableDocument[]) {
          if (!next[document.id]) {
            next[document.id] = {
              versionLabel: "",
              notes: "",
              file: null,
            };
          }
        }
        return next;
      });
      setAssignmentDrafts((current) => {
        const next = { ...current };
        for (const document of data.documents as AssignableDocument[]) {
          if (!next[document.id]) {
            next[document.id] = {
              targetMode: "SINGLE_EMPLOYEE",
              employeeId: data.employees[0]?.id ?? "",
              employeeIds: [],
              department: "",
              assignableDocumentVersionId:
                document.currentVersion?.id ?? document.versions[0]?.id ?? "",
              dueDate: "",
            };
          }
        }
        return next;
      });
    } catch {
      setMessage("Unable to load document acknowledgements.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreateDocument(e: React.FormEvent) {
    e.preventDefault();
    setSavingNew(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/document-acknowledgements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: newTitle,
          category: newCategory,
          isActive: newIsActive,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to create assignable document.");
        return;
      }

      setNewTitle("");
      setNewCategory(EMPLOYEE_DOCUMENT_CATEGORIES[0]);
      setNewIsActive(true);
      setMessage("Assignable document created successfully.");
      await loadData();
    } catch {
      setMessage("Unable to create assignable document.");
    } finally {
      setSavingNew(false);
    }
  }

  async function handleSaveDocument(document: AssignableDocument) {
    setMessage("");
    try {
      const response = await fetch(
        `/api/admin/document-acknowledgements/${document.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: document.title,
            category: document.category,
            isActive: document.isActive,
          }),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to update assignable document.");
        return;
      }

      setMessage("Assignable document updated successfully.");
      await loadData();
    } catch {
      setMessage("Unable to update assignable document.");
    }
  }

  async function handlePublishVersion(documentId: string) {
    const draft = publishDrafts[documentId];
    setMessage("");

    try {
      const formData = new FormData();
      formData.set("assignableDocumentId", documentId);
      formData.set("versionLabel", draft?.versionLabel ?? "");
      formData.set("notes", draft?.notes ?? "");

      if (draft?.file) {
        formData.set("file", draft.file);
      }

      const response = await fetch("/api/admin/document-acknowledgements/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to publish document version.");
        return;
      }

      setMessage("Document version published successfully.");
      setPublishDrafts((current) => ({
        ...current,
        [documentId]: {
          versionLabel: "",
          notes: "",
          file: null,
        },
      }));
      await loadData();
    } catch {
      setMessage("Unable to publish document version.");
    }
  }

  async function handleAssign(documentId: string) {
    const draft = assignmentDrafts[documentId];
    setMessage("");

    try {
      const response = await fetch(
        `/api/admin/document-acknowledgements/${documentId}/assignments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            targetMode: draft.targetMode,
            employeeId: draft.employeeId,
            employeeIds: draft.employeeIds,
            department: draft.department,
            assignableDocumentVersionId: draft.assignableDocumentVersionId,
            dueDate: draft.dueDate,
          }),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to assign document.");
        return;
      }

      if (data.summary) {
        const modeLabel = getAssignmentTargetModeLabel(draft.targetMode);

        if (data.summary.created === 0 && data.summary.skipped > 0) {
          setMessage(
            `${modeLabel} assignment complete. All ${data.summary.attempted} target(s) were already assigned and were skipped.`
          );
        } else {
          setMessage(
            `${modeLabel} assignment complete. Attempted ${data.summary.attempted}, created ${data.summary.created}, skipped ${data.summary.skipped}.`
          );
        }
      } else {
        setMessage("Document assigned successfully.");
      }
      await loadData();
    } catch {
      setMessage("Unable to assign document.");
    }
  }

  const departments = Array.from(
    new Set(
      employees
        .map((employee) => employee.department)
        .filter((department): department is string => Boolean(department))
    )
  ).sort((a, b) => a.localeCompare(b));

  if (loading) {
    return <div className="text-slate-600">Loading document acknowledgements...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Document Acknowledgements</h2>
        <p className="mt-1 text-sm text-slate-600">
          Manage policy documents, upload private versions, and assign acknowledgements.
        </p>
      </div>

      <div className="rounded bg-white p-4 shadow sm:p-6">
        <form
          onSubmit={handleCreateDocument}
          className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px_auto_auto]"
        >
          <input
            type="text"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="New policy document title"
            className="w-full rounded border px-3 py-2"
          />
          <select
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
            className="w-full rounded border px-3 py-2"
          >
            {EMPLOYEE_DOCUMENT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
              {category}
            </option>
          ))}
          </select>
          <label className="inline-flex items-center gap-2 rounded border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={newIsActive}
              onChange={(event) => setNewIsActive(event.target.checked)}
            />
            Active
          </label>
          <button
            type="submit"
            disabled={savingNew}
            className="rounded bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {savingNew ? "Creating..." : "Create"}
          </button>
        </form>
      </div>

      {message && <div className="text-sm text-slate-700">{message}</div>}

      <div className="space-y-4">
        {documents.length === 0 ? (
          <div className="rounded bg-white p-4 text-sm text-slate-500 shadow">
            No policy documents found.
          </div>
        ) : (
          documents.map((document) => {
            return (
              <div key={document.id} className="rounded bg-white p-4 shadow sm:p-6">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium">Title</label>
                      <input
                        type="text"
                        value={document.title}
                        onChange={(event) =>
                          setDocuments((current) =>
                            current.map((item) =>
                              item.id === document.id
                                ? { ...item, title: event.target.value }
                                : item
                            )
                          )
                        }
                        className="w-full rounded border px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium">Category</label>
                      <select
                        value={document.category}
                        onChange={(event) =>
                          setDocuments((current) =>
                            current.map((item) =>
                              item.id === document.id
                                ? { ...item, category: event.target.value }
                                : item
                            )
                          )
                        }
                        className="w-full rounded border px-3 py-2"
                      >
                        {EMPLOYEE_DOCUMENT_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={document.isActive}
                          onChange={(event) =>
                            setDocuments((current) =>
                              current.map((item) =>
                                item.id === document.id
                                  ? { ...item, isActive: event.target.checked }
                                  : item
                              )
                            )
                          }
                        />
                        Active document
                      </label>
                    </div>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => handleSaveDocument(document)}
                      className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                    >
                      Save Document
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <div className="rounded border border-slate-200 px-4 py-3 text-sm">
                    <div className="text-slate-500">Current Version</div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {document.currentVersion?.versionLabel ?? "-"}
                    </div>
                  </div>
                  <div className="rounded border border-slate-200 px-4 py-3 text-sm">
                    <div className="text-slate-500">Assignments</div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {document.assignmentCounts.total}
                    </div>
                  </div>
                  <div className="rounded border border-slate-200 px-4 py-3 text-sm">
                    <div className="text-slate-500">Pending</div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {document.assignmentCounts.pending}
                    </div>
                  </div>
                  <div className="rounded border border-slate-200 px-4 py-3 text-sm">
                    <div className="text-slate-500">Acknowledged</div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {document.assignmentCounts.acknowledged}
                    </div>
                  </div>
                </div>

                <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
                  <div className="font-medium text-amber-900">
                    Failed Assignment Emails: {document.notificationCounts.failed}
                  </div>
                  {document.notificationCounts.failed === 0 ? (
                    <div className="mt-1 text-amber-800/80">
                      No recent assignment email delivery failures for this document.
                    </div>
                  ) : (
                    <div className="mt-2 space-y-2 text-amber-900">
                      {(document.recentFailedNotifications ?? []).map((failure) => (
                        <div
                          key={failure.id}
                          className="rounded border border-amber-200 bg-white px-3 py-2"
                        >
                          <div className="font-medium">
                            {failure.employeeName} • {failure.versionLabel}
                          </div>
                          <div className="mt-1 text-xs text-amber-800">
                            {summarizeNotificationError(failure.lastError)}
                          </div>
                        </div>
                      ))}
                      {document.notificationCounts.failed >
                        (document.recentFailedNotifications?.length ?? 0) && (
                        <div className="text-xs text-amber-800">
                          Showing the most recent failed notification attempts for
                          this document.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 p-4">
                    <h3 className="text-base font-semibold">Publish Version</h3>
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="mb-2 block text-sm font-medium">
                          Policy Document File
                        </label>
                        <input
                          type="file"
                          onChange={(event) =>
                            setPublishDrafts((current) => ({
                              ...current,
                              [document.id]: {
                                ...(current[document.id] ?? {
                                  versionLabel: "",
                                  notes: "",
                                  file: null,
                                }),
                                file: event.target.files?.[0] ?? null,
                              },
                            }))
                          }
                          className="w-full rounded border px-3 py-2"
                        />
                        <div className="mt-1 text-xs text-slate-500">
                          Upload policy documents here. They are stored privately and
                          are not sourced from employee document records.
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium">Version Label</label>
                        <input
                          type="text"
                          value={publishDrafts[document.id]?.versionLabel ?? ""}
                          onChange={(event) =>
                            setPublishDrafts((current) => ({
                              ...current,
                              [document.id]: {
                                ...(current[document.id] ?? {
                                  versionLabel: "",
                                  notes: "",
                                  file: null,
                                }),
                                versionLabel: event.target.value,
                              },
                            }))
                          }
                          placeholder="e.g. 2026.1"
                          className="w-full rounded border px-3 py-2"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium">Notes</label>
                        <textarea
                          value={publishDrafts[document.id]?.notes ?? ""}
                          onChange={(event) =>
                            setPublishDrafts((current) => ({
                              ...current,
                              [document.id]: {
                                ...(current[document.id] ?? {
                                  versionLabel: "",
                                  notes: "",
                                  file: null,
                                }),
                                notes: event.target.value,
                              },
                            }))
                          }
                          className="min-h-20 w-full rounded border px-3 py-2"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handlePublishVersion(document.id)}
                        className="rounded bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
                      >
                        Upload and Publish Version
                      </button>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="text-sm font-medium text-slate-900">Versions</div>
                      {document.versions.length === 0 ? (
                        <div className="text-sm text-slate-500">No versions published yet.</div>
                      ) : (
                        document.versions.map((version) => (
                          <div
                            key={version.id}
                            className="rounded border border-slate-200 px-3 py-2 text-sm"
                          >
                            <div className="font-medium text-slate-900">
                              {version.versionLabel}
                            </div>
                            <div className="text-slate-500">
                              {version.originalFileName}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-4">
                    <h3 className="text-base font-semibold">Assign Version</h3>
                    <div className="mt-1 text-sm text-slate-500">
                      Assign one version to one or more employees. Each target
                      employee still receives an individual acknowledgement
                      assignment record.
                    </div>
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="mb-2 block text-sm font-medium">
                          Target Mode
                        </label>
                        <select
                          value={assignmentDrafts[document.id]?.targetMode ?? "SINGLE_EMPLOYEE"}
                          onChange={(event) =>
                            setAssignmentDrafts((current) => ({
                              ...current,
                              [document.id]: {
                                ...(current[document.id] ?? {
                                  targetMode: "SINGLE_EMPLOYEE",
                                  employeeId: "",
                                  employeeIds: [],
                                  department: "",
                                  assignableDocumentVersionId: "",
                                  dueDate: "",
                                }),
                                targetMode: event.target
                                  .value as AssignmentDraft["targetMode"],
                              },
                            }))
                          }
                          className="w-full rounded border px-3 py-2"
                        >
                          <option value="SINGLE_EMPLOYEE">Single Employee</option>
                          <option value="MULTI_SELECT">Multiple Selected Employees</option>
                          <option value="ALL_ACTIVE">All Active Employees</option>
                          <option value="DEPARTMENT">By Department</option>
                        </select>
                      </div>

                      {(assignmentDrafts[document.id]?.targetMode ?? "SINGLE_EMPLOYEE") ===
                        "SINGLE_EMPLOYEE" && (
                      <div>
                        <label className="mb-2 block text-sm font-medium">Employee</label>
                        <select
                          value={assignmentDrafts[document.id]?.employeeId ?? ""}
                          onChange={(event) =>
                            setAssignmentDrafts((current) => ({
                              ...current,
                              [document.id]: {
                                ...(current[document.id] ?? {
                                  targetMode: "SINGLE_EMPLOYEE",
                                  employeeId: "",
                                  employeeIds: [],
                                  department: "",
                                  assignableDocumentVersionId: "",
                                  dueDate: "",
                                }),
                                employeeId: event.target.value,
                              },
                            }))
                          }
                          className="w-full rounded border px-3 py-2"
                        >
                          <option value="">Select an employee</option>
                          {employees.map((employee) => (
                            <option key={employee.id} value={employee.id}>
                              {employee.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      )}

                      {(assignmentDrafts[document.id]?.targetMode ?? "SINGLE_EMPLOYEE") ===
                        "MULTI_SELECT" && (
                        <div>
                          <label className="mb-2 block text-sm font-medium">
                            Employees
                          </label>
                          <select
                            multiple
                            value={assignmentDrafts[document.id]?.employeeIds ?? []}
                            onChange={(event) =>
                              setAssignmentDrafts((current) => ({
                                ...current,
                                [document.id]: {
                                  ...(current[document.id] ?? {
                                    targetMode: "SINGLE_EMPLOYEE",
                                    employeeId: "",
                                    employeeIds: [],
                                    department: "",
                                    assignableDocumentVersionId: "",
                                    dueDate: "",
                                  }),
                                  employeeIds: Array.from(
                                    event.target.selectedOptions
                                  ).map((option) => option.value),
                                },
                              }))
                            }
                            className="min-h-36 w-full rounded border px-3 py-2"
                          >
                            {employees.map((employee) => (
                              <option key={employee.id} value={employee.id}>
                                {employee.name}
                                {employee.department ? ` • ${employee.department}` : ""}
                                {employee.status !== "ACTIVE"
                                  ? ` • ${employee.status}`
                                  : ""}
                              </option>
                            ))}
                          </select>
                          <div className="mt-1 text-xs text-slate-500">
                            Hold Command or Control to select multiple employees.
                          </div>
                        </div>
                      )}

                      {(assignmentDrafts[document.id]?.targetMode ?? "SINGLE_EMPLOYEE") ===
                        "ALL_ACTIVE" && (
                        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                          This will target all employees whose status is
                          <span className="font-medium text-slate-900"> ACTIVE</span>.
                        </div>
                      )}

                      {(assignmentDrafts[document.id]?.targetMode ?? "SINGLE_EMPLOYEE") ===
                        "DEPARTMENT" && (
                        <div>
                          <label className="mb-2 block text-sm font-medium">
                            Department
                          </label>
                          <select
                            value={assignmentDrafts[document.id]?.department ?? ""}
                            onChange={(event) =>
                              setAssignmentDrafts((current) => ({
                                ...current,
                                [document.id]: {
                                  ...(current[document.id] ?? {
                                    targetMode: "SINGLE_EMPLOYEE",
                                    employeeId: "",
                                    employeeIds: [],
                                    department: "",
                                    assignableDocumentVersionId: "",
                                    dueDate: "",
                                  }),
                                  department: event.target.value,
                                },
                              }))
                            }
                            className="w-full rounded border px-3 py-2"
                          >
                            <option value="">Select a department</option>
                            {departments.map((department) => (
                              <option key={department} value={department}>
                                {department}
                              </option>
                            ))}
                          </select>
                          <div className="mt-1 text-xs text-slate-500">
                            Only active employees in the selected department will
                            be targeted.
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="mb-2 block text-sm font-medium">Version</label>
                        <select
                          value={assignmentDrafts[document.id]?.assignableDocumentVersionId ?? ""}
                          onChange={(event) =>
                            setAssignmentDrafts((current) => ({
                              ...current,
                              [document.id]: {
                                ...(current[document.id] ?? {
                                  targetMode: "SINGLE_EMPLOYEE",
                                  employeeId: "",
                                  employeeIds: [],
                                  department: "",
                                  assignableDocumentVersionId: "",
                                  dueDate: "",
                                }),
                                assignableDocumentVersionId: event.target.value,
                              },
                            }))
                          }
                          className="w-full rounded border px-3 py-2"
                        >
                          <option value="">Select a version</option>
                          {document.versions.map((version) => (
                            <option key={version.id} value={version.id}>
                              {version.versionLabel}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium">Due Date</label>
                        <input
                          type="date"
                          value={assignmentDrafts[document.id]?.dueDate ?? ""}
                          onChange={(event) =>
                            setAssignmentDrafts((current) => ({
                              ...current,
                              [document.id]: {
                                ...(current[document.id] ?? {
                                  targetMode: "SINGLE_EMPLOYEE",
                                  employeeId: "",
                                  employeeIds: [],
                                  department: "",
                                  assignableDocumentVersionId: "",
                                  dueDate: "",
                                }),
                                dueDate: event.target.value,
                              },
                            }))
                          }
                          className="w-full rounded border px-3 py-2"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAssign(document.id)}
                        className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                      >
                        Assign to Employee
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
