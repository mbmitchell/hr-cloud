"use client";

import { useEffect, useState } from "react";

import DocumentList from "./document-list";
import DocumentUploadForm from "./document-upload-form";

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

export default function EmployeeDocumentsPanel({
  employeeId,
  canUpload,
  canManage = false,
  defaultExpanded = false,
}: {
  employeeId: string;
  canUpload: boolean;
  canManage?: boolean;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadDocuments(nextMessage?: string) {
    setLoading(true);

    try {
      const response = await fetch(`/api/employees/${employeeId}/documents`);
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to load employee documents.");
        return;
      }

      setDocuments(data.documents);
      setMessage(nextMessage ?? "");
    } catch {
      setMessage("Unable to load employee documents.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!expanded) {
      return;
    }

    loadDocuments();
  }, [employeeId, expanded]);

  return (
    <div className="rounded-xl bg-white p-5 shadow sm:p-6">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-4 text-left"
        aria-expanded={expanded}
      >
        <h3 className="text-lg font-semibold">Documents</h3>
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
        <div className="mt-4 space-y-5">
          <p className="text-sm text-slate-600">
            View and manage employee-linked documents securely.
          </p>

          {canUpload && (
            <DocumentUploadForm
              employeeId={employeeId}
              onUploaded={async (nextMessage) => {
                await loadDocuments(nextMessage);
              }}
            />
          )}

          {message && <div className="text-sm text-slate-700">{message}</div>}

          {loading ? (
            <div className="text-sm text-slate-500">Loading documents...</div>
          ) : (
            <DocumentList
              documents={documents}
              canManage={canManage}
              onChanged={async (nextMessage) => {
                await loadDocuments(nextMessage);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
