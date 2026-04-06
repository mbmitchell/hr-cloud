"use client";

import { useState } from "react";

type ApprovalRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  hours: number;
  status: string;
  notes: string;
};

export default function ApprovalsClient({
  requests,
}: {
  requests: ApprovalRequest[];
}) {
  const [message, setMessage] = useState("");
  const [comments, setComments] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

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
        setMessage(data.error || "Unable to update request.");
        return;
      }

      setMessage(`Request ${action.toLowerCase()} successfully.`);
      window.location.reload();
    } catch {
      setMessage("Unable to update request.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Approval Queue</h2>

      {message && <div className="mb-4 text-sm text-slate-700">{message}</div>}

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="p-3">Employee</th>
              <th className="p-3">Leave Type</th>
              <th className="p-3">Dates</th>
              <th className="p-3">Hours</th>
              <th className="p-3">Request Notes</th>
              <th className="p-3">Approval Comment / Deny Reason</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id} className="border-t align-top">
                <td className="p-3">{request.employeeName}</td>
                <td className="p-3">{request.leaveType}</td>
                <td className="p-3">
                  {new Date(request.startDate).toLocaleDateString()} -{" "}
                  {new Date(request.endDate).toLocaleDateString()}
                </td>
                <td className="p-3">{request.hours}</td>
                <td className="p-3">{request.notes || "-"}</td>
                <td className="p-3 min-w-64">
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
                </td>
                <td className="p-3 space-y-2">
                  <button
                    onClick={() => handleDecision(request.id, "APPROVED")}
                    disabled={loadingId === request.id}
                    className="block w-full bg-green-600 text-white px-3 py-2 rounded hover:bg-green-500 disabled:opacity-50"
                  >
                    {loadingId === request.id ? "Working..." : "Approve"}
                  </button>
                  <button
                    onClick={() => handleDecision(request.id, "DENIED")}
                    disabled={loadingId === request.id}
                    className="block w-full bg-red-600 text-white px-3 py-2 rounded hover:bg-red-500 disabled:opacity-50"
                  >
                    {loadingId === request.id ? "Working..." : "Deny"}
                  </button>
                </td>
              </tr>
            ))}

            {requests.length === 0 && (
              <tr>
                <td className="p-3" colSpan={7}>
                  No pending PTO requests.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
