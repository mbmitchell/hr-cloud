import EmployeeProfileSection from "./EmployeeProfileSection";

function formatDate(value: Date) {
  return new Date(value).toLocaleDateString();
}

export default function EmployeeActivityTab({
  statusHistoryEntries,
  visibleLedger,
}: {
  statusHistoryEntries: Array<{
    id: string;
    previousStatus: string;
    newStatus: string;
    changedByName: string;
    changedAt: Date;
  }>;
  visibleLedger: Array<{
    id: string;
    effectiveDate: Date;
    bucket: string;
    type: string;
    hours: number;
    balance: number;
    notes: string | null;
  }>;
}) {
  return (
    <div className="space-y-6">
      <EmployeeProfileSection title="Status History" defaultExpanded>
        {statusHistoryEntries.length === 0 ? (
          <div className="text-sm text-slate-500">No status history found.</div>
        ) : (
          <div className="space-y-3">
            {statusHistoryEntries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg border border-slate-200 px-4 py-3"
              >
                <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-medium text-slate-900">
                      {entry.previousStatus} to {entry.newStatus}
                    </div>
                    <div className="mt-1 text-slate-500">
                      Changed by {entry.changedByName}
                    </div>
                  </div>
                  <div className="text-slate-500">{formatDate(entry.changedAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </EmployeeProfileSection>

      <EmployeeProfileSection
        title="Recent Ledger Activity"
        defaultExpanded
        className="overflow-hidden px-0 pb-0 pt-5 sm:px-0 sm:pb-0 sm:pt-6"
      >
        <div className="hidden md:block">
          <table className="w-full">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Bucket</th>
                <th className="p-3">Type</th>
                <th className="p-3">Hours</th>
                <th className="p-3">Balance</th>
                <th className="p-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {visibleLedger.map((entry) => (
                <tr key={entry.id} className="border-t">
                  <td className="p-3">{formatDate(entry.effectiveDate)}</td>
                  <td className="p-3">{entry.bucket}</td>
                  <td className="p-3">{entry.type}</td>
                  <td className="p-3">{entry.hours.toFixed(2)}</td>
                  <td className="p-3">{entry.balance.toFixed(2)}</td>
                  <td className="p-3">{entry.notes ?? "-"}</td>
                </tr>
              ))}
              {visibleLedger.length === 0 && (
                <tr>
                  <td className="p-3 text-slate-500" colSpan={6}>
                    No ledger activity found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-4 md:hidden">
          {visibleLedger.length === 0 ? (
            <div className="text-sm text-slate-500">No ledger activity found.</div>
          ) : (
            visibleLedger.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">
                    {entry.bucket} • {entry.type}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatDate(entry.effectiveDate)}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-slate-500">Hours</div>
                    <div className="font-medium text-slate-900">
                      {entry.hours.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Balance</div>
                    <div className="font-medium text-slate-900">
                      {entry.balance.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-sm">
                  <div className="text-slate-500">Notes</div>
                  <div className="break-words text-slate-900">{entry.notes ?? "-"}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </EmployeeProfileSection>
    </div>
  );
}
