"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ViewDocumentButton({
  assignmentId,
  employeeDocumentId,
  hasViewed,
}: {
  assignmentId: string;
  employeeDocumentId: string;
  hasViewed: boolean;
}) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const [message, setMessage] = useState("");

  async function handleView() {
    setOpening(true);
    setMessage("");

    try {
      if (!hasViewed) {
        const response = await fetch(
          `/api/acknowledgements/${assignmentId}/view`,
          {
            method: "POST",
          }
        );
        const data = await response.json();

        if (!response.ok) {
          setMessage(data.error || "Unable to mark document as reviewed.");
          return;
        }
      }

      window.open(
        `/api/documents/${employeeDocumentId}/view`,
        "_blank",
        "noopener,noreferrer"
      );

      if (!hasViewed) {
        router.refresh();
      }
    } catch {
      setMessage("Unable to open document.");
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleView}
        disabled={opening}
        className="inline-flex items-center justify-center rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
      >
        {opening ? "Opening..." : hasViewed ? "View Document Again" : "View Document"}
      </button>
      {message ? <div className="text-xs text-slate-500">{message}</div> : null}
    </div>
  );
}
