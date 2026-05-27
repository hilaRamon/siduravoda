import express from "express";
import { getModel } from "../models/index.js";
import { hashPassword, verifyPassword, generateTemporaryPassword } from "../lib/password.js";
import { signToken } from "../lib/jwt.js";
import { levelToFields, sanitizeUser } from "../config/permissions.js";
import { attachUser, requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.use(attachUser);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEnvAdmin() {
  return {
    email: (process.env.ADMIN_EMAIL || "").trim().toLowerCase(),
    password: process.env.ADMIN_PASSWORD || "",
    fullName: process.env.ADMIN_NAME || "מנהל מערכת",
  };
}

/**
 * Returns true if the request comes from the env-defined admin.
 * req.user has already been validated against the DB at this point;
 * we additionally verify the email matches the env.
 */
function callerIsEnvAdmin(req) {
  if (!req.user || req.user.role !== "admin") return false;
  const { email } = getEnvAdmin();
  return email && req.user.email === email;
}

function isUserLike(req) {
  return req.user?.role === "user";
}

function getAllowedInviteLevels(req) {
  if (callerIsEnvAdmin(req)) return new Set(["user", "reporter"]);
  if (isUserLike(req)) return new Set(["reporter"]);
  return new Set();
}

function isReporterAccount(userDoc) {
  return userDoc?.role === "user" && userDoc?.can_report_time === true;
}

function canManageTargetUser(req, target) {
  const envAdmin = getEnvAdmin();
  if (!target || target.email === envAdmin.email || target.role === "admin") {
    return false;
  }
  if (callerIsEnvAdmin(req)) return true;
  if (isUserLike(req)) return isReporterAccount(target);
  return false;
}

// ─── Login ────────────────────────────────────────────────────────────────────

router.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const envAdmin = getEnvAdmin();

    // Admin auth: credentials come directly from env, no DB lookup needed
    if (email === envAdmin.email) {
      if (password !== envAdmin.password) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Ensure the admin DB record exists (created on first login if missing)
      const User = getModel("User");
      let adminDoc = await User.findOne({ email }).select("+password_hash");
      if (!adminDoc) {
        adminDoc = await User.create({
          email,
          password_hash: await hashPassword(password),
          full_name: envAdmin.fullName,
          role: "admin",
          can_report_time: false,
          can_view_time_reports: true,
          is_active: true,
        });
      }

      const token = signToken({ sub: adminDoc.id, role: "admin" });
      return res.json({ token, user: sanitizeUser(adminDoc) });
    }

    // Regular user auth: check DB
    const User = getModel("User");
    const user = await User.findOne({ email }).select("+password_hash");

    if (!user || user.is_active === false) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Prevent logging in as admin via DB if not the env admin
    if (user.role === "admin") {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = signToken({ sub: user.id, role: user.role });
    return res.json({ token, user: sanitizeUser(user) });
  } catch (error) {
    return next(error);
  }
});

// ─── Logout ───────────────────────────────────────────────────────────────────

router.post("/logout", (_req, res) => {
  res.json({ ok: true });
});

// ─── Me ───────────────────────────────────────────────────────────────────────

router.get("/me", requireAuth, (req, res) => {
  res.json(req.user);
});

router.get("/users", requireAuth, async (req, res, next) => {
  try {
    const User = getModel("User");
    const docs = await User.find().sort({ created_date: -1 }).exec();
    const manageable = docs
      .filter((u) => canManageTargetUser(req, u))
      .map((u) => sanitizeUser(u));
    res.json(manageable);
  } catch (error) {
    next(error);
  }
});

// ─── Invite ───────────────────────────────────────────────────────────────────
//
// Admin can invite: user | reporter
// Regular user (role=user) can invite: reporter only
// Nobody else can invite.

router.post("/invite", requireAuth, async (req, res, next) => {
  try {
    const allowedLevels = getAllowedInviteLevels(req);
    if (allowedLevels.size === 0) {
      return res.status(403).json({ message: "You don't have permission to invite users" });
    }

    const email = String(req.body.email || "").trim().toLowerCase();
    const fullName = String(req.body.full_name || "").trim();
    const requestedLevel = req.body.level || "reporter";

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    if (!allowedLevels.has(requestedLevel)) {
      return res.status(403).json({ message: "You cannot create this user level" });
    }

    // Prevent overwriting the env admin
    const envAdmin = getEnvAdmin();
    if (email === envAdmin.email) {
      return res.status(409).json({ message: "This email is reserved for the system administrator" });
    }

    const User = getModel("User");
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "A user with this email already exists" });
    }

    const temporaryPassword = generateTemporaryPassword();
    const fields = levelToFields(requestedLevel);

    const user = await User.create({
      email,
      full_name: fullName,
      password_hash: await hashPassword(temporaryPassword),
      ...fields,
      is_active: true,
    });

    return res.status(201).json({
      user: sanitizeUser(user),
      temporaryPassword,
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/users/:id", requireAuth, async (req, res, next) => {
  try {
    const User = getModel("User");
    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!canManageTargetUser(req, target)) {
      return res.status(403).json({ message: "You cannot edit this user" });
    }

    // Level transitions are constrained by what caller can create
    const allowedLevels = getAllowedInviteLevels(req);
    if (req.body.level && !allowedLevels.has(req.body.level)) {
      return res.status(403).json({ message: "You cannot set this user level" });
    }

    const allowed = ["full_name", "is_active"];
    const payload = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) payload[key] = req.body[key];
    }
    if (req.body.level) {
      Object.assign(payload, levelToFields(req.body.level));
    }

    if (!callerIsEnvAdmin(req)) {
      // User-level managers cannot grant report-view privileges
      payload.can_view_time_reports = false;
    }

    const doc = await User.findByIdAndUpdate(req.params.id, payload, {
      returnDocument: "after",
      runValidators: true,
    });

    return res.json(sanitizeUser(doc));
  } catch (error) {
    return next(error);
  }
});

router.delete("/users/:id", requireAuth, async (req, res, next) => {
  try {
    const User = getModel("User");
    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!canManageTargetUser(req, target)) {
      return res.status(403).json({ message: "You cannot delete this user" });
    }

    await User.findByIdAndDelete(req.params.id);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

// ─── Update own profile ───────────────────────────────────────────────────────

router.patch("/me", requireAuth, async (req, res, next) => {
  try {
    const User = getModel("User");
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const hasFullName = req.body.full_name !== undefined;
    const hasEmail = req.body.email !== undefined;
    if (!hasFullName && !hasEmail) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    if (hasFullName) {
      user.full_name = String(req.body.full_name || "").trim();
    }

    if (hasEmail) {
      const email = String(req.body.email || "").trim().toLowerCase();
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Env-admin email is fixed
      if (callerIsEnvAdmin(req)) {
        return res.status(403).json({ message: "Admin email is managed via server environment config" });
      }

      const envAdmin = getEnvAdmin();
      if (email === envAdmin.email) {
        return res.status(409).json({ message: "This email is reserved for the system administrator" });
      }

      const existing = await User.findOne({ email });
      if (existing && String(existing._id) !== String(user._id)) {
        return res.status(409).json({ message: "A user with this email already exists" });
      }

      user.email = email;
    }

    await user.save();
    return res.json(sanitizeUser(user));
  } catch (error) {
    return next(error);
  }
});

// ─── Change own password ──────────────────────────────────────────────────────

router.patch("/me/password", requireAuth, async (req, res, next) => {
  try {
    // Admin password lives in env — cannot be changed via API
    if (callerIsEnvAdmin(req)) {
      return res.status(403).json({
        message: "The admin password is managed via server environment config (ADMIN_PASSWORD)",
      });
    }

    const currentPassword = String(req.body.current_password || "");
    const newPassword = String(req.body.new_password || "");

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const User = getModel("User");
    const user = await User.findById(req.user.id).select("+password_hash");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const valid = await verifyPassword(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    user.password_hash = await hashPassword(newPassword);
    await user.save();

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

export default router;
