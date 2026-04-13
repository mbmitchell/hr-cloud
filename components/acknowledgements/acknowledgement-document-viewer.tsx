"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ViewerAssignment = {
  id: string;
  status: string;
  viewedAt: string | null;
  acknowledgedAt: string | null;
  document: {
    title: string;
    category: string;
  };
  version: {
    versionLabel: string;
    employeeDocumentId: string;
    mimeType: string;
    originalFileName: string;
  };
};

function isImageMimeType(mimeType: string) {
  return (
    mimeType === "image/png" ||
    mimeType === "image/jpeg" ||
    mimeType === "image/webp"
  );
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "-";
}

function getViewerStatusSummary(assignment: ViewerAssignment) {
  if (assignment.acknowledgedAt) {
    return {
      label: "Acknowledged",
      detail: `Acknowledged ${formatDate(assignment.acknowledgedAt)}`,
      className: "bg-green-100 text-green-800",
    };
  }

  if (assignment.viewedAt) {
    return {
      label: "Viewed",
      detail: `Viewed ${formatDate(assignment.viewedAt)} • Pending acknowledgement`,
      className: "bg-sky-100 text-sky-800",
    };
  }

  return {
    label: "Assigned",
    detail: "Open and review the document to continue.",
    className: "bg-amber-100 text-amber-800",
  };
}

export default function AcknowledgementDocumentViewer({
  assignment,
}: {
  assignment: ViewerAssignment;
}) {
  const router = useRouter();
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [markingViewed, setMarkingViewed] = useState(!assignment.viewedAt);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (assignment.viewedAt) {
      setMarkingViewed(false);
      return;
    }

    let isMounted = true;

    async function markViewed() {
      try {
        const response = await fetch(
          `/api/acknowledgements/${assignment.id}/view`,
          {
            method: "POST",
          }
        );
        const data = await response.json();

        if (!response.ok && isMounted) {
          setMessage(data.error || "Unable to mark document as viewed.");
        }
      } catch {
        if (isMounted) {
          setMessage("Unable to mark document as viewed.");
        }
      } finally {
        if (isMounted) {
          setMarkingViewed(false);
        }
      }
    }

    void markViewed();

    return () => {
      isMounted = false;
    };
  }, [assignment.id, assignment.viewedAt]);

  async function handleAcknowledge() {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/acknowledgements/${assignment.id}/acknowledge`,
        {
          method: "POST",
        }
      );
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to acknowledge document.");
        return;
      }

      router.push("/my-acknowledgements");
      router.refresh();
    } catch {
      setMessage("Unable to acknowledge document.");
    } finally {
      setSaving(false);
    }
  }

  const viewerUrl = `/api/documents/${assignment.version.employeeDocumentId}/view`;
  const canAcknowledge =
    assignment.status === "PENDING" && !markingViewed && hasScrolledToBottom;
  const statusSummary = getViewerStatusSummary(assignment);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/my-acknowledgements"
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Back to My Acknowledgements
          </Link>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">
            {assignment.document.title}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {assignment.version.versionLabel} • {assignment.document.category}
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-white p-5 shadow sm:p-6">
        <div className="mb-4 flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-slate-700">Acknowledgement Status</div>
            <div className="mt-1 text-xs text-slate-500">{statusSummary.detail}</div>
          </div>
          <span
            className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${statusSummary.className}`}
          >
            {statusSummary.label}
          </span>
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Review Document
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Scroll to the bottom of the document to enable acknowledgement.
          </p>
        </div>

        <div
          className="h-[70vh] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50"
          onScroll={(event) => {
            const target = event.currentTarget;

            if (
              target.scrollTop + target.clientHeight >= target.scrollHeight - 4
            ) {
              setHasScrolledToBottom(true);
            }
          }}
        >
          <div className="min-h-full p-4">
            {isImageMimeType(assignment.version.mimeType) ? (
              <img
                src={viewerUrl}
                alt={assignment.version.originalFileName}
                className="mx-auto h-auto max-w-full rounded border border-slate-200 bg-white"
              />
            ) : (
              <iframe
                src={viewerUrl}
                title={assignment.version.originalFileName}
                className="min-h-[1400px] w-full rounded border-0 bg-white"
              />
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-600">
            {hasScrolledToBottom
              ? "You have reached the bottom of the document."
              : "Please scroll to the bottom of the document to enable acknowledgement."}
          </div>

          <button
            type="button"
            onClick={handleAcknowledge}
            disabled={!canAcknowledge || saving}
            className="rounded bg-slate-900 px-4 py-2.5 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? "Acknowledging..." : "Acknowledge Document"}
          </button>
        </div>

        {markingViewed ? (
          <div className="mt-3 text-xs text-slate-500">
            Recording that you opened this document...
          </div>
        ) : null}

        {message ? (
          <div className="mt-3 text-sm text-red-600">{message}</div>
        ) : null}
      </div>
    </div>
  );
}
