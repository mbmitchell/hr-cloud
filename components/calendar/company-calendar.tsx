"use client";

import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, addDays } from "date-fns";
import { enUS } from "date-fns/locale";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  dateToDateOnlyString,
  formatDateOnlyForDisplay,
  parseDateOnly,
} from "../../lib/date-only";
import { LEAVE_TYPES } from "../../lib/pto/leave-types";
import "react-big-calendar/lib/css/react-big-calendar.css";

type CalendarEvent = {
  id: string;
  sourceId: string;
  eventType: "PTO" | "HOLIDAY";
  title: string;
  employeeId?: string;
  employeeName?: string;
  holidayName?: string;
  leaveType?: string;
  start: string;
  end: string;
  hours?: number;
  status: string;
  notes?: string;
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
  sourceId: string;
  eventType: "PTO" | "HOLIDAY";
  title: string;
  employeeId?: string;
  employeeName?: string;
  holidayName?: string;
  leaveType?: string;
  startDate: string;
  endDate: string;
  hours?: number;
  status: string;
  notes: string;
  approvalComment?: string;
  countsAsCompanyHoliday?: boolean;
  source?: "FEDERAL_SEED" | "MANUAL";
  canManage: boolean;
  canAct?: boolean;
  canSelfCancel?: boolean;
};

type HolidaySummary = {
  businessDayCount: number;
  holidayDates: string[];
  weekendDates: string[];
  eligibleHours: number;
};

const STATUS_OPTIONS = ["PENDING", "APPROVED", "DENIED", "CANCELLED"] as const;

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
  const { leaveType, status, eventType } = event.resource;

  let base = "rbc-event-default";

  if (eventType === "HOLIDAY") {
    base = "rbc-event-holiday";
  } else {
    if (leaveType === "PTO") base = "rbc-event-pto";
    if (leaveType === "SICK") base = "rbc-event-sick";
    if (leaveType === "COMP") base = "rbc-event-comp";
    if (leaveType === "BEREAVEMENT") base = "rbc-event-bereavement";
  }

  if (status === "PENDING") {
    base += " rbc-event-pending";
  }

  return base;
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
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<View>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<EventDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [message, setMessage] = useState("");
  const [approvalComment, setApprovalComment] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [leaveType, setLeaveType] = useState("PTO");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [hours, setHours] = useState("");
  const [status, setStatus] = useState<string>("PENDING");
  const [notes, setNotes] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const [countsAsCompanyHoliday, setCountsAsCompanyHoliday] = useState(true);
  const [holidayIsActive, setHolidayIsActive] = useState(true);
  const [holidaySummary, setHolidaySummary] = useState<HolidaySummary | null>(null);
  const [loadingHolidaySummary, setLoadingHolidaySummary] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (window.innerWidth < 768) {
      setView("agenda");
    }
  }, []);

  useEffect(() => {
    if (!selectedEvent) {
      return;
    }

    setLeaveType(selectedEvent.leaveType ?? "PTO");
    setStartDate(selectedEvent.startDate);
    setEndDate(selectedEvent.endDate);
    setHours(String(selectedEvent.hours ?? 0));
    setStatus(selectedEvent.status);
    setNotes(selectedEvent.notes || "");
    setApprovalComment(selectedEvent.approvalComment || "");
    setHolidayName(selectedEvent.holidayName || "");
    setCountsAsCompanyHoliday(selectedEvent.countsAsCompanyHoliday ?? true);
    setHolidayIsActive(selectedEvent.status !== "INACTIVE");
  }, [selectedEvent]);

  useEffect(() => {
    if (
      !selectedEvent ||
      selectedEvent.eventType !== "PTO" ||
      !startDate ||
      !endDate
    ) {
      setHolidaySummary(null);
      return;
    }

    let isCancelled = false;

    async function loadHolidaySummary() {
      setLoadingHolidaySummary(true);

      try {
        const params = new URLSearchParams({
          startDate,
          endDate,
        });
        const response = await fetch(`/api/company-holidays?${params.toString()}`);
        const data = await response.json();

        if (!response.ok || !data.summary) {
          if (!isCancelled) {
            setHolidaySummary(null);
          }
          return;
        }

        if (!isCancelled) {
          setHolidaySummary(data.summary);
        }
      } catch {
        if (!isCancelled) {
          setHolidaySummary(null);
        }
      } finally {
        if (!isCancelled) {
          setLoadingHolidaySummary(false);
        }
      }
    }

    loadHolidaySummary();

    return () => {
      isCancelled = true;
    };
  }, [selectedEvent, startDate, endDate]);

 const mappedEvents = useMemo<CalendarItem[]>(() => {
  return events.map((event) => {
    const start = parseDateOnly(event.start) ?? new Date();
    const endInclusive = parseDateOnly(event.end) ?? start;
    const endExclusive = addDays(endInclusive, 1);
    const title =
      event.eventType === "HOLIDAY"
        ? event.title
        : (() => {
            const initials = (event.employeeName ?? "")
              .split(" ")
              .filter(Boolean)
              .map((n) => n[0])
              .join("");

            return `${initials} ${event.leaveType}`;
          })();

    return {
      id: event.id,
      title,
      start,
      end: endExclusive,
      allDay: true,
      resource: event,
    };
  });
}, [events]);

const todayEvents = useMemo(() => {
  const today = new Date();

  return mappedEvents.filter(
    (event) =>
      event.resource.eventType === "PTO" &&
      isDateBetween(today, event.start, addDays(event.end, -1))
  );
}, [mappedEvents]);

const todayHolidays = useMemo(() => {
  const today = new Date();

  return mappedEvents.filter(
    (event) =>
      event.resource.eventType === "HOLIDAY" &&
      isDateBetween(today, event.start, addDays(event.end, -1))
  );
}, [mappedEvents]);

const holidayDateSet = useMemo(
  () =>
    new Set(
      events
        .filter((event) => event.eventType === "HOLIDAY")
        .map((event) => event.start)
    ),
  [events]
);

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

  async function handleSaveChanges() {
    if (!selectedEvent || selectedEvent.eventType !== "PTO") return;

    if (!leaveType || !startDate || !endDate || !hours.trim() || !status.trim()) {
      setMessage("Leave type, dates, hours, and status are required.");
      return;
    }

    if (status === "DENIED" && !approvalComment.trim()) {
      setMessage("A deny reason is required.");
      return;
    }

    if (holidaySummary && holidaySummary.businessDayCount === 0) {
      setMessage(
        "Selected dates do not include any working days after weekends and company holidays."
      );
      return;
    }

    if (
      holidaySummary &&
      Number(hours) - holidaySummary.eligibleHours > 0.01
    ) {
      setMessage(
        `Selected dates allow up to ${holidaySummary.eligibleHours.toFixed(
          2
        )} hours after excluding weekends and company holidays.`
      );
      return;
    }

    setActionLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/pto-requests/${selectedEvent.sourceId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leaveType,
          startDate,
          endDate,
          hours: Number(hours),
          status,
          notes,
          approvalComment,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to save PTO request changes.");
        return;
      }

      setMessage(
        data.unchanged
          ? "No PTO request changes were needed."
          : "PTO request updated successfully."
      );
      if (data.request) {
        setSelectedEvent((current) =>
          current
            ? {
                ...current,
                ...data.request,
                id: current.id,
                sourceId: current.sourceId,
                eventType: "PTO",
                title: `${current.employeeName} • ${data.request.leaveType}`,
              }
            : current
        );
      }
      router.refresh();
    } catch {
      setMessage("Unable to save PTO request changes.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSaveHolidayChanges() {
    if (!selectedEvent || selectedEvent.eventType !== "HOLIDAY") {
      return;
    }

    if (!holidayName.trim() || !startDate) {
      setMessage("Holiday name and date are required.");
      return;
    }

    setActionLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/holidays/${selectedEvent.sourceId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: holidayName,
          date: startDate,
          isActive: holidayIsActive,
          countsAsCompanyHoliday,
          notes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to save holiday changes.");
        return;
      }

      setMessage("Holiday updated successfully.");
      if (data.holiday) {
        setSelectedEvent((current) =>
          current
            ? {
                ...current,
                title: `Holiday - ${data.holiday.name}`,
                holidayName: data.holiday.name,
                startDate: data.holiday.date,
                endDate: data.holiday.date,
                status: data.holiday.isActive ? "ACTIVE" : "INACTIVE",
                notes: data.holiday.notes ?? "",
                countsAsCompanyHoliday: data.holiday.countsAsCompanyHoliday,
                source: data.holiday.source,
              }
            : current
        );
      }
      router.refresh();
    } catch {
      setMessage("Unable to save holiday changes.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancelRequest() {
    if (!selectedEvent || selectedEvent.eventType !== "PTO") return;

    setActionLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/pto-requests/${selectedEvent.sourceId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          approvalComment,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to cancel PTO request.");
        return;
      }

      setMessage("PTO request cancelled successfully.");
      if (data.request) {
        setSelectedEvent((current) =>
          current
            ? {
                ...current,
                ...data.request,
                id: current.id,
                sourceId: current.sourceId,
                eventType: "PTO",
                title: `${current.employeeName} • ${data.request.leaveType}`,
                canAct: false,
                canSelfCancel: false,
              }
            : current
        );
      }
      router.refresh();
    } catch {
      setMessage("Unable to cancel PTO request.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteHoliday() {
    if (!selectedEvent || selectedEvent.eventType !== "HOLIDAY") {
      return;
    }

    setActionLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/holidays/${selectedEvent.sourceId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to delete holiday.");
        return;
      }

      setMessage("Holiday deleted successfully.");
      setSelectedEvent(null);
      router.refresh();
    } catch {
      setMessage("Unable to delete holiday.");
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
      {todayHolidays.length > 0 ? (
        <div className="mb-6 rounded border border-red-200 bg-red-50 p-4">
          <div className="mb-2 text-sm font-semibold text-red-900">
            Company Holiday Today
          </div>
          <div className="space-y-1 text-sm text-red-800">
            {todayHolidays.map((event) => (
              <div key={event.id}>{event.resource.holidayName}</div>
            ))}
          </div>
        </div>
      ) : null}
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
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded bg-red-600" />
          <span>HOLIDAY</span>
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
              event.resource.eventType === "HOLIDAY"
                ? `${event.resource.holidayName} • Company Holiday`
                : `${event.resource.employeeName} • ${event.resource.leaveType} • ${event.resource.status} • ${event.resource.hours} hrs`
            }
            dayPropGetter={(date) => {
              const today = new Date();
              const dateOnly = dateToDateOnlyString(date);
              const isToday =
                date.getFullYear() === today.getFullYear() &&
                date.getMonth() === today.getMonth() &&
                date.getDate() === today.getDate();
              const isHoliday = holidayDateSet.has(dateOnly);

              if (isHoliday) {
                return {
                  style: {
                    backgroundColor: isToday ? "#fee2e2" : "#fef2f2",
                    boxShadow: "inset 0 0 0 1px rgba(220, 38, 38, 0.18)",
                  },
                };
              }

              if (isToday) {
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
                setNotes("");
              }}
              className="border border-slate-300 px-3 py-1 rounded hover:bg-slate-50"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {selectedEvent.eventType === "PTO" ? (
              <>
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
              </>
            ) : (
              <>
                <div>
                  <b>Holiday:</b> {selectedEvent.holidayName}
                </div>
                <div>
                  <b>Status:</b> {selectedEvent.status}
                </div>
                <div>
                  <b>Source:</b> {selectedEvent.source === "FEDERAL_SEED" ? "Federal seed" : "Manual"}
                </div>
                <div>
                  <b>Counts As Company Holiday:</b>{" "}
                  {selectedEvent.countsAsCompanyHoliday ? "Yes" : "No"}
                </div>
              </>
            )}
            <div>
              <b>Date:</b> {formatDateOnlyForDisplay(selectedEvent.startDate)}
            </div>
            <div className="md:col-span-2">
              <b>{selectedEvent.eventType === "HOLIDAY" ? "Notes" : "Request Notes"}:</b>{" "}
              {selectedEvent.notes || "-"}
            </div>
          </div>

          {selectedEvent.eventType === "PTO" && selectedEvent.canManage ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">Leave Type</label>
                  <select
                    value={leaveType}
                    onChange={(event) => setLeaveType(event.target.value)}
                    className="w-full rounded border px-3 py-2"
                    disabled={actionLoading}
                  >
                    {LEAVE_TYPES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Status</label>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className="w-full rounded border px-3 py-2"
                    disabled={actionLoading}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="w-full rounded border px-3 py-2"
                    disabled={actionLoading}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="w-full rounded border px-3 py-2"
                    disabled={actionLoading}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Hours</label>
                  <input
                    type="number"
                    min="0.25"
                    step="0.25"
                    value={hours}
                    onChange={(event) => setHours(event.target.value)}
                    className="w-full rounded border px-3 py-2"
                    disabled={actionLoading}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Full-day hours are based on business days after excluding weekends and active company holidays.
                  </p>
                  {loadingHolidaySummary ? (
                    <div className="mt-2 text-xs text-slate-500">
                      Calculating holiday-aware request hours...
                    </div>
                  ) : null}
                  {holidaySummary ? (
                    <div className="mt-2 space-y-1 text-xs">
                      <div className="text-slate-600">
                        {holidaySummary.businessDayCount} business day(s) selected •
                        full-day equivalent {holidaySummary.eligibleHours.toFixed(2)} hours
                      </div>
                      {holidaySummary.holidayDates.length > 0 ? (
                        <div className="text-blue-700">
                          Company holidays excluded:{" "}
                          {holidaySummary.holidayDates
                            .map((date) => formatDateOnlyForDisplay(date))
                            .join(", ")}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium">Request Notes</label>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className="w-full rounded border px-3 py-2 min-h-24"
                    placeholder="Optional employee or admin notes."
                    disabled={actionLoading}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium">
                    Decision Comment / Cancel Reason
                  </label>
                  <textarea
                    value={approvalComment}
                    onChange={(event) => setApprovalComment(event.target.value)}
                    className="w-full rounded border px-3 py-2 min-h-24"
                    placeholder="Optional unless denying the request."
                    disabled={actionLoading}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={handleSaveChanges}
                  disabled={actionLoading}
                  className="w-full rounded bg-green-600 px-4 py-2.5 text-white hover:bg-green-500 disabled:opacity-50 sm:w-auto"
                >
                  {actionLoading ? "Working..." : "Save Changes"}
                </button>

                <button
                  onClick={handleCancelRequest}
                  disabled={actionLoading}
                  className="w-full rounded bg-red-600 px-4 py-2.5 text-white hover:bg-red-500 disabled:opacity-50 sm:w-auto"
                >
                  {actionLoading ? "Working..." : "Cancel Request"}
                </button>
              </div>
            </div>
          ) : selectedEvent.eventType === "HOLIDAY" && selectedEvent.canManage ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">Holiday Name</label>
                  <input
                    type="text"
                    value={holidayName}
                    onChange={(event) => setHolidayName(event.target.value)}
                    className="w-full rounded border px-3 py-2"
                    disabled={actionLoading}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => {
                      setStartDate(event.target.value);
                      setEndDate(event.target.value);
                    }}
                    className="w-full rounded border px-3 py-2"
                    disabled={actionLoading}
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={holidayIsActive}
                    onChange={(event) => setHolidayIsActive(event.target.checked)}
                    disabled={actionLoading}
                  />
                  Active holiday
                </label>

                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={countsAsCompanyHoliday}
                    onChange={(event) =>
                      setCountsAsCompanyHoliday(event.target.checked)
                    }
                    disabled={actionLoading}
                  />
                  Exclude from PTO calculations
                </label>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className="min-h-24 w-full rounded border px-3 py-2"
                    placeholder="Optional holiday notes."
                    disabled={actionLoading}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={handleSaveHolidayChanges}
                  disabled={actionLoading}
                  className="w-full rounded bg-red-600 px-4 py-2.5 text-white hover:bg-red-500 disabled:opacity-50 sm:w-auto"
                >
                  {actionLoading ? "Working..." : "Save Holiday"}
                </button>

                <button
                  onClick={handleDeleteHoliday}
                  disabled={actionLoading}
                  className="w-full rounded border border-red-300 px-4 py-2.5 text-red-700 hover:bg-red-50 disabled:opacity-50 sm:w-auto"
                >
                  {actionLoading ? "Working..." : "Delete Holiday"}
                </button>
              </div>
            </div>
          ) : selectedEvent.eventType === "PTO" && selectedEvent.canSelfCancel ? (
            <div className="space-y-3">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Cancel Reason
                </label>
                <textarea
                  value={approvalComment}
                  onChange={(event) => setApprovalComment(event.target.value)}
                  className="w-full rounded border px-3 py-2 min-h-24"
                  placeholder="Optional cancellation note."
                  disabled={actionLoading}
                />
              </div>

              <button
                onClick={handleCancelRequest}
                disabled={actionLoading}
                className="w-full rounded bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-800 disabled:opacity-50 sm:w-auto"
              >
                {actionLoading ? "Working..." : "Cancel Request"}
              </button>
            </div>
          ) : (
            <div className="text-sm text-slate-600">
              {selectedEvent.eventType === "HOLIDAY"
                ? "You can view this holiday, but you do not have edit authority for it."
                : selectedEvent.status === "PENDING"
                  ? "You can view this request, but you do not have edit authority for it."
                  : `Decision Comment: ${selectedEvent.approvalComment || "-"}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
