"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AcknowledgeButton({
  assignmentId,
  enabled,
}: {
  assignmentId: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleAcknowledge() {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/acknowledgements/${assignmentId}/acknowledge`,
        {
          method: "POST",
        }
      );
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to acknowledge document.");
        return;
      }

      setMessage("Acknowledged.");
      router.refresh();
    } catch {
      setMessage("Unable to acknowledge document.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={handleAcknowledge}
        disabled={saving || !enabled}
        className="rounded bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {saving ? "Acknowledging..." : "Acknowledge Document"}
      </button>
      {message && <div className="text-xs text-slate-500">{message}</div>}
    </div>
  );
}
