import Link from "next/link";

import OnboardingProgress from "../../../components/onboarding/onboarding-progress";
import OnboardingTaskDocumentRequirements from "../../../components/onboarding/onboarding-task-document-requirements";
import { requireOnboardingActor, getOnboardingDetailForActor, canActorUpdateOnboardingTask, isOnboardingAdmin } from "../../../lib/server/onboarding";
import { isAuthorizationError } from "../../../lib/server/authorization";
import OnboardingTaskStatusControl from "./OnboardingTaskStatusControl";

function formatDate(value: Date | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString();
}

export default async function OnboardingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireOnboardingActor();
  const { id } = await params;
  let onboarding;

  try {
    onboarding = await getOnboardingDetailForActor(actor, id);
  } catch (error) {
    if (isAuthorizationError(error)) {
      return <div className="text-red-600">{error.message}</div>;
    }

    throw error;
  }

  if (!onboarding) {
    return <div className="text-red-600">Onboarding record not found.</div>;
  }

  const taskAccess = await Promise.all(
    onboarding.tasks.map(async (task) => ({
      taskId: task.id,
      canEdit: await canActorUpdateOnboardingTask(actor, onboarding.employeeId, task),
    }))
  );

  const taskAccessMap = new Map(
    taskAccess.map((item) => [item.taskId, item.canEdit])
  );
  const canManageDocuments = isOnboardingAdmin(actor);
  const canUploadRequirementDocuments =
    isOnboardingAdmin(actor) || actor.id === onboarding.employeeId;
  const completedTaskCount = onboarding.tasks.filter(
    (task) => task.status === "COMPLETED"
  ).length;
  const totalTaskCount = onboarding.tasks.length;
  const requiredDocumentRequirements = onboarding.tasks.flatMap((task) =>
    task.documentRequirements.filter((requirement) => requirement.isRequired)
  );
  const requiredDocumentCount = requiredDocumentRequirements.length;
  const linkedRequiredDocumentCount = requiredDocumentRequirements.filter(
    (requirement) => Boolean(requirement.linkedEmployeeDocument)
  ).length;

  const groupedTasks = {
    HR: onboarding.tasks.filter((task) => task.assigneeType === "HR"),
    MANAGER: onboarding.tasks.filter((task) => task.assigneeType === "MANAGER"),
    IT: onboarding.tasks.filter((task) => task.assigneeType === "IT"),
    EMPLOYEE: onboarding.tasks.filter((task) => task.assigneeType === "EMPLOYEE"),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {onboarding.employee.firstName} {onboarding.employee.lastName} Onboarding
          </h2>
          <div className="mt-1 text-sm text-slate-600">
            {onboarding.employee.title ?? "No title"}
            {onboarding.employee.department ? ` • ${onboarding.employee.department}` : ""}
          </div>
        </div>

        <Link
          href="/onboarding"
          className="inline-flex items-center justify-center rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          Back to Onboarding
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl bg-white p-4 shadow">
          <div className="text-sm text-slate-500">Status</div>
          <div className="mt-2 text-xl font-semibold text-slate-900">
            {onboarding.status}
          </div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow">
          <div className="text-sm text-slate-500">Template</div>
          <div className="mt-2 text-xl font-semibold text-slate-900">
            {onboarding.template?.name ?? "-"}
          </div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow">
          <div className="text-sm text-slate-500">Completed</div>
          <div className="mt-2 text-xl font-semibold text-slate-900">
            {onboarding.summary.completedCount} / {onboarding.summary.totalCount}
          </div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow">
          <div className="text-sm text-slate-500">Target Completion</div>
          <div className="mt-2 text-xl font-semibold text-slate-900">
            {formatDate(onboarding.targetCompletionDate)}
          </div>
        </div>
      </div>

      <OnboardingProgress
        completedTaskCount={completedTaskCount}
        totalTaskCount={totalTaskCount}
        requiredDocumentCount={requiredDocumentCount}
        linkedRequiredDocumentCount={linkedRequiredDocumentCount}
      />

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

                        {task.documentRequirements.length > 0 && (
                          <OnboardingTaskDocumentRequirements
                            onboardingId={onboarding.id}
                            taskId={task.id}
                            requirements={task.documentRequirements.map((requirement) => ({
                              id: requirement.id,
                              label: requirement.label,
                              documentCategory: requirement.documentCategory,
                              isRequired: requirement.isRequired,
                              linkedAt: requirement.linkedAt
                                ? requirement.linkedAt.toISOString()
                                : null,
                              linkedByEmployeeId: requirement.linkedByEmployeeId,
                              linkedEmployeeDocument: requirement.linkedEmployeeDocument
                                ? {
                                    id: requirement.linkedEmployeeDocument.id,
                                    originalFileName:
                                      requirement.linkedEmployeeDocument.originalFileName,
                                    category: requirement.linkedEmployeeDocument.category,
                                    status: requirement.linkedEmployeeDocument.status,
                                  }
                                : null,
                            }))}
                            availableDocuments={onboarding.activeDocuments.map((document) => ({
                              id: document.id,
                              category: document.category,
                              originalFileName: document.originalFileName,
                            }))}
                            canManage={canManageDocuments}
                            canUpload={canUploadRequirementDocuments}
                          />
                        )}
                      </div>

                      <OnboardingTaskStatusControl
                        onboardingId={onboarding.id}
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
