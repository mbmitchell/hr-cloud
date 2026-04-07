"use client";

import { useState } from "react";

import { EMPLOYEE_DOCUMENT_CATEGORIES } from "../../lib/documents/constants";

const VIEWABLE_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

type DocumentItem = {
  id: string;
  employeeId: string;
  category: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  description: string | null;
  status: string;
  uploadedAt: string;
  uploader: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function formatFileSize(fileSizeBytes: number) {
  if (fileSizeBytes < 1024) {
    return `${fileSizeBytes} B`;
  }

  if (fileSizeBytes < 1024 * 1024) {
    return `${(fileSizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function canViewDocumentInBrowser(mimeType: string) {
  return VIEWABLE_MIME_TYPES.has(mimeType);
}

export default function DocumentList({
  documents,
  canManage = false,
  onChanged,
}: {
  documents: DocumentItem[];
  canManage?: boolean;
  onChanged?: (message: string) => Promise<void> | void;
}) {
  if (documents.length === 0) {
    return (
      <div className="text-sm text-slate-500">
        No documents have been uploaded for this employee.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((document) => (
        <DocumentListItem
          key={document.id}
          document={document}
          canManage={canManage}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}

function DocumentListItem({
  document,
  canManage,
  onChanged,
}: {
  document: DocumentItem;
  canManage: boolean;
  onChanged?: (message: string) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [category, setCategory] = useState(document.category);
  const [description, setDescription] = useState(document.description ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function saveMetadata() {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(`/api/documents/${document.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category,
          description,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to update document.");
        return;
      }

      setEditing(false);
      await onChanged?.("Document updated successfully.");
    } catch {
      setMessage("Unable to update document.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveDocument() {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(`/api/documents/${document.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "ARCHIVED",
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to archive document.");
        return;
      }

      await onChanged?.("Document archived successfully.");
    } catch {
      setMessage("Unable to archive document.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="break-words font-medium text-slate-900">
            {document.originalFileName}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {document.category} • {formatFileSize(document.fileSizeBytes)}
          </div>
          {document.description && !editing && (
            <div className="mt-2 text-sm text-slate-700">
              {document.description}
            </div>
          )}
          <div className="mt-2 text-xs text-slate-500">
            Uploaded by {document.uploader.firstName} {document.uploader.lastName} on{" "}
            {formatDate(document.uploadedAt)}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {canViewDocumentInBrowser(document.mimeType) && (
            <a
              href={`/api/documents/${document.id}/view`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
            >
              View
            </a>
          )}

          <a
            href={`/api/documents/${document.id}/download`}
            className="inline-flex items-center justify-center rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Download
          </a>

          {canManage && (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditing((value) => !value);
                  setMessage("");
                  setCategory(document.category);
                  setDescription(document.description ?? "");
                }}
                className="inline-flex items-center justify-center rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
              >
                {editing ? "Cancel" : "Edit"}
              </button>
              <button
                type="button"
                onClick={archiveDocument}
                disabled={saving}
                className="inline-flex items-center justify-center rounded border border-red-200 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Archive
              </button>
            </>
          )}
        </div>
      </div>

      {editing && canManage && (
        <div className="mt-4 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Category</label>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full rounded border px-3 py-2"
              >
                {EMPLOYEE_DOCUMENT_CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Description</label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-24 w-full rounded border px-3 py-2"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={saveMetadata}
            disabled={saving}
            className="rounded bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}

      {message && <div className="mt-3 text-sm text-slate-700">{message}</div>}
    </div>
  );
}
