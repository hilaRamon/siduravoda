import crypto from "crypto";

const TOKEN_PAYLOAD = "schedule-access";

function schedulePassword() {
  const value = process.env.SCHEDULE_PASSWORD;
  return typeof value === "string" ? value : "";
}

export function isSchedulePasswordConfigured() {
  return schedulePassword().length > 0;
}

/** Compare without leaking the password length or contents through timing. */
export function passwordMatches(input) {
  const expected = schedulePassword();
  if (!expected || typeof input !== "string") return false;
  const actualHash = crypto.createHash("sha256").update(input, "utf8").digest();
  const expectedHash = crypto.createHash("sha256").update(expected, "utf8").digest();
  return crypto.timingSafeEqual(actualHash, expectedHash);
}

function signPayload(password) {
  const payload = Buffer.from(TOKEN_PAYLOAD, "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", password).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function signScheduleAccessToken() {
  const password = schedulePassword();
  if (!password) return null;
  return signPayload(password);
}

export function verifyScheduleAccessToken(token) {
  const password = schedulePassword();
  if (!password || typeof token !== "string" || token.length === 0) return false;
  const expected = Buffer.from(signPayload(password));
  const actual = Buffer.from(token);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}
