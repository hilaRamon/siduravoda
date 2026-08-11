import crypto from "crypto";
import RememberToken from "../models/RememberToken.js";

export const REMEMBER_COOKIE = "remember_me";
export const REMEMBER_DAYS = 60;
export const REMEMBER_MAX_AGE_MS = REMEMBER_DAYS * 24 * 60 * 60 * 1000;
const COOKIE_MAX_CHARS = 3500;
const SLIDE_THROTTLE_MS = 24 * 60 * 60 * 1000; // once per day

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function hashValidator(validator) {
  return crypto.createHash("sha256").update(validator).digest("hex");
}

function expiresFromNow() {
  return new Date(Date.now() + REMEMBER_MAX_AGE_MS);
}

export function getRememberCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: REMEMBER_MAX_AGE_MS,
  };
}

/**
 * Parse cookie value into [{ selector, validator }, ...]
 */
export function parseRememberCookie(raw) {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf(":");
      if (idx <= 0) return null;
      const selector = part.slice(0, idx);
      const validator = part.slice(idx + 1);
      if (!selector || !validator) return null;
      return { selector, validator };
    })
    .filter(Boolean);
}

export function serializeRememberCookie(entries) {
  return entries.map((e) => `${e.selector}:${e.validator}`).join("|");
}

/**
 * Drop oldest entries until under size cap (entries are newest-last).
 */
function capCookieEntries(entries) {
  let serialized = serializeRememberCookie(entries);
  while (entries.length > 1 && serialized.length > COOKIE_MAX_CHARS) {
    entries.shift();
    serialized = serializeRememberCookie(entries);
  }
  return entries;
}

export function readRememberEntries(req) {
  return parseRememberCookie(req.cookies?.[REMEMBER_COOKIE]);
}

export function setRememberCookie(res, entries) {
  const capped = capCookieEntries([...entries]);
  if (capped.length === 0) {
    res.clearCookie(REMEMBER_COOKIE, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
    });
    return;
  }
  res.cookie(REMEMBER_COOKIE, serializeRememberCookie(capped), getRememberCookieOptions());
}

/**
 * Create a new remember token for userId. Replaces any selectors already in
 * the cookie that belong to the same user. Returns updated cookie entries.
 */
export async function createRememberToken(userId, existingEntries = []) {
  const selector = randomToken(18);
  const validator = randomToken(32);
  const now = new Date();

  // Remove prior cookie entries that map to this user (we'll replace them)
  const selectors = existingEntries.map((e) => e.selector);
  let keptEntries = existingEntries;
  if (selectors.length) {
    const owned = await RememberToken.find({
      selector: { $in: selectors },
      userId,
    })
      .select("selector")
      .lean();
    const ownedSet = new Set(owned.map((d) => d.selector));
    if (ownedSet.size) {
      await RememberToken.deleteMany({ selector: { $in: [...ownedSet] } });
      keptEntries = existingEntries.filter((e) => !ownedSet.has(e.selector));
    }
  }

  await RememberToken.create({
    userId,
    selector,
    tokenHash: hashValidator(validator),
    expiresAt: expiresFromNow(),
    lastUsedAt: now,
  });

  return [...keptEntries, { selector, validator }];
}

/**
 * Find a valid remember token for userId among cookie entries.
 * Returns { doc, entry } or null.
 */
export async function findValidRememberToken(userId, entries) {
  if (!entries.length) return null;
  const selectors = entries.map((e) => e.selector);
  const docs = await RememberToken.find({
    selector: { $in: selectors },
    userId,
    expiresAt: { $gt: new Date() },
  }).exec();

  const bySelector = new Map(docs.map((d) => [d.selector, d]));

  for (const entry of entries) {
    const doc = bySelector.get(entry.selector);
    if (!doc) continue;
    const expected = Buffer.from(doc.tokenHash, "hex");
    const actual = Buffer.from(hashValidator(entry.validator), "hex");
    if (
      expected.length === actual.length &&
      crypto.timingSafeEqual(expected, actual)
    ) {
      return { doc, entry };
    }
  }
  return null;
}

/**
 * Slide expiry if last slide was more than SLIDE_THROTTLE_MS ago.
 * Returns true if the cookie maxAge should be refreshed.
 */
export async function slideRememberToken(doc, { force = false } = {}) {
  const now = Date.now();
  const last = doc.lastUsedAt ? new Date(doc.lastUsedAt).getTime() : 0;
  if (!force && now - last < SLIDE_THROTTLE_MS) {
    return false;
  }
  doc.lastUsedAt = new Date(now);
  doc.expiresAt = expiresFromNow();
  await doc.save();
  return true;
}

export async function revokeAllRememberTokensForUser(userId) {
  await RememberToken.deleteMany({ userId });
}

/**
 * Remove stale / invalid cookie entries that no longer exist in DB
 * (optional cleanup). Does not revoke valid tokens.
 */
export async function pruneInvalidCookieEntries(entries) {
  if (!entries.length) return entries;
  const docs = await RememberToken.find({
    selector: { $in: entries.map((e) => e.selector) },
    expiresAt: { $gt: new Date() },
  })
    .select("selector")
    .lean();
  const valid = new Set(docs.map((d) => d.selector));
  return entries.filter((e) => valid.has(e.selector));
}
