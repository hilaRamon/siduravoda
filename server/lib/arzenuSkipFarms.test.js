import test from "node:test";
import assert from "node:assert/strict";
import {
  ARZENU_SKIP_FARM_FIELD,
  resolveArzenuSkipFarms,
} from "./arzenuSkipFarms.js";

const farms = [
  { id: "aaaaaaaaaaaaaaaaaaaaaaaa", name: "ללא חיוב" },
  { id: "bbbbbbbbbbbbbbbbbbbbbbbb", name: "לא עובד" },
  { id: "cccccccccccccccccccccccc", name: "מטע" },
];

test("a missing list resolves the seed farm names to ids", () => {
  const resolved = resolveArzenuSkipFarms(null, farms);
  assert.equal(resolved.changed, true);
  assert.deepEqual(resolved.ids, [
    "aaaaaaaaaaaaaaaaaaaaaaaa",
    "bbbbbbbbbbbbbbbbbbbbbbbb",
  ]);
  assert.deepEqual(resolved.stored[ARZENU_SKIP_FARM_FIELD], resolved.ids);
});

test("a saved empty list stays empty", () => {
  const resolved = resolveArzenuSkipFarms({ [ARZENU_SKIP_FARM_FIELD]: [] }, farms);
  assert.equal(resolved.changed, false);
  assert.deepEqual(resolved.ids, []);
});

test("a saved name becomes every matching farm id, and an unknown name is dropped", () => {
  const resolved = resolveArzenuSkipFarms({
    [ARZENU_SKIP_FARM_FIELD]: ["ללא חיוב", "אין משק"],
  }, farms);
  assert.equal(resolved.changed, true);
  assert.deepEqual(resolved.ids, ["aaaaaaaaaaaaaaaaaaaaaaaa"]);
});

test("a saved id is stored in lowercase", () => {
  const resolved = resolveArzenuSkipFarms({
    [ARZENU_SKIP_FARM_FIELD]: ["AAAAAAAAAAAAAAAAAAAAAAAA", "BBBBBBBBBBBBBBBBBBBBBBBB"],
  }, farms);
  assert.equal(resolved.changed, true);
  assert.deepEqual(resolved.ids, [
    "aaaaaaaaaaaaaaaaaaaaaaaa",
    "bbbbbbbbbbbbbbbbbbbbbbbb",
  ]);
});

test("a deleted farm id stays and is not written again", () => {
  const deletedId = "999999999999999999999999";
  const resolved = resolveArzenuSkipFarms({
    [ARZENU_SKIP_FARM_FIELD]: [deletedId, "bbbbbbbbbbbbbbbbbbbbbbbb"],
  }, farms);
  assert.equal(resolved.changed, false);
  assert.deepEqual(resolved.ids, [deletedId, "bbbbbbbbbbbbbbbbbbbbbbbb"]);
});
