"use client";

import { useState } from "react";

type EmployeeOption = {
  id: string;
  firstName: string;
  lastName: string;
  department: string | null;
};

export default function DevUserSwitcher({
  employees,
  currentUserId,
}: {
  employees: EmployeeOption[];
  currentUserId: string | null;
}) {
  const [selectedUserId, setSelectedUserId] = useState(currentUserId ?? "");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSwitch() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/dev/switch-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId: selectedUserId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to switch user.");
      } else {
        setMessage("User switched.");
        window.location.reload();
      }
    } catch {
      setMessage("Unable to switch user.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded p-3 space-y-3">
      <div className="text-sm font-medium text-amber-900">
        Dev User Switcher
      </div>

      <select
        value={selectedUserId}
        onChange={(e) => setSelectedUserId(e.target.value)}
        className="w-full border rounded px-3 py-2 bg-white"
      >
        {employees.map((employee) => (
          <option key={employee.id} value={employee.id}>
            {employee.firstName} {employee.lastName}
            {employee.department ? ` — ${employee.department}` : ""}
          </option>
        ))}
      </select>

      <button
        onClick={handleSwitch}
        disabled={loading || !selectedUserId}
        className="bg-amber-700 text-white px-3 py-2 rounded hover:bg-amber-600 disabled:opacity-50"
      >
        {loading ? "Switching..." : "Switch User"}
      </button>

      {message && <div className="text-xs text-amber-800">{message}</div>}
    </div>
  );
}