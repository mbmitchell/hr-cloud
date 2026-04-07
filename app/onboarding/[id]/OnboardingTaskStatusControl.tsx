"use client";

import { useState } from "react";

type Props = {
  onboardingId: string;
  taskId: string;
  status: string;
  disabled: boolean;
};

export default function OnboardingTaskStatusControl({
  onboardingId,
  taskId,
  status,
  disabled,
}: Props) {
  const [value, setValue] = useState(status);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSave() {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/onboarding/${onboardingId}/tasks/${taskId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: value }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to update task.");
      } else {
        setMessage("Saved.");
        setTimeout(() => {
          window.location.reload();
        }, 300);
      }
    } catch {
      setMessage("Unable to update task.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <select
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={disabled || saving}
        className="rounded border px-3 py-2 text-sm"
      >
        <option value="PENDING">PENDING</option>
        <option value="IN_PROGRESS">IN_PROGRESS</option>
        <option value="COMPLETED">COMPLETED</option>
        <option value="SKIPPED">SKIPPED</option>
      </select>
      <button
        type="button"
        onClick={handleSave}
        disabled={disabled || saving}
        className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save"}
      </button>
      {message && <div className="text-xs text-slate-500">{message}</div>}
    </div>
  );
}
