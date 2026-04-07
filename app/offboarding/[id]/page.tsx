import Link from "next/link";

import OffboardingProgress from "../../../components/offboarding/offboarding-progress";
import OffboardingTaskStatusControl from "../../../components/offboarding/offboarding-task-status-control";
import {
  canUpdateOffboardingTask,
  requireOffboardingActor,
} from "../../../lib/server/offboarding/offboarding-access";
import { getOffboardingById } from "../../../lib/server/offboarding/offboarding-queries";
import { isAuthorizationError } from "../../../lib/server/authorization";

function formatDate(value: Date | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString();
}

function formatBoolean(value: boolean | null) {
  if (value == null) {
    return "-";
  }

  return value ? "Yes" : "No";
}

export default async function OffboardingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireOffboardingActor();
  const { id } = await params;
  let offboarding;

  try {
    offboarding = await getOffboardingById(actor, id);
  } catch (error) {
    if (isAuthorizationError(error)) {
      return <div className="text-red-600">{error.message}</div>;
    }

    throw error;
  }

  if (!offboarding) {
    return <div className="text-red-600">Offboarding record not found.</div>;
  }

  const taskAccess = await Promise.all(
    offboarding.tasks.map(async (task) => ({
      taskId: task.id,
      canEdit: await canUpdateOffboardingTask(actor, offboarding.employeeId, task),
    }))
  );

  const taskAccessMap = new Map(
    taskAccess.map((item) => [item.taskId, item.canEdit])
  );

  const groupedTasks = {
    HR: offboarding.tasks.filter((task) => task.assigneeType === "HR"),
    MANAGER: offboarding.tasks.filter((task) => task.assigneeType === "MANAGER"),
    IT: offboarding.tasks.filter((task) => task.assigneeType === "IT"),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {offboarding.employee.firstName} {offboarding.employee.lastName} Offboarding
          </h2>
          <div className="mt-1 text-sm text-slate-600">
            {offboarding.employee.title ?? "No title"}
            {offboarding.employee.department
              ? ` • ${offboarding.employee.department}`
              : ""}
          </div>
        </div>

        <Link
          href="/offboarding"
          className="inline-flex items-center justify-center rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          Back to Offboarding
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl bg-white p-4 shadow">
          <div className="text-sm text-slate-500">Status</div>
          <div className="mt-2 text-xl font-semibold text-slate-900">
            {offboarding.status}
          </div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow">
          <div className="text-sm text-slate-500">Separation Type</div>
          <div className="mt-2 text-xl font-semibold text-slate-900">
            {offboarding.separationType}
          </div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow">
          <div className="text-sm text-slate-500">Termination Date</div>
          <div className="mt-2 text-xl font-semibold text-slate-900">
            {formatDate(offboarding.terminationDate)}
          </div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow">
          <div className="text-sm text-slate-500">Last Working Date</div>
          <div className="mt-2 text-xl font-semibold text-slate-900">
            {formatDate(offboarding.lastWorkingDate)}
          </div>
        </div>
      </div>

      <OffboardingProgress
        totalTasks={offboarding.progress.totalTasks}
        completedTasks={offboarding.progress.completedTasks}
        completionPercentage={offboarding.progress.completionPercentage}
      />

      <div className="rounded-xl bg-white p-5 shadow sm:p-6">
        <h3 className="text-lg font-semibold">Offboarding Details</h3>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div>
            <div className="text-sm text-slate-500">Employee</div>
            <div className="mt-1 font-medium text-slate-900">
              {offboarding.employee.firstName} {offboarding.employee.lastName}
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Template</div>
            <div className="mt-1 font-medium text-slate-900">
              {offboarding.template?.name ?? "-"}
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Eligible For Rehire</div>
            <div className="mt-1 font-medium text-slate-900">
              {formatBoolean(offboarding.eligibleForRehire)}
            </div>
          </div>
          <div className="sm:col-span-2 xl:col-span-3">
            <div className="text-sm text-slate-500">Notes</div>
            <div className="mt-1 whitespace-pre-wrap text-sm text-slate-900">
              {offboarding.notes?.trim() || "-"}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {Object.entries(groupedTasks).map(([assigneeType, tasks]) => (
          <div key={assigneeType} className="rounded-xl bg-white p-5 shadow sm:p-6">
            <h3 className="text-lg font-semibold">{assigneeType} Tasks</h3>

            <div className="mt-4 space-y-4">
              {tasks.length === 0 ? (
                <div className="text-sm text-slate-500">No tasks assigned.</div>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-lg border border-slate-200 px-4 py-3"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="font-medium text-slate-900">
                          {task.title}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          Due: {formatDate(task.dueDate)} • Status: {task.status}
                        </div>
                        {task.description && (
                          <div className="mt-2 text-sm text-slate-700">
                            {task.description}
                          </div>
                        )}
                      </div>

                      <OffboardingTaskStatusControl
                        offboardingId={offboarding.id}
                        taskId={task.id}
                        status={task.status}
                        disabled={!taskAccessMap.get(task.id)}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
