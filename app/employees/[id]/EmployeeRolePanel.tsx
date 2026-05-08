"use client";

import { useState } from "react";

type RoleOption = {
  id: string;
  code: string;
  name: string;
};

export default function EmployeeRolePanel({
  employeeId,
  roles,
  assignedRoleCodes,
  defaultExpanded = false,
}: {
  employeeId: string;
  roles: RoleOption[];
  assignedRoleCodes: string[];
  defaultExpanded?: boolean;
}) {
  const [selectedRoleCodes, setSelectedRoleCodes] = useState<string[]>(assignedRoleCodes);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function toggleRole(roleCode: string) {
    setSelectedRoleCodes((prev) =>
      prev.includes(roleCode)
        ? prev.filter((code) => code !== roleCode)
        : [...prev, roleCode]
    );
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(`/api/employees/${employeeId}/roles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roleCodes: selectedRoleCodes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to update role assignments.");
      } else {
        setMessage("Role assignments updated successfully.");
        setTimeout(() => {
          window.location.reload();
        }, 800);
      }
    } catch {
      setMessage("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow p-4 sm:p-6">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-4 text-left"
        aria-expanded={expanded}
      >
        <h3 className="text-lg font-semibold">Role Assignments</h3>
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
        <>
          <div className="mt-4 space-y-3">
            {roles.map((role) => (
              <label
                key={role.id}
                className="flex items-center gap-3 rounded border p-3 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selectedRoleCodes.includes(role.code)}
                  onChange={() => toggleRole(role.code)}
                />
                <div>
                  <div className="font-medium">{role.name}</div>
                  <div className="text-xs text-slate-500">{role.code}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="mt-5">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-800 disabled:opacity-50 sm:w-auto"
            >
              {saving ? "Saving..." : "Save Roles"}
            </button>
          </div>

          {message && <div className="mt-3 text-sm text-slate-700">{message}</div>}
        </>
      )}
    </div>
  );
}
