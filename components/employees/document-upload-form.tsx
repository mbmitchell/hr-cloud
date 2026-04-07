"use client";

import { useRef, useState } from "react";

import { EMPLOYEE_DOCUMENT_CATEGORIES } from "../../lib/documents/constants";

export default function DocumentUploadForm({
  employeeId,
  onUploaded,
}: {
  employeeId: string;
  onUploaded: (message: string) => Promise<void> | void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>(EMPLOYEE_DOCUMENT_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  function updateSelectedFile(nextFile: File | null) {
    setFile(nextFile);
  }

  function handleDrop(event: React.DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragOver(false);

    const droppedFile = event.dataTransfer.files?.[0] ?? null;
    updateSelectedFile(droppedFile);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!file) {
      setMessage("Please choose a document to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    if (description.trim()) {
      formData.append("description", description.trim());
    }

    setSaving(true);

    try {
      const response = await fetch(`/api/employees/${employeeId}/documents`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to upload document.");
        return;
      }

      setFile(null);
      setCategory(EMPLOYEE_DOCUMENT_CATEGORIES[0]);
      setDescription("");
      const fileInput = fileInputRef.current;
      if (fileInput) {
        fileInput.value = "";
      }
      await onUploaded("Document uploaded successfully.");
    } catch {
      setMessage("Unable to upload document.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium">Document</label>
          <input
            ref={fileInputRef}
            id={`document-file-${employeeId}`}
            type="file"
            onChange={(event) => updateSelectedFile(event.target.files?.[0] ?? null)}
            className="sr-only"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`w-full rounded-lg border border-dashed px-4 py-6 text-left transition-colors ${
              isDragOver
                ? "border-slate-900 bg-slate-100"
                : "border-slate-300 bg-slate-50 hover:bg-slate-100"
            }`}
          >
            <div className="text-sm font-medium text-slate-900">
              Drag and drop a document here
            </div>
            <div className="mt-1 text-sm text-slate-500">
              or click to choose a file
            </div>
            <div className="mt-3 text-sm text-slate-700">
              {file ? `Selected: ${file.name}` : "No file selected"}
            </div>
          </button>
        </div>

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
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Description</label>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="min-h-24 w-full rounded border px-3 py-2"
          placeholder="Optional document description"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={saving || !file}
          className="rounded bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? "Uploading..." : "Upload Document"}
        </button>

        {message && <div className="text-sm text-slate-700">{message}</div>}
      </div>

      {saving && (
        <div className="space-y-2">
          <div className="text-sm text-slate-600">
            Uploading document...
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-slate-900" />
          </div>
        </div>
      )}
    </form>
  );
}
