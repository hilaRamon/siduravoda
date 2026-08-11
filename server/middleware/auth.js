import { verifyToken } from "../lib/jwt.js";
import { getModel } from "../models/index.js";
import { sanitizeUser } from "../config/permissions.js";
import { hydrateUser } from "../services/permissionRuleService.js";
import {
  findValidRememberToken,
  readRememberEntries,
  setRememberCookie,
  slideRememberToken,
} from "../lib/rememberMe.js";

const AUTH_HEADER = "authorization";
const TOKEN_COOKIE = "auth_token";

export function extractToken(req) {
  const header = req.headers[AUTH_HEADER];
  if (header?.startsWith("Bearer ")) {
    return header.slice(7);
  }
  if (req.cookies?.[TOKEN_COOKIE]) {
    return req.cookies[TOKEN_COOKIE];
  }
  return null;
}

async function maybeSlideRememberToken(req, res, userId) {
  try {
    const entries = readRememberEntries(req);
    if (!entries.length) return;
    const match = await findValidRememberToken(userId, entries);
    if (!match) return;
    const slid = await slideRememberToken(match.doc);
    if (slid) {
      setRememberCookie(res, entries);
    }
  } catch {
    // Sliding is best-effort; never block the request
  }
}

export async function attachUser(req, res, next) {
  req.user = null;
  const token = extractToken(req);
  if (!token) {
    return next();
  }

  try {
    const payload = verifyToken(token);
    const User = getModel("User");
    const doc = await User.findById(payload.sub).select("+password_hash");
    if (!doc || doc.is_active === false) {
      return next();
    }
    req.user = await hydrateUser(sanitizeUser(doc));
    // Fire-and-forget slide; don't delay the response path unnecessarily,
    // but await so Set-Cookie is applied before the response is sent.
    await maybeSlideRememberToken(req, res, doc.id);
    return next();
  } catch {
    return next();
  }
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  return next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  return next();
}
