import EmployeeProfileSection from "./EmployeeProfileSection";

type AcknowledgementSummary = {
  total: number;
  pending: number;
  acknowledged: number;
  overdue: number;
};

export default function EmployeeAcknowledgementsSummaryPanel({
  summary,
  defaultExpanded = false,
}: {
  summary: AcknowledgementSummary;
  defaultExpanded?: boolean;
}) {
  const hasAssignments = summary.total > 0;

  return (
    <EmployeeProfileSection title="Acknowledgements" defaultExpanded={defaultExpanded}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Summary of assigned policy and acknowledgement documents for this
          employee.
        </p>

        {hasAssignments ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded border border-slate-200 px-4 py-3 text-sm">
              <div className="text-slate-500">Pending</div>
              <div className="mt-1 font-semibold text-slate-900">
                {summary.pending}
              </div>
            </div>

            <div className="rounded border border-slate-200 px-4 py-3 text-sm">
              <div className="text-slate-500">Acknowledged</div>
              <div className="mt-1 font-semibold text-slate-900">
                {summary.acknowledged}
              </div>
            </div>

            <div className="rounded border border-slate-200 px-4 py-3 text-sm">
              <div className="text-slate-500">Overdue</div>
              <div className="mt-1 font-semibold text-slate-900">
                {summary.overdue}
              </div>
            </div>

            <div className="rounded border border-slate-200 px-4 py-3 text-sm">
              <div className="text-slate-500">Total Assigned</div>
              <div className="mt-1 font-semibold text-slate-900">
                {summary.total}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            No acknowledgement assignments have been issued for this employee yet.
          </div>
        )}

        <div className="text-sm text-slate-500">
          Employees review and complete acknowledgement items from their{" "}
          <span className="font-medium text-slate-700">My Acknowledgements</span>{" "}
          page.
        </div>
      </div>
    </EmployeeProfileSection>
  );
}
