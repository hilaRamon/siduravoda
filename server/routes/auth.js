import express from "express";
import { getModel } from "../models/index.js";
import { hashPassword, verifyPassword, generateTemporaryPassword } from "../lib/password.js";
import { signToken } from "../lib/jwt.js";
import { levelToFields, sanitizeUser } from "../config/permissions.js";
import { attachUser, requireAuth, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

router.use(attachUser);

router.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const User = getModel("User");
    const user = await User.findOne({ email }).select("+password_hash");

    if (!user || user.is_active === false) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = signToken({ sub: user.id, role: user.role });
    const safeUser = sanitizeUser(user);

    return res.json({ token, user: safeUser });
  } catch (error) {
    return next(error);
  }
});

router.post("/logout", (_req, res) => {
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  res.json(req.user);
});

router.post("/invite", requireAdmin, async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const fullName = String(req.body.full_name || "").trim();
    const level = req.body.level || "user";

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const User = getModel("User");
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "User with this email already exists" });
    }

    const temporaryPassword = generateTemporaryPassword();
    const fields = levelToFields(level);

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

router.patch("/users/:id", requireAdmin, async (req, res, next) => {
  try {
    const User = getModel("User");
    const allowed = [
      "role",
      "can_report_time",
      "can_view_time_reports",
      "full_name",
      "is_active",
    ];
    const payload = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        payload[key] = req.body[key];
      }
    }

    if (req.body.level) {
      Object.assign(payload, levelToFields(req.body.level));
    }

    if (req.body.password) {
      payload.password_hash = await hashPassword(String(req.body.password));
    }

    const doc = await User.findByIdAndUpdate(req.params.id, payload, {
      returnDocument: "after",
      runValidators: true,
    });

    if (!doc) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(sanitizeUser(doc));
  } catch (error) {
    return next(error);
  }
});

router.patch("/me/password", requireAuth, async (req, res, next) => {
  try {
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
