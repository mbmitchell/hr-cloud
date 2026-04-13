"use client";

import { useEffect, useState } from "react";

type ManagerOption = {
  id: string;
  firstName: string;
  lastName: string;
  department: string | null;
};

type RoleOption = {
  id: string;
  code: string;
  name: string;
};

export default function AddEmployeeClient() {
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loadingSetup, setLoadingSetup] = useState(true);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [hireDate, setHireDate] = useState(new Date().toISOString().split("T")[0]);
  const [managerId, setManagerId] = useState("");

  const [payType, setPayType] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [annualSalary, setAnnualSalary] = useState("");
  const [fte, setFte] = useState("1");
  const [payrollFrequency, setPayrollFrequency] = useState("BIWEEKLY");

  const [selectedRoleCodes, setSelectedRoleCodes] = useState<string[]>(["EMPLOYEE"]);

  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadSetup() {
      try {
        const response = await fetch("/api/admin/employees");
        const data = await response.json();

        if (!response.ok) {
          setMessage(data.error || "Unable to load employee form.");
          return;
        }

        setManagers(data.managers);
        setRoles(data.roles);
      } catch {
        setMessage("Unable to load employee form.");
      } finally {
        setLoadingSetup(false);
      }
    }

    loadSetup();
  }, []);

  function toggleRole(roleCode: string) {
    setSelectedRoleCodes((prev) =>
      prev.includes(roleCode)
        ? prev.filter((code) => code !== roleCode)
        : [...prev, roleCode]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/employees", {
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
          payType: payType || null,
          hourlyRate: payType === "HOURLY" ? hourlyRate : null,
          annualSalary: payType === "SALARY" ? annualSalary : null,
          fte,
          payrollFrequency,
          roleCodes: selectedRoleCodes,
        }),
      });

      const data = await response.json();

     if (!response.ok) {
  setMessage(data.error || "Unable to create employee.");
} else {
  setMessage("Employee created successfully. Redirecting...");

  setTimeout(() => {
    window.location.href = `/employees/${data.employee.id}`;
  }, 500);
}
    } catch {
      setMessage("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }

  if (loadingSetup) {
    return <div className="text-slate-600">Loading employee form...</div>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Add Employee</h2>
        <p className="text-sm text-slate-600 mt-1">
          Create a new employee record and assign initial roles.
        </p>
      </div>

      <div className="bg-white rounded shadow p-4 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Department</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="ON_LEAVE">ON_LEAVE</option>
                <option value="TERMINATED">TERMINATED</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Hire Date</label>
              <input
                type="date"
                value={hireDate}
                onChange={(e) => setHireDate(e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Manager</label>
              <select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">None</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.firstName} {manager.lastName}
                    {manager.department ? ` — ${manager.department}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Payroll Frequency</label>
              <select
                value={payrollFrequency}
                onChange={(e) => setPayrollFrequency(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="BIWEEKLY">BIWEEKLY</option>
                <option value="SEMI_MONTHLY">SEMI_MONTHLY</option>
                <option value="MONTHLY">MONTHLY</option>
              </select>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Compensation</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Pay Type</label>
                <select
                  value={payType}
                  onChange={(e) => setPayType(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">None</option>
                  <option value="HOURLY">Hourly</option>
                  <option value="SALARY">Salary</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">FTE</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={fte}
                  onChange={(e) => setFte(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              {payType === "HOURLY" && (
                <div>
                  <label className="block text-sm font-medium mb-2">Hourly Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                </div>
              )}

              {payType === "SALARY" && (
                <div>
                  <label className="block text-sm font-medium mb-2">Annual Salary</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={annualSalary}
                    onChange={(e) => setAnnualSalary(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                </div>
              )}
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Initial Roles</h3>

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
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-800 disabled:opacity-50 sm:w-auto"
          >
            {saving ? "Creating..." : "Create Employee"}
          </button>

          {message && <div className="text-sm text-slate-700">{message}</div>}
        </form>
      </div>
    </div>
  );
}
