import EmployeeProfileSection from "./EmployeeProfileSection";
import { formatDateOnlyForDisplay } from "../../../lib/date-only";
import type { AccrualSummary } from "../../../lib/pto/accrual";

function formatDate(value: Date | string) {
  return formatDateOnlyForDisplay(value);
}

export default function EmployeePtoTab({
  currentPtoBalance,
  currentCompBalance,
  accrualSummary,
  monthlyAccrualOverride,
  accrualOverrideReason,
  advancedAccrualTier,
  advancedAccrualEffectiveDate,
  advancedAccrualReason,
  visibleRequests,
}: {
  currentPtoBalance: number;
  currentCompBalance: number;
  accrualSummary: AccrualSummary;
  monthlyAccrualOverride: number | null;
  accrualOverrideReason: string | null;
  advancedAccrualTier: string | null;
  advancedAccrualEffectiveDate: Date | null;
  advancedAccrualReason: string | null;
  visibleRequests: Array<{
    id: string;
    createdAt: Date;
    leaveType: string;
    startDate: Date;
    endDate: Date;
    hours: number;
    status: string;
    notes: string | null;
    approvalComment: string | null;
  }>;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-xl bg-white p-4 shadow sm:p-5">
          <div className="text-sm text-slate-500">PTO Balance</div>
          <div className="mt-2 text-3xl font-semibold">
            {currentPtoBalance.toFixed(2)}
          </div>
          <div className="mt-1 text-sm text-slate-500">hours</div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow sm:p-5">
          <div className="text-sm text-slate-500">COMP Balance</div>
          <div className="mt-2 text-3xl font-semibold">
            {currentCompBalance.toFixed(2)}
          </div>
          <div className="mt-1 text-sm text-slate-500">hours</div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow sm:p-5">
          <div className="text-sm text-slate-500">Monthly Accrual Rate</div>
          <div className="mt-2 text-3xl font-semibold">
            {accrualSummary.currentMonthlyRate.toFixed(2)}
          </div>
          <div className="mt-1 text-sm text-slate-500">hours / month</div>
        </div>
      </div>

      <EmployeeProfileSection title="Accrual Settings" defaultExpanded>
        <div className="space-y-2 text-sm">
          <div>
            <b>Accrual Mode:</b> {accrualSummary.mode}
          </div>
          <div>
            <b>Current Monthly Rate:</b> {accrualSummary.currentMonthlyRate.toFixed(2)} hours
          </div>
          <div>
            <b>Current Tier:</b> {accrualSummary.activeTier ?? "Manual only"}
          </div>
          <div>
            <b>Rate Source:</b> {accrualSummary.source}
          </div>
          <div>
            <b>Advanced Tier:</b> {advancedAccrualTier ?? "None"}
          </div>
          <div>
            <b>Advanced Effective Date:</b>{" "}
            {advancedAccrualEffectiveDate ? formatDate(advancedAccrualEffectiveDate) : "-"}
          </div>
          <div>
            <b>Advanced Reason:</b> {advancedAccrualReason ?? "-"}
          </div>
          <div>
            <b>Manual Override:</b>{" "}
            {monthlyAccrualOverride != null
              ? `${monthlyAccrualOverride.toFixed(2)} hours/month`
              : "None"}
          </div>
          <div>
            <b>Manual Override Reason:</b> {accrualOverrideReason ?? "-"}
          </div>
          <div>
            <b>Next Tier:</b>{" "}
            {accrualSummary.nextTier
              ? `${accrualSummary.nextTier.tier} on ${new Date(
                  accrualSummary.nextTier.effectiveDate
                ).toLocaleDateString()} (${accrualSummary.nextTier.monthlyRate.toFixed(
                  2
                )} hours/month)`
              : "No further automatic tier changes"}
          </div>
          <div>
            <b>Rollover Cap:</b> 80.00 hours
          </div>
          <div>
            <b>PTO/SICK Bucket:</b> PTO
          </div>
          <div>
            <b>COMP Bucket:</b> COMP
          </div>
        </div>
      </EmployeeProfileSection>

      <EmployeeProfileSection
        title="Recent Requests"
        defaultExpanded
        className="overflow-hidden px-0 pb-0 pt-5 sm:px-0 sm:pb-0 sm:pt-6"
      >
        <div className="hidden md:block">
          <table className="w-full">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="p-3">Created</th>
                <th className="p-3">Type</th>
                <th className="p-3">Dates</th>
                <th className="p-3">Hours</th>
                <th className="p-3">Status</th>
                <th className="p-3">Request Notes</th>
                <th className="p-3">Decision Comment</th>
              </tr>
            </thead>
            <tbody>
              {visibleRequests.map((request) => (
                <tr key={request.id} className="border-t">
                  <td className="p-3">{formatDate(request.createdAt)}</td>
                  <td className="p-3">{request.leaveType}</td>
                  <td className="p-3">
                    {formatDate(request.startDate)} - {formatDate(request.endDate)}
                  </td>
                  <td className="p-3">{request.hours.toFixed(2)}</td>
                  <td className="p-3">{request.status}</td>
                  <td className="p-3">{request.notes ?? "-"}</td>
                  <td className="p-3">{request.approvalComment ?? "-"}</td>
                </tr>
              ))}
              {visibleRequests.length === 0 && (
                <tr>
                  <td className="p-3 text-slate-500" colSpan={7}>
                    No requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-4 md:hidden">
          {visibleRequests.length === 0 ? (
            <div className="text-sm text-slate-500">No requests found.</div>
          ) : (
            visibleRequests.map((request) => (
              <div key={request.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">
                    {request.leaveType}
                  </div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    {request.status}
                  </div>
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  {formatDate(request.startDate)} - {formatDate(request.endDate)}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-slate-500">Created</div>
                    <div className="font-medium text-slate-900">
                      {formatDate(request.createdAt)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Hours</div>
                    <div className="font-medium text-slate-900">
                      {request.hours.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-sm">
                  <div className="text-slate-500">Request Notes</div>
                  <div className="break-words text-slate-900">{request.notes ?? "-"}</div>
                </div>
                <div className="mt-3 text-sm">
                  <div className="text-slate-500">Decision Comment</div>
                  <div className="break-words text-slate-900">
                    {request.approvalComment ?? "-"}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </EmployeeProfileSection>
    </div>
  );
}
