import test from "node:test";
import assert from "node:assert/strict";
import {
  CloneWorkplaceError,
  NOT_WORKING_WORKPLACE_NAME,
  PRE_ASSIGNMENT_WORKPLACE_NAME,
  decideCloneWorkplace,
} from "./cloneWorkplaceDecision.js";

const notWorkingWp = { id: "nw-1", name: NOT_WORKING_WORKPLACE_NAME };
const preAssignmentWp = { id: "pa-1", name: PRE_ASSIGNMENT_WORKPLACE_NAME };
const nearWp = { id: "near-1", name: "קרוב" };
const farmWp = { id: "farm-1", name: "משק א" };

const distanceWorkplaceMap = {
  קרוב: nearWp,
  רחוק: { id: "far-1", name: "רחוק" },
  [NOT_WORKING_WORKPLACE_NAME]: notWorkingWp,
  [PRE_ASSIGNMENT_WORKPLACE_NAME]: preAssignmentWp,
};

function decide(overrides = {}) {
  return decideCloneWorkplace({
    src: { workplace_id: farmWp.id, workplace_name: farmWp.name },
    student: { is_active: true, cohort: "א", distance_status: "קרוב" },
    isSunday: false,
    targetDayHeb: "ב",
    isAbsent: false,
    distanceWorkplaceMap,
    notWorkingWp,
    preAssignmentWp,
    ...overrides,
  });
}

test("approved absence assigns לא עובד", () => {
  const result = decide({ isAbsent: true });
  assert.deepEqual(result, notWorkingWp);
});

test("Sunday uses distance-status workplace", () => {
  const result = decide({ isSunday: true });
  assert.deepEqual(result, nearWp);
});

test("Sunday remaps source לא עובד when distance status does not map", () => {
  const result = decide({
    isSunday: true,
    student: { is_active: true, distance_status: "unknown" },
    src: {
      workplace_id: notWorkingWp.id,
      workplace_name: NOT_WORKING_WORKPLACE_NAME,
    },
  });
  assert.deepEqual(result, preAssignmentWp);
});

test("crew free day assigns לא עובד", () => {
  const result = decide({
    student: { is_active: true, cohort: "צוות א", free_day: ["ב"] },
    targetDayHeb: "ב",
  });
  assert.deepEqual(result, notWorkingWp);
});

test("crew non-free weekday is skipped", () => {
  const result = decide({
    student: { is_active: true, cohort: "צוות א", free_day: ["ד"] },
    targetDayHeb: "ב",
  });
  assert.equal(result, null);
});

test("regular weekday remaps לא עובד to לפני שיבוץ", () => {
  const result = decide({
    src: {
      workplace_id: notWorkingWp.id,
      workplace_name: NOT_WORKING_WORKPLACE_NAME,
    },
  });
  assert.deepEqual(result, preAssignmentWp);
});

test("regular weekday copies source workplace", () => {
  const result = decide();
  assert.deepEqual(result, { id: farmWp.id, name: farmWp.name });
});

test("inactive student is skipped", () => {
  const result = decide({ student: { is_active: false } });
  assert.equal(result, null);
});

test("missing לפני שיבוץ workplace throws", () => {
  assert.throws(
    () =>
      decide({
        preAssignmentWp: null,
        src: {
          workplace_id: notWorkingWp.id,
          workplace_name: NOT_WORKING_WORKPLACE_NAME,
        },
      }),
    (error) =>
      error instanceof CloneWorkplaceError &&
      error.message.includes(PRE_ASSIGNMENT_WORKPLACE_NAME),
  );
});
