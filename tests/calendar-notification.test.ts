import test from "node:test";
import assert from "node:assert/strict";

import { buildApprovedPtoCalendarEventDetails } from "../lib/notifications/calendar/create-event";

test("full-day approved PTO requests become all-day events with exclusive end date", () => {
  const event = buildApprovedPtoCalendarEventDetails({
    employeeName: "Taylor Jordan",
    leaveType: "PTO",
    startDate: new Date("2026-04-06T00:00:00.000Z"),
    endDate: new Date("2026-04-07T00:00:00.000Z"),
    hours: 16,
    requestId: "req-1",
    approverName: "Sarah Manager",
  });

  assert.equal(event.isAllDay, true);
  assert.equal(event.subject, "PTO - Taylor Jordan");
  assert.deepEqual(event.start, { date: "2026-04-06" });
  assert.deepEqual(event.end, { date: "2026-04-08" });
  assert.match(event.body, /Request ID: req-1/);
  assert.match(event.body, /Approved by: Sarah Manager/);
});

test("single-day partial PTO requests become timed events", () => {
  const event = buildApprovedPtoCalendarEventDetails({
    employeeName: "Taylor Jordan",
    leaveType: "PTO",
    startDate: new Date("2026-04-06T00:00:00.000Z"),
    endDate: new Date("2026-04-06T00:00:00.000Z"),
    hours: 4,
    requestId: "req-2",
  });

  assert.equal(event.isAllDay, false);
  assert.deepEqual(event.start, {
    dateTime: "2026-04-06T09:00:00",
    timeZone: "Central Standard Time",
  });
  assert.deepEqual(event.end, {
    dateTime: "2026-04-06T13:00:00",
    timeZone: "Central Standard Time",
  });
});
