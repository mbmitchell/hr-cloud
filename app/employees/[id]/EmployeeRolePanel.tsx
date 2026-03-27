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
}: {
  employeeId: string;
  roles: RoleOption[];
  assignedRoleCodes: string[];
}) {
  const [selectedRoleCodes, setSelectedRoleCodes] = useState<string[]>(assignedRoleCodes);
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
    <div className="bg-white rounded shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Role Assignments</h3>

      <div className="space-y-3">
        {roles.map((role) => (
          <label
            key={role.id}
            className="flex items-center gap-3 border rounded p-3 hover:bg-slate-50"
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
          className="bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Roles"}
        </button>
      </div>

      {message && <div className="text-sm text-slate-700 mt-3">{message}</div>}
    </div>
  );
}