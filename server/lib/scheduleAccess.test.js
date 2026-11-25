import test from "node:test";
import assert from "node:assert/strict";
import {
  isSchedulePasswordConfigured,
  passwordMatches,
  signScheduleAccessToken,
  verifyScheduleAccessToken,
} from "./scheduleAccess.js";

function withPassword(password, fn) {
  const previous = process.env.SCHEDULE_PASSWORD;
  if (password === undefined) delete process.env.SCHEDULE_PASSWORD;
  else process.env.SCHEDULE_PASSWORD = password;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.SCHEDULE_PASSWORD;
    else process.env.SCHEDULE_PASSWORD = previous;
  }
}

test("password match and mismatch", () => {
  withPassword("secret-pass", () => {
    assert.equal(passwordMatches("secret-pass"), true);
    assert.equal(passwordMatches("other"), false);
    assert.equal(passwordMatches(""), false);
    assert.equal(passwordMatches(undefined), false);
  });
});

test("signed token verifies and a bad signature does not", () => {
  withPassword("secret-pass", () => {
    const token = signScheduleAccessToken();
    assert.equal(typeof token, "string");
    assert.equal(verifyScheduleAccessToken(token), true);

    const flipped = token.endsWith("a") ? "b" : "a";
    const bad = `${token.slice(0, -1)}${flipped}`;
    assert.equal(verifyScheduleAccessToken(bad), false);
    assert.equal(verifyScheduleAccessToken("nope"), false);
    assert.equal(verifyScheduleAccessToken(""), false);
  });
});

test("changing the password invalidates a saved token", () => {
  const token = withPassword("secret-pass", () => signScheduleAccessToken());
  withPassword("new-pass", () => {
    assert.equal(verifyScheduleAccessToken(token), false);
    assert.equal(passwordMatches("secret-pass"), false);
    assert.equal(passwordMatches("new-pass"), true);
  });
});

test("missing password does not sign or verify", () => {
  withPassword(undefined, () => {
    assert.equal(isSchedulePasswordConfigured(), false);
    assert.equal(signScheduleAccessToken(), null);
    assert.equal(verifyScheduleAccessToken("anything"), false);
    assert.equal(passwordMatches("anything"), false);
  });
});
