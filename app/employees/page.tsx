import Link from "next/link";
import { prisma } from "../../lib/db";
import { getCurrentUser } from "../../lib/auth/current-user";
import { getEmployeeRoles, isManagerOf } from "../../lib/auth/permissions";

import { auth } from "../../auth"; // adjust path as needed
import { redirect } from "next/navigation";

const session = await auth();

if (!session?.user) {
  redirect("/login");
}

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

  const isManager = roles.includes("MANAGER");

    const canAddEmployees =
    roles.includes("SITE_ADMIN") || roles.includes("HR_ADMIN");

  const employees = await prisma.employee.findMany({
    include: {
      manager: true,
      ledger: {
        orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const visibleEmployees = [];

  for (const employee of employees) {
    if (isAdmin || employee.id === currentUser.id) {
      visibleEmployees.push(employee);
      continue;
    }

    if (isManager) {
      const manages = await isManagerOf(currentUser.id, employee.id);
      if (manages) {
        visibleEmployees.push(employee);
      }
    }
  }

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
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Employee Directory</h2>
          <p className="text-sm text-slate-600 mt-1">
            Search, filter, and review employee PTO information.
          </p>
        </div>

        {canAddEmployees && (
          <Link
            href="/admin/employees/new"
            className="border border-slate-300 px-4 py-2 rounded hover:bg-slate-50 text-sm"
          >
            Add Employee
          </Link>
        )}
      </div>

  <a
    href="/api/employees/export"
    className="border border-slate-300 px-4 py-2 rounded hover:bg-slate-50 text-sm"
  >
    Export CSV
  </a>
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

          <div className="md:col-span-4 flex gap-3">
            <button
              type="submit"
              className="bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-800"
            >
              Apply Filters
            </button>

            <Link
              href="/employees"
              className="border border-slate-300 px-4 py-2 rounded hover:bg-slate-50"
            >
              Clear
            </Link>
          </div>
        </form>
      </div>

      <div className="bg-white rounded shadow overflow-hidden">
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
    </div>
  );
}