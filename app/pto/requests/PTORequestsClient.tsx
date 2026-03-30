"use client";

import { useState } from "react";

type PTORequestRow = {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  hours: number;
  status: string;
  notes: string;
};

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export default function PTORequestsClient({
  requests,
}: {
  requests: PTORequestRow[];
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function handleCancel(requestId: string) {
    setMessage("");
    setLoadingId(requestId);

    try {
      const response = await fetch(`/api/pto-requests/${requestId}/cancel`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to cancel request.");
        return;
      }

      setMessage("Request cancelled successfully.");
      window.location.reload();
    } catch {
      setMessage("Unable to cancel request.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">PTO Request History</h2>

      {message && (
        <div className="mb-4 bg-white rounded shadow p-4 text-sm text-slate-700">
          {message}
        </div>
      )}

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="p-3">Leave Type</th>
              <th className="p-3">Dates</th>
              <th className="p-3">Hours</th>
              <th className="p-3">Status</th>
              <th className="p-3">Notes</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => {
              const canCancel = request.status === "PENDING";

              return (
                <tr key={request.id} className="border-t">
                  <td className="p-3">{request.leaveType}</td>
                  <td className="p-3">
                    {fmtDate(request.startDate)} - {fmtDate(request.endDate)}
                  </td>
                  <td className="p-3">{request.hours}</td>
                  <td className="p-3">{request.status}</td>
                  <td className="p-3">{request.notes || "-"}</td>
                  <td className="p-3">
                    {canCancel ? (
                      <button
                        onClick={() => handleCancel(request.id)}
                        disabled={loadingId === request.id}
                        className="bg-slate-900 text-white px-3 py-1 rounded hover:bg-slate-800 disabled:opacity-50"
                      >
                        {loadingId === request.id ? "Cancelling..." : "Cancel"}
                      </button>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}