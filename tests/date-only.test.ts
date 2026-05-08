import test from "node:test";
import assert from "node:assert/strict";

import {
  dateToDateOnlyString,
  formatDateOnlyForDisplay,
  parseDateOnly,
} from "../lib/date-only";

test("parseDateOnly creates a local date for the exact requested day", () => {
  const parsed = parseDateOnly("2026-05-08");

  assert.ok(parsed);
  assert.equal(parsed?.getFullYear(), 2026);
  assert.equal(parsed?.getMonth(), 4);
  assert.equal(parsed?.getDate(), 8);
});

test("dateToDateOnlyString preserves the stored PTO day for ISO timestamps", () => {
  const stored = new Date("2026-05-08T00:00:00.000Z");

  assert.equal(dateToDateOnlyString(stored), "2026-05-08");
});

test("formatDateOnlyForDisplay does not shift a PTO day backward", () => {
  assert.equal(formatDateOnlyForDisplay("2026-05-08"), "5/8/2026");
  assert.equal(
    formatDateOnlyForDisplay("2026-05-08T00:00:00.000Z"),
    "5/8/2026"
  );
});
