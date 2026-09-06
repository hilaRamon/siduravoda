import test from "node:test";
import assert from "node:assert/strict";
import {
  formatDayMonth,
  getScheduleVisibleAt,
  getScheduleVisibleDate,
  isScheduleVisible,
} from "./scheduleVisibility.js";

test("visible-at is 16:00 Israel on the day before the schedule date (summer, UTC+3)", () => {
  const visibleAt = getScheduleVisibleAt("2026-07-15");
  assert.equal(getScheduleVisibleDate("2026-07-15"), "2026-07-14");
  assert.equal(visibleAt.toISOString(), "2026-07-14T13:00:00.000Z");
});

test("visible-at is 16:00 Israel on the day before the schedule date (winter, UTC+2)", () => {
  const visibleAt = getScheduleVisibleAt("2026-01-15");
  assert.equal(visibleAt.toISOString(), "2026-01-14T14:00:00.000Z");
});

test("not visible before 16:00 the day before", () => {
  assert.equal(
    isScheduleVisible("2026-07-15", new Date("2026-07-14T12:59:59.000Z")),
    false,
  );
});

test("visible exactly at 16:00 Israel the day before", () => {
  assert.equal(
    isScheduleVisible("2026-07-15", new Date("2026-07-14T13:00:00.000Z")),
    true,
  );
});

test("visible after 16:00 the day before, including same-day publish", () => {
  assert.equal(
    isScheduleVisible("2026-07-15", new Date("2026-07-15T10:00:00.000Z")),
    true,
  );
});

test("DST spring-forward day: 16:00 Israel is after the 02:00 jump (UTC+3)", () => {
  // Israel DST starts 2026-03-27 02:00 → 03:00. Schedule date 2026-03-28
  // becomes visible 2026-03-27 16:00 IDT = 13:00 UTC.
  assert.equal(
    getScheduleVisibleAt("2026-03-28").toISOString(),
    "2026-03-27T13:00:00.000Z",
  );
});

test("DST fall-back day: 16:00 Israel is after the 02:00 rollback (UTC+2)", () => {
  // Israel DST ends 2026-10-25 02:00. Schedule date 2026-10-26
  // becomes visible 2026-10-25 16:00 IST = 14:00 UTC.
  assert.equal(
    getScheduleVisibleAt("2026-10-26").toISOString(),
    "2026-10-25T14:00:00.000Z",
  );
});

test("formatDayMonth uses DD/MM", () => {
  assert.equal(formatDayMonth("2026-09-08"), "08/09");
});
