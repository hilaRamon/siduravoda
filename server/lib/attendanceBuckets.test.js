import test from "node:test";
import assert from "node:assert/strict";
import {
  ATTENDANCE_FIELD_BY_KEY,
  attendanceAbsentPercent,
  classifyAttendanceWorkplace,
  resolveAttendanceBuckets,
} from "./attendanceBuckets.js";

const workplaces = [
  { id: "aaaaaaaaaaaaaaaaaaaaaaaa", name: "לא יצא" },
  { id: "bbbbbbbbbbbbbbbbbbbbbbbb", name: "לא עובד" },
  { id: "cccccccccccccccccccccccc", name: "תתת - לא עובד" },
  { id: "dddddddddddddddddddddddd", name: "תתת - לא עובד, פנימיה" },
  { id: "eeeeeeeeeeeeeeeeeeeeeeee", name: "לימודים" },
  { id: "ffffffffffffffffffffffff", name: "אאא- לפני שיבוץ" },
  { id: "111111111111111111111111", name: "מטע" },
  { id: "222222222222222222222222", name: "לימודים" },
];

test("a missing settings document resolves the seed names to ids and asks to save them", () => {
  const resolved = resolveAttendanceBuckets(null, workplaces);
  assert.equal(resolved.changed, true);
  assert.deepEqual(resolved.buckets.didNotLeave, ["aaaaaaaaaaaaaaaaaaaaaaaa"]);
  assert.deepEqual(resolved.buckets.didNotWork, [
    "bbbbbbbbbbbbbbbbbbbbbbbb",
    "cccccccccccccccccccccccc",
    "dddddddddddddddddddddddd",
  ]);
  assert.deepEqual(resolved.buckets.studies, [
    "eeeeeeeeeeeeeeeeeeeeeeee",
    "222222222222222222222222",
  ]);
  assert.deepEqual(resolved.stored[ATTENDANCE_FIELD_BY_KEY.didNotLeave], resolved.buckets.didNotLeave);
  assert.deepEqual(resolved.notAssignedIds, ["ffffffffffffffffffffffff"]);
});

test("a saved empty list stays empty, and a missing column is still seeded", () => {
  const resolved = resolveAttendanceBuckets({
    attendance_did_not_leave: [],
    attendance_studies: ["eeeeeeeeeeeeeeeeeeeeeeee"],
  }, workplaces);
  assert.equal(resolved.changed, true);
  assert.deepEqual(resolved.buckets.didNotLeave, []);
  assert.deepEqual(resolved.buckets.didNotWork, [
    "bbbbbbbbbbbbbbbbbbbbbbbb",
    "cccccccccccccccccccccccc",
    "dddddddddddddddddddddddd",
  ]);
  assert.deepEqual(resolved.buckets.studies, ["eeeeeeeeeeeeeeeeeeeeeeee"]);
});

test("saved ids are kept, including a deleted workplace, and are not written again", () => {
  const deletedId = "999999999999999999999999";
  const resolved = resolveAttendanceBuckets({
    attendance_did_not_leave: [deletedId],
    attendance_did_not_work: ["bbbbbbbbbbbbbbbbbbbbbbbb"],
    attendance_studies: [],
  }, workplaces);
  assert.equal(resolved.changed, false);
  assert.deepEqual(resolved.buckets.didNotLeave, [deletedId]);
  assert.deepEqual(resolved.buckets.didNotWork, ["bbbbbbbbbbbbbbbbbbbbbbbb"]);
  assert.deepEqual(resolved.buckets.studies, []);
});

test("a saved name is converted to every matching id, and an unknown name is dropped", () => {
  const resolved = resolveAttendanceBuckets({
    attendance_did_not_leave: ["  לא יצא  "],
    attendance_did_not_work: ["אין מקום כזה"],
    attendance_studies: ["לימודים"],
  }, workplaces);
  assert.equal(resolved.changed, true);
  assert.deepEqual(resolved.buckets.didNotLeave, ["aaaaaaaaaaaaaaaaaaaaaaaa"]);
  assert.deepEqual(resolved.buckets.didNotWork, []);
  assert.deepEqual(resolved.buckets.studies, [
    "eeeeeeeeeeeeeeeeeeeeeeee",
    "222222222222222222222222",
  ]);
});

test("an id in two lists stays in the earlier column and is removed from the later one", () => {
  const shared = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const resolved = resolveAttendanceBuckets({
    attendance_did_not_leave: [shared, "eeeeeeeeeeeeeeeeeeeeeeee"],
    attendance_did_not_work: [shared, "bbbbbbbbbbbbbbbbbbbbbbbb"],
    attendance_studies: ["eeeeeeeeeeeeeeeeeeeeeeee"],
  }, workplaces);
  assert.equal(resolved.changed, true);
  assert.deepEqual(resolved.buckets.didNotLeave, [shared, "eeeeeeeeeeeeeeeeeeeeeeee"]);
  assert.deepEqual(resolved.buckets.didNotWork, ["bbbbbbbbbbbbbbbbbbbbbbbb"]);
  assert.deepEqual(resolved.buckets.studies, []);
  const { buckets, notAssignedIds } = resolved;
  assert.equal(classifyAttendanceWorkplace("eeeeeeeeeeeeeeeeeeeeeeee", buckets, notAssignedIds), "didNotLeave");
  assert.equal(classifyAttendanceWorkplace("bbbbbbbbbbbbbbbbbbbbbbbb", buckets, notAssignedIds), "didNotWork");
  assert.equal(classifyAttendanceWorkplace("222222222222222222222222", buckets, notAssignedIds), "worked");
});

test("classification uses the workplace id and skips לפני שיבוץ", () => {
  const resolved = resolveAttendanceBuckets({
    attendance_did_not_leave: ["aaaaaaaaaaaaaaaaaaaaaaaa"],
    attendance_did_not_work: ["ffffffffffffffffffffffff", "bbbbbbbbbbbbbbbbbbbbbbbb"],
    attendance_studies: ["eeeeeeeeeeeeeeeeeeeeeeee"],
  }, workplaces);
  const { buckets, notAssignedIds } = resolved;
  assert.equal(resolved.changed, true);
  assert.deepEqual(resolved.buckets.didNotWork, ["bbbbbbbbbbbbbbbbbbbbbbbb"]);
  assert.equal(classifyAttendanceWorkplace("ffffffffffffffffffffffff", buckets, notAssignedIds), null);
  assert.equal(classifyAttendanceWorkplace("111111111111111111111111", buckets, notAssignedIds), "worked");
  assert.equal(classifyAttendanceWorkplace("  ", buckets, notAssignedIds), null);
  assert.equal(classifyAttendanceWorkplace(undefined, buckets, notAssignedIds), null);
});

test("absent percent is the non-work days over assigned days, without studies in the numerator", () => {
  assert.equal(attendanceAbsentPercent(1, 0, 3), 33);
  assert.equal(attendanceAbsentPercent(1, 1, 4), 50);
  assert.equal(attendanceAbsentPercent(0, 0, 5), 0);
  assert.equal(attendanceAbsentPercent(2, 0, 0), 0);
});
