"use client";

import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, addDays } from "date-fns";
import { enUS } from "date-fns/locale";
import { useEffect, useMemo, useState } from "react";
import { formatDateOnlyForDisplay } from "../../lib/date-only";
import "react-big-calendar/lib/css/react-big-calendar.css";

type CalendarEvent = {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  start: string;
  end: string;
  hours: number;
  status: string;
};

type CalendarItem = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: true;
  resource: CalendarEvent;
};

type EventDetail = {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  hours: number;
  status: string;
  notes: string;
  approvalComment: string;
  canAct: boolean;
};

const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
});

function eventClassName(event: CalendarItem) {
  const { leaveType, status } = event.resource;

  let base = "rbc-event-default";

  if (leaveType === "PTO") base = "rbc-event-pto";
  if (leaveType === "SICK") base = "rbc-event-sick";
  if (leaveType === "COMP") base = "rbc-event-comp";
  if (leaveType === "BEREAVEMENT") base = "rbc-event-bereavement";

  if (status === "PENDING") {
    base += " rbc-event-pending";
  }

  return base;
}

function parseDateOnly(value: string) {
  const datePart = value.split("T")[0];
  const [year, month, day] = datePart.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isDateBetween(date: Date, start: Date, end: Date) {
  const d = new Date(date);
  d.setHours(0,0,0,0);

  const s = new Date(start);
  s.setHours(0,0,0,0);

  const e = new Date(end);
  e.setHours(0,0,0,0);

  return d >= s && d <= e;
}

export default function CompanyCalendar({
  events,
}: {
  events: CalendarEvent[];
}) {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<View>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<EventDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [message, setMessage] = useState("");
  const [approvalComment, setApprovalComment] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (window.innerWidth < 768) {
      setView("agenda");
    }
  }, []);

 const mappedEvents = useMemo<CalendarItem[]>(() => {
  return events.map((event) => {
    const start = parseDateOnly(event.start);
    const endInclusive = parseDateOnly(event.end);
    const endExclusive = addDays(endInclusive, 1);

    const initials = event.employeeName
      .split(" ")
      .map((n) => n[0])
      .join("");

    return {
      id: event.id,
      title: `${initials} ${event.leaveType}`,
      start,
      end: endExclusive,
      allDay: true,
      resource: event,
    };
  });
}, [events]);

const todayEvents = useMemo(() => {
  const today = new Date();

  return mappedEvents.filter((event) =>
    isDateBetween(today, event.start, addDays(event.end, -1))
  );
}, [mappedEvents]);

  async function handleSelectEvent(event: CalendarItem) {
    setLoadingDetail(true);
    setMessage("");
    setApprovalComment("");

    try {
      const response = await fetch(`/api/calendar/${event.resource.id}`);
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to load event details.");
        return;
      }

      setSelectedEvent(data);
      setApprovalComment(data.approvalComment || "");

      setTimeout(() => {
        const el = document.getElementById("calendar-request-details");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 50);
    } catch {
      setMessage("Unable to load event details.");
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleDecision(status: "APPROVED" | "DENIED") {
    if (!selectedEvent) return;

    if (status === "DENIED" && !approvalComment.trim()) {
      setMessage("A deny reason is required.");
      return;
    }

    setActionLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/pto-approvals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestId: selectedEvent.id,
          status,
          approvalComment,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to process request.");
        return;
      }

      setMessage(`Request ${status.toLowerCase()} successfully.`);
      window.location.reload();
    } catch {
      setMessage("Unable to process request.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="bg-white rounded shadow p-4">
      {/* Who's Out Today */}
<div className="mb-6 bg-slate-50 border rounded p-4">
  <div className="text-sm font-semibold mb-2">
    Who's Out Today
  </div>

  {todayEvents.length === 0 ? (
    <div className="text-sm text-slate-500">
      No employees are out today.
    </div>
  ) : (
    <div className="space-y-1 text-sm">
      {todayEvents.map((event) => (
        <div key={event.id}>
          <b>{event.resource.employeeName}</b> — {event.resource.leaveType}
          {event.resource.status === "PENDING" && (
            <span className="text-slate-500"> (pending)</span>
          )}
        </div>
      ))}
    </div>
  )}
</div>
      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded bg-blue-500" />
          <span>PTO</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded bg-orange-500" />
          <span>SICK</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded bg-purple-500" />
          <span>COMP</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded bg-emerald-600" />
          <span>BEREAVEMENT</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded bg-gray-500" />
          <span>PENDING</span>
        </div>
      </div>

      {message && <div className="mb-4 text-sm text-slate-700">{message}</div>}

      <div className="h-[560px] md:h-[750px]">
        {mounted ? (
          <Calendar
            key="company-calendar-mounted"
            localizer={localizer}
            events={mappedEvents}
            startAccessor="start"
            endAccessor="end"
            view={view}
            date={currentDate}
            onView={(nextView) => setView(nextView)}
            onNavigate={(newDate) => setCurrentDate(newDate)}
            views={["month", "week", "agenda"]}
            popup
            selectable={false}
            onSelectEvent={handleSelectEvent}
            eventPropGetter={(event) => ({
              className: `${eventClassName(event)} cursor-pointer`,
            })}
            tooltipAccessor={(event) =>
              `${event.resource.employeeName} • ${event.resource.leaveType} • ${event.resource.status} • ${event.resource.hours} hrs`
            }
            dayPropGetter={(date) => {
  const today = new Date();
  if (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  ) {
    return {
      style: { backgroundColor: "#f8fafc" },
    };
  }
  return {};
}}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-slate-500">
            Loading calendar...
          </div>
        )}
      </div>

      {loadingDetail && (
        <div className="mt-4 text-sm text-slate-600">Loading event details...</div>
      )}

      {selectedEvent && (
        <div
          id="calendar-request-details"
          className="mt-6 bg-white border rounded shadow p-6 space-y-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold">Request Details</h3>
            <button
              onClick={() => {
                setSelectedEvent(null);
                setApprovalComment("");
              }}
              className="border border-slate-300 px-3 py-1 rounded hover:bg-slate-50"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <b>Employee:</b> {selectedEvent.employeeName}
            </div>
            <div>
              <b>Type:</b> {selectedEvent.leaveType}
            </div>
            <div>
              <b>Status:</b> {selectedEvent.status}
            </div>
            <div>
              <b>Hours:</b> {selectedEvent.hours}
            </div>
            <div>
              <b>Start:</b> {formatDateOnlyForDisplay(selectedEvent.startDate)}
            </div>
            <div>
              <b>End:</b> {formatDateOnlyForDisplay(selectedEvent.endDate)}
            </div>
            <div className="md:col-span-2">
              <b>Request Notes:</b> {selectedEvent.notes || "-"}
            </div>
          </div>

          {selectedEvent.status === "PENDING" && selectedEvent.canAct ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Approval Comment / Deny Reason
                </label>
                <textarea
                  value={approvalComment}
                  onChange={(e) => setApprovalComment(e.target.value)}
                  className="w-full border rounded px-3 py-2 min-h-24"
                  placeholder="Optional approval comment. Required for denial."
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => handleDecision("APPROVED")}
                  disabled={actionLoading}
                  className="w-full rounded bg-green-600 px-4 py-2.5 text-white hover:bg-green-500 disabled:opacity-50 sm:w-auto"
                >
                  {actionLoading ? "Working..." : "Approve"}
                </button>

                <button
                  onClick={() => handleDecision("DENIED")}
                  disabled={actionLoading}
                  className="w-full rounded bg-red-600 px-4 py-2.5 text-white hover:bg-red-500 disabled:opacity-50 sm:w-auto"
                >
                  {actionLoading ? "Working..." : "Deny"}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-600">
              {selectedEvent.status === "PENDING"
                ? "You can view this request, but you do not have approval authority for it."
                : `Decision Comment: ${selectedEvent.approvalComment || "-"}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
