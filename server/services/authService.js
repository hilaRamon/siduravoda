import { OAuth2Client } from "google-auth-library";
import {
  hashPassword,
  verifyPassword,
  generateTemporaryPassword,
} from "../lib/password.js";
import { signToken } from "../lib/jwt.js";
import {
  sanitizeUser,
  isRegularUser,
  getAllowedInviteRoles,
  ROLES,
} from "../config/permissions.js";
import { hydrateUser } from "./permissionRuleService.js";
import {
  createRememberToken,
  findValidRememberToken,
  findValidRememberTokens,
  revokeAllRememberTokensForUser,
  slideRememberToken,
} from "../lib/rememberMe.js";
import * as userRepository from "../repositories/userRepository.js";

export class AuthError extends Error {
  constructor(message, status = 400, code) {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.code = code;
  }
}

function getEnvAdmin() {
  return {
    email: (process.env.ADMIN_EMAIL || "").trim().toLowerCase(),
    password: process.env.ADMIN_PASSWORD || "",
    fullName: process.env.ADMIN_NAME || "מנהל מערכת",
  };
}

function callerIsEnvAdmin(actor) {
  if (!actor || actor.role !== "admin") return false;
  const { email } = getEnvAdmin();
  return email && actor.email === email;
}

function resolveRequestedRole(body) {
  return body?.role || body?.level || ROLES.REPORTER;
}

function canManageTargetUser(actor, target) {
  const envAdmin = getEnvAdmin();
  if (!target || target.email === envAdmin.email || target.role === "admin") {
    return false;
  }
  if (callerIsEnvAdmin(actor)) return true;
  if (isRegularUser(actor)) {
    return (
      target.role === ROLES.REPORTER || target.role === ROLES.WORKPLACE_MANAGER
    );
  }
  return false;
}

function userCanSignIn(user, envAdmin) {
  if (!user || user.is_active === false) return false;
  if (user.role === "admin" && user.email !== envAdmin.email) return false;
  return true;
}

async function toClientUser(doc) {
  return hydrateUser(sanitizeUser(doc));
}

async function sessionFor(user, { rememberMe = false, entries = [] } = {}) {
  const rememberCookie = rememberMe
    ? await createRememberToken(user.id, entries)
    : null;
  return {
    token: signToken({ sub: user.id, role: user.role }),
    user: await toClientUser(user),
    rememberCookie,
  };
}

export async function listLoginEmails() {
  const docs = await userRepository.listActiveEmails();
  const emails = new Set(
    docs.map((d) => String(d.email || "").trim().toLowerCase()).filter(Boolean),
  );
  const envAdminEmail = getEnvAdmin().email;
  if (envAdminEmail) emails.add(envAdminEmail);
  return [...emails].sort();
}

export async function autoLogin({ email, entries }) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) {
    throw new AuthError("Email is required", 400, "not_remembered");
  }

  const user = await userRepository.findByEmail(normalized);
  if (!user || user.is_active === false) {
    throw new AuthError(
      "Not remembered on this device",
      401,
      "not_remembered",
    );
  }

  const envAdmin = getEnvAdmin();
  if (user.role === "admin" && normalized !== envAdmin.email) {
    throw new AuthError(
      "Not remembered on this device",
      401,
      "not_remembered",
    );
  }

  const match = await findValidRememberToken(user.id, entries);
  if (!match) {
    throw new AuthError(
      "Not remembered on this device",
      401,
      "not_remembered",
    );
  }

  await slideRememberToken(match.doc, { force: true });
  return {
    token: signToken({ sub: user.id, role: user.role }),
    user: await toClientUser(user),
    rememberCookie: entries,
  };
}

export function googleClientId() {
  const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
  return { clientId: clientId || null };
}

export async function loginWithGoogle({ credential, rememberMe, entries }) {
  const token = String(credential || "").trim();
  if (!token) {
    throw new AuthError("Google credential is required", 400);
  }

  const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
  if (!clientId) {
    throw new AuthError("Google sign-in is not configured", 500);
  }

  let email = "";
  try {
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: clientId,
    });
    const payload = ticket.getPayload() || {};
    email = String(payload.email || "").trim().toLowerCase();
    const verified =
      payload.email_verified === true || payload.email_verified === "true";
    if (!email || !verified) {
      throw new AuthError("Google account email is not verified", 401);
    }
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError("Invalid Google credential", 401);
  }

  const user = await userRepository.findByEmail(email);
  if (!userCanSignIn(user, getEnvAdmin())) {
    throw new AuthError(
      "No account exists for this Google email",
      403,
      "google_user_not_found",
    );
  }

  return sessionFor(user, { rememberMe: Boolean(rememberMe), entries });
}

export async function rememberedSession({ entries }) {
  const matches = await findValidRememberTokens(entries);
  if (!matches.length) {
    throw new AuthError(
      "Not remembered on this device",
      401,
      "not_remembered",
    );
  }

  const envAdmin = getEnvAdmin();
  const usersById = new Map();

  for (const match of matches) {
    const userId = String(match.doc.userId);
    if (usersById.has(userId)) continue;
    const user = await userRepository.findById(match.doc.userId);
    if (!userCanSignIn(user, envAdmin)) continue;
    usersById.set(userId, { user, match });
  }

  if (usersById.size === 0) {
    throw new AuthError(
      "Not remembered on this device",
      401,
      "not_remembered",
    );
  }
  if (usersById.size > 1) {
    throw new AuthError("Choose an account", 401, "choose_account");
  }

  const { user, match } = [...usersById.values()][0];
  await slideRememberToken(match.doc, { force: true });
  return {
    token: signToken({ sub: user.id, role: user.role }),
    user: await toClientUser(user),
    rememberCookie: entries,
  };
}

export async function login({ email, password, rememberMe, entries }) {
  const normalized = String(email || "").trim().toLowerCase();
  const rawPassword = String(password || "");
  if (!normalized || !rawPassword) {
    throw new AuthError("Email and password are required", 400);
  }

  const envAdmin = getEnvAdmin();

  if (normalized === envAdmin.email) {
    if (rawPassword !== envAdmin.password) {
      throw new AuthError("Invalid email or password", 401);
    }

    let adminDoc = await userRepository.findByEmail(normalized, {
      withPassword: true,
    });
    if (!adminDoc) {
      adminDoc = await userRepository.create({
        email: normalized,
        password_hash: await hashPassword(rawPassword),
        full_name: envAdmin.fullName,
        role: ROLES.ADMIN,
        is_active: true,
      });
    } else if (adminDoc.role !== ROLES.ADMIN) {
      adminDoc.role = ROLES.ADMIN;
      await adminDoc.save();
    }

    const session = await sessionFor(adminDoc, {
      rememberMe: Boolean(rememberMe),
      entries,
    });
    session.token = signToken({ sub: adminDoc.id, role: ROLES.ADMIN });
    return session;
  }

  const user = await userRepository.findByEmail(normalized, {
    withPassword: true,
  });
  if (!user || user.is_active === false || user.role === "admin") {
    throw new AuthError("Invalid email or password", 401);
  }

  const valid = await verifyPassword(rawPassword, user.password_hash);
  if (!valid) {
    throw new AuthError("Invalid email or password", 401);
  }

  return sessionFor(user, { rememberMe: Boolean(rememberMe), entries });
}

export async function listUsers(actor) {
  const docs = await userRepository.listAll();
  const manageable = [];
  for (const user of docs) {
    if (!canManageTargetUser(actor, user)) continue;
    manageable.push(await toClientUser(user));
  }
  return manageable;
}

export async function inviteUser(actor, body = {}) {
  const allowedRoles = getAllowedInviteRoles(actor);
  if (allowedRoles.size === 0) {
    throw new AuthError("You don't have permission to invite users", 403);
  }

  const email = String(body.email || "").trim().toLowerCase();
  const fullName = String(body.full_name || "").trim();
  const requestedRole = resolveRequestedRole(body);

  if (!email) {
    throw new AuthError("Email is required", 400);
  }
  if (!allowedRoles.has(requestedRole)) {
    throw new AuthError("You cannot create this user level", 403);
  }

  const envAdmin = getEnvAdmin();
  if (email === envAdmin.email) {
    throw new AuthError(
      "This email is reserved for the system administrator",
      409,
    );
  }

  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw new AuthError("A user with this email already exists", 409);
  }

  const temporaryPassword = generateTemporaryPassword();
  const user = await userRepository.create({
    email,
    full_name: fullName,
    password_hash: await hashPassword(temporaryPassword),
    role: requestedRole,
    is_active: true,
  });

  return {
    user: await toClientUser(user),
    temporaryPassword,
  };
}

export async function updateUser(actor, id, body = {}) {
  const target = await userRepository.findById(id);
  if (!target) {
    throw new AuthError("User not found", 404);
  }
  if (!canManageTargetUser(actor, target)) {
    throw new AuthError("You cannot edit this user", 403);
  }

  const allowedRoles = getAllowedInviteRoles(actor);
  const requestedRole = body.role || body.level;
  if (requestedRole && !allowedRoles.has(requestedRole)) {
    throw new AuthError("You cannot set this user level", 403);
  }

  const payload = {};
  for (const key of ["full_name", "is_active"]) {
    if (body[key] !== undefined) payload[key] = body[key];
  }
  if (requestedRole) payload.role = requestedRole;

  const doc = await userRepository.updateById(id, payload);
  return toClientUser(doc);
}

export async function deleteUser(actor, id) {
  const target = await userRepository.findById(id);
  if (!target) {
    throw new AuthError("User not found", 404);
  }
  if (!canManageTargetUser(actor, target)) {
    throw new AuthError("You cannot delete this user", 403);
  }

  await userRepository.deleteById(id);
  await revokeAllRememberTokensForUser(id);
}

export async function setUserPassword(actor, id, password) {
  const target = await userRepository.findById(id, { withPassword: true });
  if (!target) {
    throw new AuthError("User not found", 404);
  }
  if (!canManageTargetUser(actor, target)) {
    throw new AuthError("You cannot set this user's password", 403);
  }

  const nextPassword = String(password || "");
  if (!nextPassword || nextPassword.length < 4) {
    throw new AuthError("Password must be at least 4 characters", 400);
  }

  target.password_hash = await hashPassword(nextPassword);
  await target.save();
  await revokeAllRememberTokensForUser(target.id);
  return { ok: true };
}

export async function updateMe(actor, body = {}) {
  const user = await userRepository.findById(actor.id);
  if (!user) {
    throw new AuthError("User not found", 404);
  }

  const hasFullName = body.full_name !== undefined;
  const hasEmail = body.email !== undefined;
  if (!hasFullName && !hasEmail) {
    throw new AuthError("No valid fields to update", 400);
  }

  if (hasFullName) {
    user.full_name = String(body.full_name || "").trim();
  }

  if (hasEmail) {
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) {
      throw new AuthError("Email is required", 400);
    }
    if (callerIsEnvAdmin(actor)) {
      throw new AuthError(
        "Admin email is managed via server environment config",
        403,
      );
    }

    const envAdmin = getEnvAdmin();
    if (email === envAdmin.email) {
      throw new AuthError(
        "This email is reserved for the system administrator",
        409,
      );
    }

    const existing = await userRepository.findByEmail(email);
    if (existing && String(existing._id) !== String(user._id)) {
      throw new AuthError("A user with this email already exists", 409);
    }
    user.email = email;
  }

  await user.save();
  return toClientUser(user);
}

export async function changePassword(actor, currentPassword, newPassword) {
  if (callerIsEnvAdmin(actor)) {
    throw new AuthError(
      "The admin password is managed via server environment config (ADMIN_PASSWORD)",
      403,
    );
  }

  const nextPassword = String(newPassword || "");
  if (!nextPassword || nextPassword.length < 6) {
    throw new AuthError("Password must be at least 6 characters", 400);
  }

  const user = await userRepository.findById(actor.id, { withPassword: true });
  if (!user) {
    throw new AuthError("User not found", 404);
  }

  const valid = await verifyPassword(String(currentPassword || ""), user.password_hash);
  if (!valid) {
    throw new AuthError("Current password is incorrect", 401);
  }

  user.password_hash = await hashPassword(nextPassword);
  await user.save();
  await revokeAllRememberTokensForUser(user.id);
  return { ok: true };
}
