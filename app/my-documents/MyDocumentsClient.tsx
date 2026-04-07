"use client";

import { useEffect, useState } from "react";

import DocumentList from "../../components/employees/document-list";

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

export default function MyDocumentsClient({
  employeeId,
}: {
  employeeId: string;
}) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDocuments() {
      try {
        const response = await fetch(`/api/employees/${employeeId}/documents`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Unable to load your documents.");
          return;
        }

        setDocuments(data.documents);
      } catch {
        setError("Unable to load your documents.");
      } finally {
        setLoading(false);
      }
    }

    loadDocuments();
  }, [employeeId]);

  if (loading) {
    return (
      <div className="rounded-xl bg-white p-5 text-sm text-slate-600 shadow sm:p-6">
        Loading your documents...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-white p-5 text-sm text-red-600 shadow sm:p-6">
        {error}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow sm:p-6">
      <DocumentList documents={documents} />
    </div>
  );
}
