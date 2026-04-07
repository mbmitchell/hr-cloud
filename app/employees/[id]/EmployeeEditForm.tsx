"use client";

import { useState } from "react";

type ManagerOption = {
  id: string;
  firstName: string;
  lastName: string;
};

type EmployeeEditFormProps = {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    department: string | null;
    title: string | null;
    status: string;
    hireDate: string;
    managerId: string | null;
  };
  managers: ManagerOption[];
};

export default function EmployeeEditForm({
  employee,
  managers,
}: EmployeeEditFormProps) {
  const [expanded, setExpanded] = useState(false);
  const [firstName, setFirstName] = useState(employee.firstName);
  const [lastName, setLastName] = useState(employee.lastName);
  const [email, setEmail] = useState(employee.email);
  const [department, setDepartment] = useState(employee.department ?? "");
  const [title, setTitle] = useState(employee.title ?? "");
  const [status, setStatus] = useState(employee.status);
  const [hireDate, setHireDate] = useState(employee.hireDate);
  const [managerId, setManagerId] = useState(employee.managerId ?? "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(`/api/employees/${employee.id}/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          department,
          title,
          status,
          hireDate,
          managerId: managerId || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to save employee changes.");
      } else {if (!response.ok) {
  setMessage(data.error || "Unable to save employee changes.");
} else {
  setMessage(
    data.auditWarning
      ? `Saved successfully. ${data.auditWarning}`
      : "Employee information updated successfully."
  );

  setTimeout(() => {
    window.location.reload();
  }, 800);
}
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
        <h3 className="text-lg font-semibold">Edit Employee</h3>
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
        <form onSubmit={handleSubmit} className="mt-4 space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded border px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded border px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded border px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Department</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full rounded border px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded border px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded border px-3 py-2"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="TERMINATED">TERMINATED</option>
                <option value="ON_LEAVE">ON_LEAVE</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Hire Date</label>
              <input
                type="date"
                value={hireDate}
                onChange={(e) => setHireDate(e.target.value)}
                className="w-full rounded border px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Manager</label>
              <select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                className="w-full rounded border px-3 py-2"
              >
                <option value="">None</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.firstName} {manager.lastName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-800 disabled:opacity-50 sm:w-auto"
          >
            {saving ? "Saving..." : "Save Employee Changes"}
          </button>

          {message && <div className="text-sm text-slate-700">{message}</div>}
        </form>
      )}
    </div>
  );
}
