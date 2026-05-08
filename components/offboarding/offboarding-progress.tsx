export default function OffboardingProgress({
  totalTasks,
  completedTasks,
  completionPercentage,
}: {
  totalTasks: number;
  completedTasks: number;
  completionPercentage: number;
}) {
  return (
    <div className="rounded-xl bg-white p-5 shadow sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="w-full lg:max-w-2xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-slate-500">
                Task Completion
              </div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">
                {completionPercentage}%
              </div>
            </div>
            <div className="text-sm text-slate-600">
              {completedTasks} of {totalTasks} tasks completed
            </div>
          </div>

          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-slate-900 transition-[width]"
              style={{ width: `${Math.max(0, Math.min(100, completionPercentage))}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
