import OnboardingProgressBar from "./onboarding-progress-bar";

export default function OnboardingProgress({
  completedTaskCount,
  totalTaskCount,
  requiredDocumentCount,
  linkedRequiredDocumentCount,
}: {
  completedTaskCount: number;
  totalTaskCount: number;
  requiredDocumentCount: number;
  linkedRequiredDocumentCount: number;
}) {
  const taskCompletionPercentage =
    totalTaskCount > 0
      ? Math.round((completedTaskCount / totalTaskCount) * 100)
      : 0;
  const outstandingRequiredDocumentCount = Math.max(
    0,
    requiredDocumentCount - linkedRequiredDocumentCount
  );

  return (
    <div className="rounded-xl bg-white p-5 shadow sm:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="w-full lg:max-w-2xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-slate-500">
                Task Completion
              </div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">
                {taskCompletionPercentage}%
              </div>
            </div>
            <div className="text-sm text-slate-600">
              {completedTaskCount} of {totalTaskCount} tasks completed
            </div>
          </div>

          <div className="mt-3">
            <OnboardingProgressBar value={taskCompletionPercentage} />
          </div>
        </div>

        <div className="min-w-0 lg:w-72">
          <div className="text-sm font-medium text-slate-500">
            Required Documents
          </div>
          <div className="mt-1 text-sm text-slate-700">
            {requiredDocumentCount === 0 ? (
              "No required documents for this onboarding."
            ) : outstandingRequiredDocumentCount === 0 ? (
              "All required documents are linked."
            ) : (
              <>Required documents outstanding: {outstandingRequiredDocumentCount}</>
            )}
          </div>
          {requiredDocumentCount > 0 && (
            <div className="mt-2 text-sm text-slate-600">
              {linkedRequiredDocumentCount} of {requiredDocumentCount} required
              {" "}documents linked
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
