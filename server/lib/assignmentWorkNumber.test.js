import test from "node:test";
import assert from "node:assert/strict";
import {
  assignmentWorkNumber,
  isPrimaryWorkNumber,
  primaryWorkNumberMatch,
} from "./assignmentWorkNumber.js";

test("missing or invalid work_number is 1", () => {
  assert.equal(assignmentWorkNumber(undefined), 1);
  assert.equal(assignmentWorkNumber(null), 1);
  assert.equal(assignmentWorkNumber(1.5), 1);
  assert.equal(assignmentWorkNumber(0), 1);
  assert.equal(assignmentWorkNumber(2), 2);
});

test("isPrimaryWorkNumber treats missing as first work", () => {
  assert.equal(isPrimaryWorkNumber(undefined), true);
  assert.equal(isPrimaryWorkNumber(1), true);
  assert.equal(isPrimaryWorkNumber(2), false);
});

test("primaryWorkNumberMatch excludes work_number greater than 1", () => {
  assert.deepEqual(primaryWorkNumberMatch(), {
    $nor: [{ work_number: { $gt: 1 } }],
  });
});
