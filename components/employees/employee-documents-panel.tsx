"use client";

import { useEffect, useState } from "react";

import {
  getStandardEmployeeDocumentCategories,
  isSensitiveEmployeeDocumentCategory,
  SENSITIVE_EMPLOYEE_DOCUMENT_CATEGORIES,
} from "../../lib/documents/constants";
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
  const standardDocuments = documents.filter(
    (document) => !isSensitiveEmployeeDocumentCategory(document.category)
  );
  const sensitiveDocuments = documents.filter((document) =>
    isSensitiveEmployeeDocumentCategory(document.category)
  );

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

          {message && <div className="text-sm text-slate-700">{message}</div>}

          <div className="space-y-4 rounded-lg border border-slate-200 p-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">
                Standard Documents
              </h4>
              <p className="mt-1 text-sm text-slate-500">
                General HR and employee record documents.
              </p>
            </div>

            {canUpload ? (
              <DocumentUploadForm
                employeeId={employeeId}
                categories={getStandardEmployeeDocumentCategories()}
                title="Upload Standard Document"
                onUploaded={async (nextMessage) => {
                  await loadDocuments(nextMessage);
                }}
              />
            ) : null}

            {loading ? (
              <div className="text-sm text-slate-500">Loading documents...</div>
            ) : (
              <DocumentList
                documents={standardDocuments}
                categories={getStandardEmployeeDocumentCategories()}
                canManage={canManage}
                onChanged={async (nextMessage) => {
                  await loadDocuments(nextMessage);
                }}
              />
            )}
          </div>

          <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div>
              <h4 className="text-sm font-semibold text-amber-900">
                Sensitive Payroll / Benefits Documents
              </h4>
              <p className="mt-1 text-sm text-amber-800">
                Restricted HR documents such as direct deposit, tax, and benefit enrollment forms.
              </p>
            </div>

            {canUpload ? (
              <DocumentUploadForm
                employeeId={employeeId}
                categories={SENSITIVE_EMPLOYEE_DOCUMENT_CATEGORIES}
                title="Upload Sensitive Document"
                onUploaded={async (nextMessage) => {
                  await loadDocuments(nextMessage);
                }}
              />
            ) : null}

            {loading ? (
              <div className="text-sm text-amber-800">Loading documents...</div>
            ) : (
              <DocumentList
                documents={sensitiveDocuments}
                categories={SENSITIVE_EMPLOYEE_DOCUMENT_CATEGORIES}
                canManage={canManage}
                onChanged={async (nextMessage) => {
                  await loadDocuments(nextMessage);
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
