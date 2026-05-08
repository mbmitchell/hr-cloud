import Link from "next/link";
import { getCurrentUser } from "../../lib/auth/current-user";
import { getEmployeeRoles } from "../../lib/auth/permissions";
import { getEmployeeDirectoryEmployees } from "../../lib/server/employees/employee-queries";

import { auth } from "../../auth"; // adjust path as needed
import { redirect } from "next/navigation";



type SearchParams = Promise<{
  search?: string;
  department?: string;
  manager?: string;
}>;

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();

if (!session?.user) {
  redirect("/login");
}
  const params = await searchParams;
  const search = (params.search ?? "").trim().toLowerCase();
  const departmentFilter = (params.department ?? "").trim();
  const managerFilter = (params.manager ?? "").trim();

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return <div className="text-red-600">No current user found.</div>;
  }

  const roles = await getEmployeeRoles(currentUser.id);

  const isAdmin =
    roles.includes("SITE_ADMIN") ||
    roles.includes("HR_ADMIN") ||
    roles.includes("EXECUTIVE_READONLY") ||
    roles.includes("AUDITOR");

    const canAddEmployees =
    roles.includes("SITE_ADMIN") || roles.includes("HR_ADMIN");

  const visibleEmployees = await getEmployeeDirectoryEmployees(currentUser.id);

  const departments = Array.from(
    new Set(
      visibleEmployees
        .map((employee) => employee.department)
        .filter(Boolean)
    )
  ).sort() as string[];

  const managers = Array.from(
    new Map(
      visibleEmployees
        .filter((employee) => employee.manager)
        .map((employee) => [
          employee.manager!.id,
          {
            id: employee.manager!.id,
            name: `${employee.manager!.firstName} ${employee.manager!.lastName}`,
          },
        ])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const filteredEmployees = visibleEmployees.filter((employee) => {
    const fullName = `${employee.firstName} ${employee.lastName}`.toLowerCase();
    const title = (employee.title ?? "").toLowerCase();
    const email = employee.email.toLowerCase();

    const matchesSearch =
      !search ||
      fullName.includes(search) ||
      title.includes(search) ||
      email.includes(search);

    const matchesDepartment =
      !departmentFilter || employee.department === departmentFilter;

    const matchesManager =
      !managerFilter || employee.managerId === managerFilter;

    return matchesSearch && matchesDepartment && matchesManager;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Employees</h2>
          <p className="text-sm text-slate-600 mt-1">
            Search, filter, and review employee PTO information.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          {canAddEmployees && (
            <Link
              href="/admin/employees/new"
              className="inline-flex w-full items-center justify-center rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 sm:w-auto"
            >
              Add Employee
            </Link>
          )}

          <a
            href="/api/employees/export"
            className="inline-flex w-full items-center justify-center rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 sm:w-auto"
          >
            Export CSV
          </a>
        </div>
      </div>

      <div className="bg-white rounded shadow p-4">
        <form className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2">Search</label>
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Name, title, or email"
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Department</label>
            <select
              name="department"
              defaultValue={departmentFilter}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">All</option>
              {departments.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Manager</label>
            <select
              name="manager"
              defaultValue={managerFilter}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">All</option>
              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              className="w-full rounded bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-800 sm:w-auto"
            >
              Apply Filters
            </button>

            <Link
              href="/employees"
              className="inline-flex w-full items-center justify-center rounded border border-slate-300 px-4 py-2.5 hover:bg-slate-50 sm:w-auto"
            >
              Clear
            </Link>
          </div>
        </form>
      </div>

      <div className="hidden overflow-hidden rounded bg-white shadow md:block">
        <table className="w-full">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Department</th>
              <th className="p-3">Title</th>
              <th className="p-3">Manager</th>
              <th className="p-3">PTO Balance</th>
              <th className="p-3">COMP Balance</th>
              <th className="p-3"></th>
            </tr>
          </thead>

          <tbody>
            {filteredEmployees.map((employee) => {
              const ptoBalance =
                employee.ledger.find((l) => l.bucket === "PTO")?.balance ?? 0;

              const compBalance =
                employee.ledger.find((l) => l.bucket === "COMP")?.balance ?? 0;

              return (
                <tr key={employee.id} className="border-t">
                  <td className="p-3">
                    <div className="font-medium">
                      {employee.firstName} {employee.lastName}
                    </div>
                    <div className="text-xs text-slate-500">{employee.email}</div>
                  </td>

                  <td className="p-3">{employee.department ?? "-"}</td>

                  <td className="p-3">{employee.title ?? "-"}</td>

                  <td className="p-3">
                    {employee.manager
                      ? `${employee.manager.firstName} ${employee.manager.lastName}`
                      : "-"}
                  </td>

                  <td className="p-3">{ptoBalance.toFixed(2)}</td>

                  <td className="p-3">{compBalance.toFixed(2)}</td>

                  <td className="p-3">
                    <Link
                      href={`/employees/${employee.id}`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      View Profile
                    </Link>
                  </td>
                </tr>
              );
            })}

            {filteredEmployees.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-sm text-slate-500">
                  No employees matched your search or filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-4 md:hidden">
        {filteredEmployees.length === 0 ? (
          <div className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow">
            No employees matched your search or filters.
          </div>
        ) : (
          filteredEmployees.map((employee) => {
            const ptoBalance =
              employee.ledger.find((l) => l.bucket === "PTO")?.balance ?? 0;

            const compBalance =
              employee.ledger.find((l) => l.bucket === "COMP")?.balance ?? 0;

            return (
              <div key={employee.id} className="rounded-xl bg-white p-4 shadow">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-slate-900">
                      {employee.firstName} {employee.lastName}
                    </div>
                    <div className="break-words text-sm text-slate-500">
                      {employee.email}
                    </div>
                  </div>
                  <Link
                    href={`/employees/${employee.id}`}
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    View
                  </Link>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-slate-500">Department</div>
                    <div className="font-medium text-slate-900">
                      {employee.department ?? "-"}
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-500">Title</div>
                    <div className="font-medium text-slate-900">
                      {employee.title ?? "-"}
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-500">PTO Balance</div>
                    <div className="font-medium text-slate-900">
                      {ptoBalance.toFixed(2)}
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-500">COMP Balance</div>
                    <div className="font-medium text-slate-900">
                      {compBalance.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-sm">
                  <div className="text-slate-500">Manager</div>
                  <div className="font-medium text-slate-900">
                    {employee.manager
                      ? `${employee.manager.firstName} ${employee.manager.lastName}`
                      : "-"}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
