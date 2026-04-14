"use client";

import { useEffect, useMemo, useState } from "react";

type NotificationRow = {
  id: string;
  eventType: string;
  relatedEntityType: string;
  relatedEntityId: string;
  notificationType: string;
  recipientEmail: string;
  status: string;
  attemptCount: number;
  lastAttemptAt: string | null;
  sentAt: string | null;
  lastError: string | null;
  createdAt: string;
};

type AutoAppliedChangeRow = {
  changeRequestId: string;
  employeeId: string | null;
  appliedAt: string;
};

type ScheduledJobRunRow = {
  id: string;
  jobName: string;
  runKey: string;
  startedAt: string;
  completedAt: string | null;
  status: string;
  recordsProcessed: number | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

type NotificationsResponse = {
  notifications: NotificationRow[];
  automation: {
    autoApplyEnabled: boolean;
    pendingEscalationDays: number;
    ptoPendingEscalationHours: number;
    recentAutoAppliedChanges: AutoAppliedChangeRow[];
    recentJobRuns: ScheduledJobRunRow[];
  };
};

function getStatusClass(status: string) {
  switch (status) {
    case "SENT":
      return "bg-emerald-100 text-emerald-800";
    case "FAILED":
      return "bg-red-100 text-red-800";
    case "PROCESSING":
      return "bg-blue-100 text-blue-800";
    case "PENDING":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function summarizeError(value: string | null) {
  if (!value) {
    return "No failure recorded.";
  }

  return value.length > 160 ? `${value.slice(0, 157)}...` : value;
}

function canRetry(notification: NotificationRow) {
  return notification.status === "FAILED";
}

function canCancel(notification: NotificationRow) {
  return notification.status === "PENDING" || notification.status === "FAILED";
}

export default function NotificationsAdminClient() {
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [generatingReminders, setGeneratingReminders] = useState(false);
  const [runningAutomation, setRunningAutomation] = useState(false);

  async function loadNotifications() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/notifications");
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "Unable to load notifications.");
        setData(null);
      } else {
        setData(result);
      }
    } catch {
      setMessage("Unable to load notifications.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  const notifications = useMemo(() => data?.notifications ?? [], [data]);

  async function retryNotification(notificationId: string) {
    setRetryingId(notificationId);
    setMessage("");

    try {
      const response = await fetch(
        `/api/admin/notifications/${notificationId}/retry`,
        {
          method: "POST",
        }
      );
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "Unable to retry notification.");
        return;
      }

      await loadNotifications();
    } catch {
      setMessage("Unable to retry notification.");
    } finally {
      setRetryingId(null);
    }
  }

  async function cancelNotification(notificationId: string) {
    setCancellingId(notificationId);
    setMessage("");

    try {
      const response = await fetch(
        `/api/admin/notifications/${notificationId}/cancel`,
        {
          method: "POST",
        }
      );
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "Unable to cancel notification.");
        return;
      }

      await loadNotifications();
    } catch {
      setMessage("Unable to cancel notification.");
    } finally {
      setCancellingId(null);
    }
  }

  async function processNotifications() {
    setProcessing(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/notifications/process", {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "Unable to process notifications.");
        return;
      }

      await loadNotifications();
    } catch {
      setMessage("Unable to process notifications.");
    } finally {
      setProcessing(false);
    }
  }

  async function generateReminders() {
    setGeneratingReminders(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/notifications/reminders/run", {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "Unable to generate reminders.");
        return;
      }

      await loadNotifications();
    } catch {
      setMessage("Unable to generate reminders.");
    } finally {
      setGeneratingReminders(false);
    }
  }

  async function runAutomation() {
    setRunningAutomation(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/notifications/automation/run", {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "Unable to run HR automation.");
        return;
      }

      await loadNotifications();
    } catch {
      setMessage("Unable to run HR automation.");
    } finally {
      setRunningAutomation(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Notifications</h2>
          <p className="text-sm text-slate-600">
            Review shared HR notification delivery status, process queued messages, and manage failed deliveries.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={processNotifications}
            disabled={processing}
            className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {processing ? "Processing..." : "Process Notifications"}
          </button>
          <button
            type="button"
            onClick={generateReminders}
            disabled={generatingReminders}
            className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generatingReminders ? "Generating..." : "Generate Reminders"}
          </button>
          <button
            type="button"
            onClick={runAutomation}
            disabled={runningAutomation}
            className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {runningAutomation ? "Running..." : "Run Automation"}
          </button>
        </div>
      </div>

      {data?.automation ? (
        <div className="rounded bg-white p-4 shadow">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Job Change Automation
              </h3>
              <p className="text-sm text-slate-600">
                Auto-apply runs for approved changes at or past their effective date. Escalations notify HR for stalled workflows.
              </p>
            </div>
            <span
              className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                data.automation.autoApplyEnabled
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {data.automation.autoApplyEnabled
                ? "Auto-Apply Enabled"
                : "Auto-Apply Disabled"}
            </span>
          </div>

          <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
            <div>
              <div className="text-slate-500">Pending Job Change Escalation</div>
              <div className="text-slate-900">
                {data.automation.pendingEscalationDays} day threshold
              </div>
            </div>
            <div>
              <div className="text-slate-500">Pending PTO Escalation</div>
              <div className="text-slate-900">
                {data.automation.ptoPendingEscalationHours} hour threshold
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h4 className="text-sm font-semibold text-slate-900">
              Recent Auto-Applied Changes
            </h4>
            <div className="mt-2 space-y-2">
              {data.automation.recentAutoAppliedChanges.length === 0 ? (
                <div className="text-sm text-slate-500">
                  No auto-applied changes recorded yet.
                </div>
              ) : (
                data.automation.recentAutoAppliedChanges.map((change) => (
                  <div
                    key={`${change.changeRequestId}-${change.appliedAt}`}
                    className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  >
                    <div className="font-medium text-slate-900">
                      Change Request {change.changeRequestId}
                    </div>
                    <div className="text-slate-600">
                      Employee {change.employeeId ?? "Unknown"} • Applied{" "}
                      {new Date(change.appliedAt).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6">
            <h4 className="text-sm font-semibold text-slate-900">
              Recent Scheduled Job Runs
            </h4>
            <div className="mt-2 space-y-2">
              {data.automation.recentJobRuns.length === 0 ? (
                <div className="text-sm text-slate-500">
                  No scheduled job runs recorded yet.
                </div>
              ) : (
                data.automation.recentJobRuns.map((run) => (
                  <div
                    key={run.id}
                    className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium text-slate-900">{run.jobName}</div>
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusClass(run.status)}`}
                      >
                        {run.status}
                      </span>
                    </div>
                    <div className="mt-1 text-slate-600">
                      Started {new Date(run.startedAt).toLocaleString()}
                      {run.completedAt
                        ? ` • Completed ${new Date(run.completedAt).toLocaleString()}`
                        : ""}
                    </div>
                    <div className="mt-1 text-slate-600">
                      Records processed: {run.recordsProcessed ?? 0}
                    </div>
                    {run.lastError ? (
                      <div className="mt-1 text-red-700">
                        Last error: {summarizeError(run.lastError)}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {message ? (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {message}
        </div>
      ) : null}

      {loading ? (
        <div className="text-slate-600">Loading notifications...</div>
      ) : (
        <div className="overflow-hidden rounded bg-white shadow">
          <table className="w-full">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="p-3">Created</th>
                <th className="p-3">Event</th>
                <th className="p-3">Type</th>
                <th className="p-3">Recipient</th>
                <th className="p-3">Status</th>
                <th className="p-3">Attempts</th>
                <th className="p-3">Last Error</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((notification) => (
                <tr key={notification.id} className="border-t align-top">
                  <td className="p-3 text-sm text-slate-700">
                    {new Date(notification.createdAt).toLocaleString()}
                  </td>
                  <td className="p-3 text-sm">
                    <div className="font-medium text-slate-900">
                      {notification.eventType}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {notification.relatedEntityType}: {notification.relatedEntityId}
                    </div>
                  </td>
                  <td className="p-3 text-sm text-slate-700">
                    {notification.notificationType === "SYSTEM_GENERATED"
                      ? "System"
                      : "User"}
                  </td>
                  <td className="p-3 text-sm text-slate-700">
                    {notification.recipientEmail}
                  </td>
                  <td className="p-3 text-sm">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusClass(notification.status)}`}
                    >
                      {notification.status}
                    </span>
                    {notification.sentAt ? (
                      <div className="mt-1 text-xs text-slate-500">
                        Sent {new Date(notification.sentAt).toLocaleString()}
                      </div>
                    ) : null}
                    {notification.lastAttemptAt ? (
                      <div className="mt-1 text-xs text-slate-500">
                        Last attempt {new Date(notification.lastAttemptAt).toLocaleString()}
                      </div>
                    ) : null}
                  </td>
                  <td className="p-3 text-sm text-slate-700">
                    {notification.attemptCount}
                  </td>
                  <td className="p-3 text-sm text-slate-700">
                    {summarizeError(notification.lastError)}
                  </td>
                  <td className="p-3 text-sm">
                    <div className="flex flex-wrap gap-2">
                      {canRetry(notification) ? (
                        <button
                          type="button"
                          onClick={() => retryNotification(notification.id)}
                          disabled={retryingId === notification.id}
                          className="rounded border border-slate-300 px-3 py-2 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {retryingId === notification.id ? "Retrying..." : "Retry"}
                        </button>
                      ) : null}
                      {canCancel(notification) ? (
                        <button
                          type="button"
                          onClick={() => cancelNotification(notification.id)}
                          disabled={cancellingId === notification.id}
                          className="rounded border border-slate-300 px-3 py-2 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {cancellingId === notification.id ? "Cancelling..." : "Cancel"}
                        </button>
                      ) : null}
                      {!canRetry(notification) && !canCancel(notification) ? (
                        <span className="text-slate-400">-</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}

              {notifications.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4 text-sm text-slate-500">
                    No notifications found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
