import Link from "next/link";

import {
  canAccessOffboardingQueue,
  isOffboardingAdmin,
  requireOffboardingActor,
} from "../../lib/server/offboarding/offboarding-access";
import { getOffboardingQueue } from "../../lib/server/offboarding/offboarding-queries";

type SearchParams = Promise<{
  status?: string;
  separationType?: string;
  employee?: string;
}>;

function formatDate(value: Date | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString();
}

export default async function OffboardingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const actor = await requireOffboardingActor();

  if (!canAccessOffboardingQueue(actor)) {
    return (
      <div className="text-red-600">
        You do not have permission to view offboarding records.
      </div>
    );
  }

  const params = await searchParams;
  const statusFilter = String(params.status ?? "").trim();
  const separationTypeFilter = String(params.separationType ?? "").trim();
  const employeeFilter = String(params.employee ?? "").trim().toLowerCase();

  const offboardingRecords = await getOffboardingQueue(actor);
  const filtered = offboardingRecords.filter((record) => {
    const employeeName =
      `${record.employee.firstName} ${record.employee.lastName}`.toLowerCase();

    const matchesStatus = !statusFilter || record.status === statusFilter;
    const matchesSeparationType =
      !separationTypeFilter || record.separationType === separationTypeFilter;
    const matchesEmployee =
      !employeeFilter || employeeName.includes(employeeFilter);

    return matchesStatus && matchesSeparationType && matchesEmployee;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Offboarding</h2>
          <p className="mt-1 text-sm text-slate-600">
            Review separation workflows and outstanding offboarding tasks.
          </p>
        </div>

        {isOffboardingAdmin(actor) && (
          <Link
            href="/admin/offboarding/templates"
            className="inline-flex items-center justify-center rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Manage Templates
          </Link>
        )}
      </div>

      <div className="rounded bg-white p-4 shadow">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium">Employee</label>
            <input
              type="text"
              name="employee"
              defaultValue={employeeFilter}
              placeholder="Search employee name"
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Status</label>
            <select
              name="status"
              defaultValue={statusFilter}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">All</option>
              <option value="NOT_STARTED">NOT_STARTED</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Separation Type
            </label>
            <select
              name="separationType"
              defaultValue={separationTypeFilter}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">All</option>
              <option value="VOLUNTARY">VOLUNTARY</option>
              <option value="INVOLUNTARY">INVOLUNTARY</option>
              <option value="RETIREMENT">RETIREMENT</option>
              <option value="END_OF_CONTRACT">END_OF_CONTRACT</option>
              <option value="OTHER">OTHER</option>
            </select>
          </div>

          <div className="md:col-span-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              className="rounded bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-800"
            >
              Apply Filters
            </button>
            <Link
              href="/offboarding"
              className="inline-flex items-center justify-center rounded border border-slate-300 px-4 py-2.5 hover:bg-slate-50"
            >
              Clear
            </Link>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="rounded bg-white p-4 text-sm text-slate-500 shadow">
            No offboarding records matched your filters.
          </div>
        ) : (
          filtered.map((record) => (
            <div key={record.id} className="rounded bg-white p-4 shadow sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-lg font-semibold text-slate-900">
                    {record.employee.firstName} {record.employee.lastName}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {record.employee.title ?? "No title"}
                    {record.employee.department
                      ? ` • ${record.employee.department}`
                      : ""}
                  </div>
                </div>

                <div className="flex flex-col gap-2 text-sm text-slate-600">
                  <div>
                    Status:{" "}
                    <span className="font-medium text-slate-900">
                      {record.status}
                    </span>
                  </div>
                  <div>
                    Separation Type:{" "}
                    <span className="font-medium text-slate-900">
                      {record.separationType}
                    </span>
                  </div>
                  <div>
                    Termination Date:{" "}
                    <span className="font-medium text-slate-900">
                      {formatDate(record.terminationDate)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded border border-slate-200 px-4 py-3 text-sm">
                  <div className="text-slate-500">Total Tasks</div>
                  <div className="mt-1 text-xl font-semibold text-slate-900">
                    {record.progress.totalTasks}
                  </div>
                </div>
                <div className="rounded border border-slate-200 px-4 py-3 text-sm">
                  <div className="text-slate-500">Completed</div>
                  <div className="mt-1 text-xl font-semibold text-slate-900">
                    {record.progress.completedTasks}
                  </div>
                </div>
                <div className="rounded border border-slate-200 px-4 py-3 text-sm">
                  <div className="text-slate-500">Progress</div>
                  <div className="mt-1 text-xl font-semibold text-slate-900">
                    {record.progress.completionPercentage}%
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <Link
                  href={`/offboarding/${record.id}`}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  View offboarding record
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
