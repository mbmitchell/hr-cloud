"use client";

import { useMemo, useState } from "react";

type RecentRequest = {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  hours: number;
  status: string;
};

type ConflictRow = {
  id: string;
  employeeName: string;
  leaveType: string;
  status: string;
  startDate: string;
  endDate: string;
};

type ApprovalRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string | null;
  managerName: string | null;
  leaveType: string;
  startDate: string;
  endDate: string;
  hours: number;
  status: string;
  requestNotes: string;
  currentPtoBalance: number;
  currentCompBalance: number;
  projectedPtoBalance: number;
  monthlyAccrualRate: number;
  accrualCount: number;
  accrualSummaryText?: string;
  effectiveAvailableBalance: number | null;
  isWorkflowOnly: boolean;
  staffingConflictCount: number;
  staffingConflictEmployees: ConflictRow[];
  recentRequests: RecentRequest[];
    actions: {
    id: string;
    action: string;
    actionById: string | null;
    createdAt: string;
    comment: string | null;
  }[];
};

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export default function ManagerApprovalsClient({
  requests,
}: {
  requests: ApprovalRow[];
}) {
  const [comments, setComments] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return requests;

    return requests.filter((request) => {
      return (
        request.employeeName.toLowerCase().includes(q) ||
        request.leaveType.toLowerCase().includes(q) ||
        request.requestNotes.toLowerCase().includes(q) ||
        (request.department ?? "").toLowerCase().includes(q)
      );
    });
  }, [requests, search]);

  async function handleDecision(id: string, action: "APPROVED" | "DENIED") {
    const approvalComment = comments[id]?.trim() ?? "";

    if (action === "DENIED" && !approvalComment) {
      setMessage("A deny reason is required before denying a request.");
      return;
    }

    setMessage("");
    setLoadingId(id);

    try {
      const response = await fetch("/api/pto-approvals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestId: id,
          status: action,
          approvalComment,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to process approval.");
        return;
      }

      setMessage(`Request ${action.toLowerCase()} successfully.`);
      window.location.reload();
    } catch {
      setMessage("Unable to process approval.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Approvals</h2>
          <p className="text-sm text-slate-600 mt-1">
            Review pending requests with balances, projections, and staffing conflicts.
          </p>
        </div>

        <div className="w-full md:w-80">
          <label className="block text-sm font-medium mb-2">Search</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Employee, leave type, notes, department"
            className="w-full border rounded px-3 py-2"
          />
        </div>
      </div>

      {message && (
        <div className="text-sm text-slate-700 bg-white rounded shadow p-4">
          {message}
        </div>
      )}

      {filteredRequests.length === 0 ? (
        <div className="bg-white rounded shadow p-6 text-slate-500">
          No pending approval requests found.
        </div>
      ) : (
        <div className="space-y-6">
          {filteredRequests.map((request) => {
            const isComp = request.leaveType === "COMP";
            const isWorkflowOnly = request.isWorkflowOnly;
            const shortfall =
              request.effectiveAvailableBalance != null &&
              request.hours > request.effectiveAvailableBalance;

            return (
              <div key={request.id} className="bg-white rounded shadow overflow-hidden">
                <div className="border-b p-4 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">{request.employeeName}</h3>
                    <div className="break-words text-sm text-slate-600">
                      {request.leaveType} • {fmtDate(request.startDate)} - {fmtDate(request.endDate)} • {request.hours.toFixed(2)} hours
                    </div>
                    <div className="mt-1 break-words text-xs text-slate-500">
                      Department: {request.department ?? "-"} • Manager: {request.managerName ?? "-"}
                    </div>
                  </div>

                  <div className="text-sm text-slate-600">
                    Status: {request.status}
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 p-4">
                  <div className="space-y-4">
                    <div className="border rounded p-4">
                      <div className="text-sm font-medium text-slate-700 mb-2">
                        Current Balances
                      </div>
                      <div className="text-sm">
                        <b>PTO:</b> {request.currentPtoBalance.toFixed(2)} hours
                      </div>
                      <div className="text-sm">
                        <b>COMP:</b> {request.currentCompBalance.toFixed(2)} hours
                      </div>
                    </div>

                    <div className="border rounded p-4">
                      <div className="text-sm font-medium text-slate-700 mb-2">
                        Request Notes
                      </div>
                      <div className="text-sm text-slate-600">
                        {request.requestNotes || "-"}
                      </div>
                    </div>

                    {request.staffingConflictCount > 0 && (
                      <div className="border border-amber-200 bg-amber-50 rounded p-4">
                        <div className="text-sm font-medium text-amber-800 mb-2">
                          Staffing Conflict Warning
                        </div>
                        <div className="text-sm text-amber-800 mb-2">
                          {request.staffingConflictCount} overlapping request(s) in{" "}
                          {request.department ?? "this department"}.
                        </div>
                        <div className="space-y-1 break-words text-sm text-amber-700">
                          {request.staffingConflictEmployees.slice(0, 5).map((conflict) => (
                            <div key={conflict.id}>
                              {conflict.employeeName} • {conflict.leaveType} • {conflict.status}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="border rounded p-4">
                      <div className="text-sm font-medium text-slate-700 mb-2">
                        Availability at Request Date
                      </div>

                      {isWorkflowOnly ? (
                        <>
                          <div className="text-sm">
                            <b>Balance Impact:</b> None
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            Bereavement leave is informational only and does not reduce PTO or COMP balances.
                          </div>
                        </>
                      ) : isComp ? (
                        <>
                          <div className="text-sm">
                            <b>COMP Available:</b>{" "}
                            {(request.effectiveAvailableBalance ?? 0).toFixed(2)} hours
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            COMP does not accrue automatically.
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-sm">
                            <b>Projected PTO:</b>{" "}
                            {request.projectedPtoBalance.toFixed(2)} hours
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {request.accrualSummaryText ??
                              `${request.accrualCount} accrual(s) × ${request.monthlyAccrualRate.toFixed(
                                2
                              )} hrs/month`}
                          </div>
                        </>
                      )}

                      {shortfall && (
                        <div className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
                          Requested hours exceed expected available balance.
                        </div>
                      )}
                    </div>

                    <div className="border rounded p-4">
                      <div className="text-sm font-medium text-slate-700 mb-2">
                        Approval Comment / Deny Reason
                      </div>
                      <textarea
                        value={comments[request.id] ?? ""}
                        onChange={(e) =>
                          setComments((prev) => ({
                            ...prev,
                            [request.id]: e.target.value,
                          }))
                        }
                        className="w-full border rounded px-3 py-2 min-h-24"
                        placeholder="Optional approval comment. Required for denial."
                      />
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        onClick={() => handleDecision(request.id, "APPROVED")}
                        disabled={loadingId === request.id}
                        className="w-full rounded bg-green-600 px-4 py-2.5 text-white hover:bg-green-500 disabled:opacity-50 sm:w-auto"
                      >
                        {loadingId === request.id ? "Working..." : "Approve"}
                      </button>

                      <button
                        onClick={() => handleDecision(request.id, "DENIED")}
                        disabled={
                          loadingId === request.id || !(comments[request.id]?.trim())
                        }
                        className="w-full rounded bg-red-600 px-4 py-2.5 text-white hover:bg-red-500 disabled:opacity-50 sm:w-auto"
                      >
                        {loadingId === request.id ? "Working..." : "Deny"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="border rounded p-4">
                      <div className="text-sm font-medium text-slate-700 mb-3">
                        Recent Requests
                      </div>

                      <div className="space-y-3">
                        {request.recentRequests.length === 0 ? (
                          <div className="text-sm text-slate-500">
                            No recent requests.
                          </div>
                        ) : (
                          request.recentRequests.map((recent) => (
                            <div
                              key={recent.id}
                              className="border rounded p-3 text-sm"
                            >
                              <div className="font-medium">
                                {recent.leaveType} • {recent.status}
                              </div>
                              <div className="text-slate-600">
                                {fmtDate(recent.startDate)} - {fmtDate(recent.endDate)}
                              </div>
                              <div className="text-slate-500">
                                {recent.hours.toFixed(2)} hours
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="border rounded p-4 mt-4">
  <div className="text-sm font-medium text-slate-700 mb-3">
    Request History
  </div>

  <div className="space-y-3">
    {request.actions.length === 0 ? (
      <div className="text-sm text-slate-500">
        No history available.
      </div>
    ) : (
      request.actions.map((action) => (
        <div key={action.id} className="border rounded p-3 text-sm">
          <div className="font-medium">
            {action.action}
          </div>
          <div className="text-slate-600">
            {fmtDate(action.createdAt)}
          </div>
          {action.comment && (
            <div className="text-slate-500 mt-1">
              {action.comment}
            </div>
            
          )}
        </div>
      ))
    )}
  </div>
</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
