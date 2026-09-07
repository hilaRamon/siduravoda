import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_END,
  DEFAULT_START,
  calcDuration,
  isCustomHours,
} from "./timeReportHours.js";

test("default 07:00–11:45 is not custom hours", () => {
  assert.equal(
    isCustomHours({ start_time: DEFAULT_START, end_time: DEFAULT_END }),
    false,
  );
});

test("changed start or end is custom hours", () => {
  assert.equal(
    isCustomHours({ start_time: "08:00", end_time: DEFAULT_END }),
    true,
  );
  assert.equal(
    isCustomHours({ start_time: DEFAULT_START, end_time: "12:00" }),
    true,
  );
});

test("default shift duration is 4.75 hours", () => {
  assert.equal(calcDuration(DEFAULT_START, DEFAULT_END), 4.75);
});

test("calcDuration returns null for missing or inverted times", () => {
  assert.equal(calcDuration(null, DEFAULT_END), null);
  assert.equal(calcDuration(DEFAULT_START, "06:00"), null);
  assert.equal(calcDuration("ab:cd", DEFAULT_END), null);
});
