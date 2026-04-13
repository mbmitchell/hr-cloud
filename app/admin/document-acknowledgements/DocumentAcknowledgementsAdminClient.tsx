"use client";

import { useEffect, useRef, useState } from "react";

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
    viewedPending: number;
    acknowledged: number;
    overdue: number;
    completionPercentage: number;
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
  recentReminderHistory?: Array<{
    id: string;
    assignmentId: string;
    employeeName: string;
    versionLabel: string;
    reminderType: string;
    status: string;
    attemptCount: number;
    createdAt: string;
    sentAt: string | null;
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

type Notice = {
  kind: "success" | "error";
  text: string;
} | null;

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

function summarizeReminderError(value: string | null) {
  if (!value) {
    return "No delivery errors recorded.";
  }

  return value.length > 140 ? `${value.slice(0, 137)}...` : value;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US");
}

function getReminderStatusBadgeClass(status: string) {
  switch (status) {
    case "SENT":
      return "bg-green-100 text-green-800";
    case "FAILED":
      return "bg-red-100 text-red-800";
    case "PENDING":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function statusBannerClasses(kind: NonNullable<Notice>["kind"]) {
  return kind === "success"
    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : "border-red-200 bg-red-50 text-red-900";
}

export default function DocumentAcknowledgementsAdminClient() {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [documents, setDocuments] = useState<AssignableDocument[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<string>(
    EMPLOYEE_DOCUMENT_CATEGORIES[0]
  );
  const [newIsActive, setNewIsActive] = useState(true);
  const [savingNew, setSavingNew] = useState(false);
  const [publishDrafts, setPublishDrafts] = useState<Record<string, PublishDraft>>(
    {}
  );
  const [assignmentDrafts, setAssignmentDrafts] = useState<
    Record<string, AssignmentDraft>
  >({});
  const [expandedDocuments, setExpandedDocuments] = useState<
    Record<string, boolean>
  >({});
  const [savingDocuments, setSavingDocuments] = useState<Record<string, boolean>>(
    {}
  );
  const [publishingDocuments, setPublishingDocuments] = useState<
    Record<string, boolean>
  >({});
  const [assigningDocuments, setAssigningDocuments] = useState<
    Record<string, boolean>
  >({});
  const [uploadDragOver, setUploadDragOver] = useState<Record<string, boolean>>(
    {}
  );

  async function loadData() {
    try {
      const response = await fetch("/api/admin/document-acknowledgements");
      const data = await response.json();

      if (!response.ok) {
        setNotice({
          kind: "error",
          text: data.error || "Unable to load document acknowledgements.",
        });
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
          next[document.id] = {
            targetMode: current[document.id]?.targetMode ?? "SINGLE_EMPLOYEE",
            employeeId: current[document.id]?.employeeId ?? data.employees[0]?.id ?? "",
            employeeIds: current[document.id]?.employeeIds ?? [],
            department: current[document.id]?.department ?? "",
            assignableDocumentVersionId:
              current[document.id]?.assignableDocumentVersionId ??
              document.currentVersion?.id ??
              document.versions[0]?.id ??
              "",
            dueDate: current[document.id]?.dueDate ?? "",
          };
        }
        return next;
      });
      setExpandedDocuments((current) => {
        const next = { ...current };
        for (const document of data.documents as AssignableDocument[]) {
          if (typeof next[document.id] === "undefined") {
            next[document.id] = false;
          }
        }
        return next;
      });
    } catch {
      setNotice({
        kind: "error",
        text: "Unable to load document acknowledgements.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function updatePublishDraft(
    documentId: string,
    updates: Partial<PublishDraft>
  ) {
    setPublishDrafts((current) => ({
      ...current,
      [documentId]: {
        ...{
          versionLabel: "",
          notes: "",
          file: null,
        },
        ...current[documentId],
        ...updates,
      },
    }));
  }

  function updateAssignmentDraft(
    documentId: string,
    updates: Partial<AssignmentDraft>
  ) {
    setAssignmentDrafts((current) => ({
      ...current,
      [documentId]: {
        ...{
          targetMode: "SINGLE_EMPLOYEE" as const,
          employeeId: "",
          employeeIds: [],
          department: "",
          assignableDocumentVersionId: "",
          dueDate: "",
        },
        ...current[documentId],
        ...updates,
      },
    }));
  }

  function toggleDocumentExpanded(documentId: string) {
    setExpandedDocuments((current) => ({
      ...current,
      [documentId]: !current[documentId],
    }));
  }

  async function handleCreateDocument(e: React.FormEvent) {
    e.preventDefault();
    setSavingNew(true);
    setNotice(null);

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
        setNotice({
          kind: "error",
          text: data.error || "Unable to create assignable document.",
        });
        return;
      }

      setNewTitle("");
      setNewCategory(EMPLOYEE_DOCUMENT_CATEGORIES[0]);
      setNewIsActive(true);
      setNotice({
        kind: "success",
        text: "Policy document created. Upload a first version to make it assignable.",
      });
      await loadData();
      if (data.document?.id) {
        setExpandedDocuments((current) => ({
          ...current,
          [data.document.id]: true,
        }));
      }
    } catch {
      setNotice({
        kind: "error",
        text: "Unable to create assignable document.",
      });
    } finally {
      setSavingNew(false);
    }
  }

  async function handleSaveDocument(document: AssignableDocument) {
    setNotice(null);
    setSavingDocuments((current) => ({ ...current, [document.id]: true }));

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
        setNotice({
          kind: "error",
          text: data.error || "Unable to update assignable document.",
        });
        return;
      }

      setNotice({
        kind: "success",
        text: `Saved changes for "${document.title}".`,
      });
      await loadData();
    } catch {
      setNotice({
        kind: "error",
        text: "Unable to update assignable document.",
      });
    } finally {
      setSavingDocuments((current) => ({ ...current, [document.id]: false }));
    }
  }

  async function handlePublishVersion(document: AssignableDocument) {
    const draft = publishDrafts[document.id];
    setNotice(null);
    setPublishingDocuments((current) => ({ ...current, [document.id]: true }));

    try {
      const formData = new FormData();
      formData.set("assignableDocumentId", document.id);
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
        setNotice({
          kind: "error",
          text: data.error || "Unable to publish document version.",
        });
        return;
      }

      setNotice({
        kind: "success",
        text: `Version "${draft?.versionLabel || "New version"}" uploaded and published for "${document.title}". It is now ready for assignment.`,
      });
      updatePublishDraft(document.id, {
        versionLabel: "",
        notes: "",
        file: null,
      });
      const fileInput = fileInputRefs.current[document.id];
      if (fileInput) {
        fileInput.value = "";
      }
      await loadData();
      setExpandedDocuments((current) => ({ ...current, [document.id]: true }));
    } catch {
      setNotice({
        kind: "error",
        text: "Unable to publish document version.",
      });
    } finally {
      setPublishingDocuments((current) => ({ ...current, [document.id]: false }));
      setUploadDragOver((current) => ({ ...current, [document.id]: false }));
    }
  }

  async function handleAssign(document: AssignableDocument) {
    const draft = assignmentDrafts[document.id];
    setNotice(null);
    setAssigningDocuments((current) => ({ ...current, [document.id]: true }));

    try {
      const response = await fetch(
        `/api/admin/document-acknowledgements/${document.id}/assignments`,
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
        setNotice({
          kind: "error",
          text: data.error || "Unable to assign document.",
        });
        return;
      }

      if (data.summary) {
        const modeLabel = getAssignmentTargetModeLabel(draft.targetMode);

        if (draft.targetMode === "SINGLE_EMPLOYEE" && data.summary.created === 1) {
          const employeeName =
            employees.find((employee) => employee.id === draft.employeeId)?.name ??
            "the selected employee";
          setNotice({
            kind: "success",
            text: `Assignment sent successfully. "${document.title}" was assigned to ${employeeName}.`,
          });
        } else if (data.summary.created === 0 && data.summary.skipped > 0) {
          setNotice({
            kind: "success",
            text: `${modeLabel} assignment finished. All ${data.summary.attempted} selected target(s) already had this version, so no new assignments were created.`,
          });
        } else {
          setNotice({
            kind: "success",
            text: `${modeLabel} assignment finished. Created ${data.summary.created} assignment(s) and skipped ${data.summary.skipped} duplicate target(s).`,
          });
        }
      } else {
        setNotice({
          kind: "success",
          text: `Assignment sent successfully for "${document.title}".`,
        });
      }

      await loadData();
      setExpandedDocuments((current) => ({ ...current, [document.id]: true }));
    } catch {
      setNotice({
        kind: "error",
        text: "Unable to assign document.",
      });
    } finally {
      setAssigningDocuments((current) => ({ ...current, [document.id]: false }));
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
    return (
      <div className="text-slate-600">Loading document acknowledgements...</div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Document Acknowledgements</h2>
        <p className="mt-1 text-sm text-slate-600">
          Create policy documents, publish private versions, and assign them once
          a usable version is ready.
        </p>
      </div>

      {notice && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${statusBannerClasses(
            notice.kind
          )}`}
        >
          {notice.text}
        </div>
      )}

      <div className="rounded bg-white p-4 shadow sm:p-6">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-slate-900">
            Create Policy Document
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Start with a document record, then upload a published version before
            assignments become available.
          </p>
        </div>

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

      <div className="space-y-4">
        {documents.length === 0 ? (
          <div className="rounded bg-white p-4 text-sm text-slate-500 shadow">
            No policy documents found.
          </div>
        ) : (
          documents.map((document) => {
            const assignmentDraft = assignmentDrafts[document.id];
            const publishDraft = publishDrafts[document.id];
            const hasPublishedVersion = document.versions.length > 0;
            const selectedFileName = publishDraft?.file?.name ?? null;
            const currentVersionLabel =
              document.currentVersion?.versionLabel ?? "No current version";
            const isExpanded = expandedDocuments[document.id] ?? false;

            return (
              <div key={document.id} className="rounded bg-white shadow">
                <button
                  type="button"
                  onClick={() => toggleDocumentExpanded(document.id)}
                  className="flex w-full items-start justify-between gap-4 rounded px-4 py-4 text-left sm:px-6"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900">
                        {document.title}
                      </h3>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {document.category}
                      </span>
                      {!document.isActive && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-500">
                      <span>Current version: {currentVersionLabel}</span>
                      <span>{document.assignmentCounts.total} assignments</span>
                      <span>{document.notificationCounts.failed} failed emails</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-sm font-medium text-slate-600">
                    {isExpanded ? "Hide" : "Manage"}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-200 px-4 py-5 sm:px-6">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-medium">
                            Title
                          </label>
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
                          <label className="mb-2 block text-sm font-medium">
                            Category
                          </label>
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
                          disabled={savingDocuments[document.id]}
                          onClick={() => handleSaveDocument(document)}
                          className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                        >
                          {savingDocuments[document.id] ? "Saving..." : "Save Document"}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
                      <div className="rounded border border-slate-200 px-4 py-3 text-sm">
                        <div className="text-slate-500">Current Version</div>
                        <div className="mt-1 font-semibold text-slate-900">
                          {currentVersionLabel}
                        </div>
                      </div>
                      <div className="rounded border border-slate-200 px-4 py-3 text-sm">
                        <div className="text-slate-500">Assignments</div>
                        <div className="mt-1 font-semibold text-slate-900">
                          {document.assignmentCounts.total}
                        </div>
                      </div>
                      <div className="rounded border border-slate-200 px-4 py-3 text-sm">
                        <div className="text-slate-500">Assigned / Pending</div>
                        <div className="mt-1 font-semibold text-slate-900">
                          {document.assignmentCounts.pending}
                        </div>
                      </div>
                      <div className="rounded border border-slate-200 px-4 py-3 text-sm">
                        <div className="text-slate-500">
                          Viewed / Awaiting Ack
                        </div>
                        <div className="mt-1 font-semibold text-slate-900">
                          {document.assignmentCounts.viewedPending}
                        </div>
                      </div>
                      <div className="rounded border border-slate-200 px-4 py-3 text-sm">
                        <div className="text-slate-500">Acknowledged</div>
                        <div className="mt-1 font-semibold text-slate-900">
                          {document.assignmentCounts.acknowledged}
                        </div>
                      </div>
                      <div className="rounded border border-slate-200 px-4 py-3 text-sm">
                        <div className="text-slate-500">Overdue</div>
                        <div className="mt-1 font-semibold text-slate-900">
                          {document.assignmentCounts.overdue}
                        </div>
                      </div>
                      <div className="rounded border border-slate-200 px-4 py-3 text-sm">
                        <div className="text-slate-500">Completion</div>
                        <div className="mt-1 font-semibold text-slate-900">
                          {document.assignmentCounts.completionPercentage}%
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
                      <div className="font-medium text-amber-900">
                        Failed Assignment Emails: {document.notificationCounts.failed}
                      </div>
                      {document.notificationCounts.failed === 0 ? (
                        <div className="mt-1 text-amber-800/80">
                          No recent assignment email delivery failures for this
                          document.
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
                              Showing the most recent failed notification attempts
                              for this document.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 rounded border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                      <div className="font-medium text-slate-900">
                        Recent Reminder Activity
                      </div>
                      {document.recentReminderHistory &&
                      document.recentReminderHistory.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {document.recentReminderHistory.map((reminder) => (
                            <div
                              key={reminder.id}
                              className="rounded border border-slate-200 bg-white px-3 py-3"
                            >
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <div className="font-medium text-slate-900">
                                    {reminder.employeeName} • {reminder.versionLabel}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    Last reminder:{" "}
                                    {formatDate(reminder.sentAt ?? reminder.createdAt)} •{" "}
                                    {reminder.reminderType}
                                  </div>
                                </div>
                                <span
                                  className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${getReminderStatusBadgeClass(
                                    reminder.status
                                  )}`}
                                >
                                  {reminder.status}
                                </span>
                              </div>

                              <div className="mt-2 text-xs text-slate-600">
                                Attempts: {reminder.attemptCount}
                              </div>

                              {reminder.status === "FAILED" ? (
                                <div className="mt-1 text-xs text-red-700">
                                  Last failure: {summarizeReminderError(reminder.lastError)}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-1 text-slate-600">
                          No reminder history yet for assignments on this document.
                        </div>
                      )}
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
                      <div className="rounded-lg border border-slate-200 p-4">
                        <h4 className="text-base font-semibold">Upload Version</h4>
                        <p className="mt-1 text-sm text-slate-500">
                          Publish a private policy file before assignments become
                          available.
                        </p>

                        <div className="mt-4 space-y-4">
                          <div>
                            <label className="mb-2 block text-sm font-medium">
                              Policy Document
                            </label>
                            <input
                              ref={(element) => {
                                fileInputRefs.current[document.id] = element;
                              }}
                              id={`policy-document-file-${document.id}`}
                              type="file"
                              onChange={(event) =>
                                updatePublishDraft(document.id, {
                                  file: event.target.files?.[0] ?? null,
                                })
                              }
                              className="sr-only"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                fileInputRefs.current[document.id]?.click()
                              }
                              onDragOver={(event) => {
                                event.preventDefault();
                                setUploadDragOver((current) => ({
                                  ...current,
                                  [document.id]: true,
                                }));
                              }}
                              onDragLeave={() =>
                                setUploadDragOver((current) => ({
                                  ...current,
                                  [document.id]: false,
                                }))
                              }
                              onDrop={(event) => {
                                event.preventDefault();
                                setUploadDragOver((current) => ({
                                  ...current,
                                  [document.id]: false,
                                }));
                                updatePublishDraft(document.id, {
                                  file: event.dataTransfer.files?.[0] ?? null,
                                });
                              }}
                              className={`w-full rounded-lg border border-dashed px-4 py-6 text-left transition-colors ${
                                uploadDragOver[document.id]
                                  ? "border-slate-900 bg-slate-100"
                                  : "border-slate-300 bg-slate-50 hover:bg-slate-100"
                              }`}
                            >
                              <div className="text-sm font-medium text-slate-900">
                                Drag and drop a policy file here
                              </div>
                              <div className="mt-1 text-sm text-slate-500">
                                or click to choose a file
                              </div>
                              <div className="mt-3 text-sm text-slate-700">
                                {selectedFileName
                                  ? `Selected: ${selectedFileName}`
                                  : "No file selected"}
                              </div>
                            </button>
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium">
                              Version Label
                            </label>
                            <input
                              type="text"
                              value={publishDraft?.versionLabel ?? ""}
                              onChange={(event) =>
                                updatePublishDraft(document.id, {
                                  versionLabel: event.target.value,
                                })
                              }
                              placeholder="e.g. 2026.1"
                              className="w-full rounded border px-3 py-2"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium">
                              Notes
                            </label>
                            <textarea
                              value={publishDraft?.notes ?? ""}
                              onChange={(event) =>
                                updatePublishDraft(document.id, {
                                  notes: event.target.value,
                                })
                              }
                              placeholder="Optional release notes for this version"
                              className="min-h-24 w-full rounded border px-3 py-2"
                            />
                          </div>

                          <button
                            type="button"
                            disabled={publishingDocuments[document.id]}
                            onClick={() => handlePublishVersion(document)}
                            className="rounded bg-slate-900 px-4 py-2.5 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
                          >
                            {publishingDocuments[document.id]
                              ? "Uploading..."
                              : "Upload and Publish Version"}
                          </button>

                          {publishingDocuments[document.id] && (
                            <div className="space-y-2">
                              <div className="text-sm text-slate-600">
                                Uploading policy document...
                              </div>
                              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                                <div className="h-full w-1/3 animate-pulse rounded-full bg-slate-900" />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="mt-4 space-y-2">
                          <div className="text-sm font-medium text-slate-900">
                            Published Versions
                          </div>
                          {document.versions.length === 0 ? (
                            <div className="text-sm text-slate-500">
                              No versions published yet.
                            </div>
                          ) : (
                            document.versions.map((version) => (
                              <div
                                key={version.id}
                                className="rounded border border-slate-200 px-3 py-2 text-sm"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <div className="font-medium text-slate-900">
                                      {version.versionLabel}
                                    </div>
                                    <div className="text-slate-500">
                                      {version.originalFileName}
                                    </div>
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {formatDate(version.publishedAt)}
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-200 p-4">
                        <h4 className="text-base font-semibold">Assign Version</h4>
                        <p className="mt-1 text-sm text-slate-500">
                          Create one acknowledgement assignment per targeted
                          employee.
                        </p>

                        {!hasPublishedVersion ? (
                          <div className="mt-4 rounded border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                            Upload and publish the first version of this policy
                            document before assignments can be created.
                          </div>
                        ) : (
                          <div className="mt-3 space-y-3">
                            <div>
                              <label className="mb-2 block text-sm font-medium">
                                Target Mode
                              </label>
                              <select
                                value={assignmentDraft?.targetMode ?? "SINGLE_EMPLOYEE"}
                                onChange={(event) =>
                                  updateAssignmentDraft(document.id, {
                                    targetMode: event.target
                                      .value as AssignmentDraft["targetMode"],
                                  })
                                }
                                className="w-full rounded border px-3 py-2"
                              >
                                <option value="SINGLE_EMPLOYEE">
                                  Single Employee
                                </option>
                                <option value="MULTI_SELECT">
                                  Multiple Selected Employees
                                </option>
                                <option value="ALL_ACTIVE">
                                  All Active Employees
                                </option>
                                <option value="DEPARTMENT">By Department</option>
                              </select>
                            </div>

                            {(assignmentDraft?.targetMode ?? "SINGLE_EMPLOYEE") ===
                              "SINGLE_EMPLOYEE" && (
                              <div>
                                <label className="mb-2 block text-sm font-medium">
                                  Employee
                                </label>
                                <select
                                  value={assignmentDraft?.employeeId ?? ""}
                                  onChange={(event) =>
                                    updateAssignmentDraft(document.id, {
                                      employeeId: event.target.value,
                                    })
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

                            {(assignmentDraft?.targetMode ?? "SINGLE_EMPLOYEE") ===
                              "MULTI_SELECT" && (
                              <div>
                                <label className="mb-2 block text-sm font-medium">
                                  Employees
                                </label>
                                <select
                                  multiple
                                  value={assignmentDraft?.employeeIds ?? []}
                                  onChange={(event) =>
                                    updateAssignmentDraft(document.id, {
                                      employeeIds: Array.from(
                                        event.target.selectedOptions
                                      ).map((option) => option.value),
                                    })
                                  }
                                  className="min-h-36 w-full rounded border px-3 py-2"
                                >
                                  {employees.map((employee) => (
                                    <option key={employee.id} value={employee.id}>
                                      {employee.name}
                                      {employee.department
                                        ? ` • ${employee.department}`
                                        : ""}
                                      {employee.status !== "ACTIVE"
                                        ? ` • ${employee.status}`
                                        : ""}
                                    </option>
                                  ))}
                                </select>
                                <div className="mt-1 text-xs text-slate-500">
                                  Hold Command or Control to select multiple
                                  employees.
                                </div>
                              </div>
                            )}

                            {(assignmentDraft?.targetMode ?? "SINGLE_EMPLOYEE") ===
                              "ALL_ACTIVE" && (
                              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                                This will target all employees whose status is
                                <span className="font-medium text-slate-900">
                                  {" "}
                                  ACTIVE
                                </span>
                                .
                              </div>
                            )}

                            {(assignmentDraft?.targetMode ?? "SINGLE_EMPLOYEE") ===
                              "DEPARTMENT" && (
                              <div>
                                <label className="mb-2 block text-sm font-medium">
                                  Department
                                </label>
                                <select
                                  value={assignmentDraft?.department ?? ""}
                                  onChange={(event) =>
                                    updateAssignmentDraft(document.id, {
                                      department: event.target.value,
                                    })
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
                                  Only active employees in the selected department
                                  will be targeted.
                                </div>
                              </div>
                            )}

                            <div>
                              <label className="mb-2 block text-sm font-medium">
                                Version
                              </label>
                              <select
                                value={
                                  assignmentDraft?.assignableDocumentVersionId ?? ""
                                }
                                onChange={(event) =>
                                  updateAssignmentDraft(document.id, {
                                    assignableDocumentVersionId: event.target.value,
                                  })
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
                              <label className="mb-2 block text-sm font-medium">
                                Due Date
                              </label>
                              <input
                                type="date"
                                value={assignmentDraft?.dueDate ?? ""}
                                onChange={(event) =>
                                  updateAssignmentDraft(document.id, {
                                    dueDate: event.target.value,
                                  })
                                }
                                className="w-full rounded border px-3 py-2"
                              />
                            </div>

                            <button
                              type="button"
                              disabled={assigningDocuments[document.id]}
                              onClick={() => handleAssign(document)}
                              className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                            >
                              {assigningDocuments[document.id]
                                ? "Assigning..."
                                : "Assign Version"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
