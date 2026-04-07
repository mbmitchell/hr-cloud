import Link from "next/link";

import { requireOnboardingActor, listVisibleOnboardings, isOnboardingAdmin } from "../../lib/server/onboarding";

type SearchParams = Promise<{
  status?: string;
  assigneeType?: string;
  employee?: string;
}>;

function formatDate(value: Date | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString();
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const actor = await requireOnboardingActor();
  const params = await searchParams;
  const statusFilter = String(params.status ?? "").trim();
  const assigneeTypeFilter = String(params.assigneeType ?? "").trim();
  const employeeFilter = String(params.employee ?? "").trim().toLowerCase();

  const onboardingRecords = await listVisibleOnboardings(actor);
  const filtered = onboardingRecords.filter((record) => {
    const employeeName =
      `${record.employee.firstName} ${record.employee.lastName}`.toLowerCase();

    const matchesStatus =
      !statusFilter || record.status === statusFilter;

    const matchesAssigneeType =
      !assigneeTypeFilter ||
      record.tasks.some((task) => task.assigneeType === assigneeTypeFilter);

    const matchesEmployee =
      !employeeFilter ||
      employeeName.includes(employeeFilter);

    return matchesStatus && matchesAssigneeType && matchesEmployee;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Onboarding</h2>
          <p className="mt-1 text-sm text-slate-600">
            Review onboarding progress and task ownership across new employee checklists.
          </p>
        </div>

        {isOnboardingAdmin(actor) && (
          <Link
            href="/admin/onboarding/templates"
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
            <label className="mb-2 block text-sm font-medium">Assignee Type</label>
            <select
              name="assigneeType"
              defaultValue={assigneeTypeFilter}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">All</option>
              <option value="HR">HR</option>
              <option value="MANAGER">MANAGER</option>
              <option value="IT">IT</option>
              <option value="EMPLOYEE">EMPLOYEE</option>
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
              href="/onboarding"
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
            No onboarding records matched your filters.
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
                    {record.employee.department ? ` • ${record.employee.department}` : ""}
                  </div>
                </div>

                <div className="flex flex-col gap-2 text-sm text-slate-600">
                  <div>Status: <span className="font-medium text-slate-900">{record.status}</span></div>
                  <div>Template: <span className="font-medium text-slate-900">{record.template?.name ?? "-"}</span></div>
                  <div>Next Due: <span className="font-medium text-slate-900">{formatDate(record.summary.nextDueDate)}</span></div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded border border-slate-200 px-4 py-3 text-sm">
                  <div className="text-slate-500">Total Tasks</div>
                  <div className="mt-1 text-xl font-semibold text-slate-900">
                    {record.summary.totalCount}
                  </div>
                </div>
                <div className="rounded border border-slate-200 px-4 py-3 text-sm">
                  <div className="text-slate-500">Completed</div>
                  <div className="mt-1 text-xl font-semibold text-slate-900">
                    {record.summary.completedCount}
                  </div>
                </div>
                <div className="rounded border border-slate-200 px-4 py-3 text-sm">
                  <div className="text-slate-500">Pending</div>
                  <div className="mt-1 text-xl font-semibold text-slate-900">
                    {record.summary.pendingCount}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <Link
                  href={`/onboarding/${record.id}`}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  View onboarding record
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
