"use client";

import { useRef, useState } from "react";

type Requirement = {
  id: string;
  label: string;
  documentCategory: string;
  isRequired: boolean;
  linkedAt: string | null;
  linkedByEmployeeId: string | null;
  linkedEmployeeDocument: {
    id: string;
    originalFileName: string;
    category: string;
    status: string;
  } | null;
};

type DocumentOption = {
  id: string;
  category: string;
  originalFileName: string;
};

export default function OnboardingTaskDocumentRequirements({
  onboardingId,
  taskId,
  requirements,
  availableDocuments,
  canManage,
  canUpload,
}: {
  onboardingId: string;
  taskId: string;
  requirements: Requirement[];
  availableDocuments: DocumentOption[];
  canManage: boolean;
  canUpload: boolean;
}) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [selectedDocuments, setSelectedDocuments] = useState<Record<string, string>>({});
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File | null>>({});
  const [message, setMessage] = useState("");
  const [savingRequirementId, setSavingRequirementId] = useState<string | null>(null);
  const [dragOverRequirementId, setDragOverRequirementId] = useState<string | null>(null);

  async function handleLink(requirementId: string) {
    const employeeDocumentId = selectedDocuments[requirementId];

    if (!employeeDocumentId) {
      setMessage("Please choose a document to link.");
      return;
    }

    setSavingRequirementId(requirementId);
    setMessage("");

    try {
      const response = await fetch(
        `/api/onboarding/${onboardingId}/tasks/${taskId}/documents/${requirementId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            employeeDocumentId,
          }),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to link required document.");
        return;
      }

      window.location.reload();
    } catch {
      setMessage("Unable to link required document.");
    } finally {
      setSavingRequirementId(null);
    }
  }

  async function handleUpload(requirementId: string) {
    const file = selectedFiles[requirementId];

    if (!file) {
      setMessage("Please choose a document to upload.");
      return;
    }

    setSavingRequirementId(requirementId);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `/api/onboarding/${onboardingId}/tasks/${taskId}/documents/${requirementId}/upload`,
        {
          method: "POST",
          body: formData,
        }
      );
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to upload required document.");
        return;
      }

      window.location.reload();
    } catch {
      setMessage("Unable to upload required document.");
    } finally {
      setSavingRequirementId(null);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-semibold text-slate-900">Required Documents</div>

      <div className="mt-3 space-y-3">
        {requirements.map((requirement) => {
          const matchingDocuments = availableDocuments.filter(
            (document) => document.category === requirement.documentCategory
          );
          const linked = requirement.linkedEmployeeDocument;

          return (
            <div
              key={requirement.id}
              className="rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="font-medium text-slate-900">
                    {requirement.label}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {requirement.documentCategory}
                    {requirement.isRequired ? " • Required" : " • Optional"}
                  </div>
                </div>

                <div className="text-sm">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      linked
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {linked ? "Linked" : "Missing"}
                  </span>
                </div>
              </div>

              <div className="mt-2 text-sm text-slate-700">
                {linked ? (
                  <span>Linked document: {linked.originalFileName}</span>
                ) : (
                  <span>No document linked.</span>
                )}
              </div>

              {canManage && (
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="w-full sm:max-w-md">
                    <label className="mb-2 block text-sm font-medium">Link Existing Document</label>
                    <select
                      value={selectedDocuments[requirement.id] ?? ""}
                      onChange={(event) =>
                        setSelectedDocuments((current) => ({
                          ...current,
                          [requirement.id]: event.target.value,
                        }))
                      }
                      className="w-full rounded border px-3 py-2"
                    >
                      <option value="">Select a document</option>
                      {matchingDocuments.map((document) => (
                        <option key={document.id} value={document.id}>
                          {document.originalFileName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleLink(requirement.id)}
                    disabled={savingRequirementId === requirement.id || matchingDocuments.length === 0}
                    className="rounded bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {savingRequirementId === requirement.id ? "Linking..." : "Link Document"}
                  </button>
                </div>
              )}

              {!linked && canUpload && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-sm font-medium text-slate-900">
                    Upload Required Document
                  </div>

                  <input
                    ref={(element) => {
                      fileInputRefs.current[requirement.id] = element;
                    }}
                    type="file"
                    className="sr-only"
                    onChange={(event) =>
                      setSelectedFiles((current) => ({
                        ...current,
                        [requirement.id]: event.target.files?.[0] ?? null,
                      }))
                    }
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[requirement.id]?.click()}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragOverRequirementId(requirement.id);
                    }}
                    onDragLeave={() => setDragOverRequirementId((current) =>
                      current === requirement.id ? null : current
                    )}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragOverRequirementId(null);
                      const file = event.dataTransfer.files?.[0] ?? null;
                      setSelectedFiles((current) => ({
                        ...current,
                        [requirement.id]: file,
                      }));
                    }}
                    className={`mt-3 w-full rounded-lg border border-dashed px-4 py-5 text-left transition-colors ${
                      dragOverRequirementId === requirement.id
                        ? "border-slate-900 bg-slate-100"
                        : "border-slate-300 bg-white hover:bg-slate-100"
                    }`}
                  >
                    <div className="text-sm font-medium text-slate-900">
                      Drag and drop a {requirement.documentCategory} document here
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      or click to choose a file
                    </div>
                    <div className="mt-3 text-sm text-slate-700">
                      {selectedFiles[requirement.id]
                        ? `Selected: ${selectedFiles[requirement.id]?.name}`
                        : "No file selected"}
                    </div>
                  </button>

                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => handleUpload(requirement.id)}
                      disabled={
                        savingRequirementId === requirement.id ||
                        !selectedFiles[requirement.id]
                      }
                      className="rounded bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {savingRequirementId === requirement.id
                        ? "Uploading..."
                        : "Upload Document"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {message && <div className="mt-3 text-sm text-slate-700">{message}</div>}
    </div>
  );
}
