"use client";

import { useEffect, useMemo, useState } from "react";

type AuditLogRow = {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
};

type AuditResponse = {
  logs: AuditLogRow[];
  filters: {
    actions: string[];
    entityTypes: string[];
  };
};

function prettyJson(value: string | null) {
  if (!value) return "-";

  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export default function AuditLogClient() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [entityTypeFilter, setEntityTypeFilter] = useState("ALL");
  const [selectedLog, setSelectedLog] = useState<AuditLogRow | null>(null);

  useEffect(() => {
    async function loadAudit() {
      setLoading(true);
      setMessage("");

      try {
        const params = new URLSearchParams();
        params.set("action", actionFilter);
        params.set("entityType", entityTypeFilter);

        const response = await fetch(`/api/admin/audit?${params.toString()}`);
        const result = await response.json();

        if (!response.ok) {
          setMessage(result.error || "Unable to load audit logs.");
          setData(null);
        } else {
          setData(result);
        }
      } catch {
        setMessage("Unable to load audit logs.");
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    loadAudit();
  }, [actionFilter, entityTypeFilter]);

  const logs = useMemo(() => data?.logs ?? [], [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Audit Log</h2>
          <p className="text-sm text-slate-600 mt-1">
            Review administrative changes and system updates.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Action</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="border rounded px-3 py-2 bg-white"
            >
              <option value="ALL">All</option>
              {data?.filters.actions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Entity Type</label>
            <select
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value)}
              className="border rounded px-3 py-2 bg-white"
            >
              <option value="ALL">All</option>
              {data?.filters.entityTypes.map((entityType) => (
                <option key={entityType} value={entityType}>
                  {entityType}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-slate-600">Loading audit logs...</div>
      ) : message ? (
        <div className="text-red-600">{message}</div>
      ) : (
        <>
          <div className="bg-white rounded shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">User</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Entity Type</th>
                  <th className="p-3">Entity ID</th>
                  <th className="p-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t">
                    <td className="p-3">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3">{log.userId}</td>
                    <td className="p-3">{log.action}</td>
                    <td className="p-3">{log.entityType}</td>
                    <td className="p-3 text-xs">{log.entityId}</td>
                    <td className="p-3">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-blue-600 hover:underline"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}

                {logs.length === 0 && (
                  <tr>
                    <td className="p-3 text-slate-500" colSpan={6}>
                      No audit entries found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {selectedLog && (
            <div className="bg-white rounded shadow p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Audit Entry Details</h3>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="border border-slate-300 px-3 py-1 rounded hover:bg-slate-50"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <b>Timestamp:</b> {new Date(selectedLog.createdAt).toLocaleString()}
                </div>
                <div>
                  <b>User:</b> {selectedLog.userId}
                </div>
                <div>
                  <b>Action:</b> {selectedLog.action}
                </div>
                <div>
                  <b>Entity Type:</b> {selectedLog.entityType}
                </div>
                <div className="md:col-span-2">
                  <b>Entity ID:</b> {selectedLog.entityId}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="font-medium mb-2">Old Value</div>
                  <pre className="bg-slate-50 border rounded p-3 text-xs overflow-auto whitespace-pre-wrap">
                    {prettyJson(selectedLog.oldValue)}
                  </pre>
                </div>

                <div>
                  <div className="font-medium mb-2">New Value</div>
                  <pre className="bg-slate-50 border rounded p-3 text-xs overflow-auto whitespace-pre-wrap">
                    {prettyJson(selectedLog.newValue)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}