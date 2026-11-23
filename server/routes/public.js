import express from "express";
import { getPublicSchedule } from "../services/publishedScheduleService.js";
import {
  isSchedulePasswordConfigured,
  passwordMatches,
  signScheduleAccessToken,
  verifyScheduleAccessToken,
} from "../lib/scheduleAccess.js";

const router = express.Router();

const NOT_CONFIGURED = "סיסמת הסידור אינה מוגדרת";
const WRONG_PASSWORD = "סיסמה שגויה";
const ACCESS_REQUIRED = "נדרשת סיסמה";

router.post("/schedule-access", (req, res) => {
  if (!isSchedulePasswordConfigured()) {
    return res.status(503).json({ message: NOT_CONFIGURED });
  }
  const password = req.body?.password;
  if (typeof password !== "string" || !passwordMatches(password)) {
    return res.status(401).json({ message: WRONG_PASSWORD });
  }
  return res.json({ token: signScheduleAccessToken() });
});

function requireScheduleAccess(req, res, next) {
  if (!isSchedulePasswordConfigured()) {
    return res.status(503).json({ message: NOT_CONFIGURED });
  }
  const token = req.get("X-Schedule-Access");
  if (!verifyScheduleAccessToken(token)) {
    return res.status(401).json({ message: ACCESS_REQUIRED });
  }
  return next();
}

/** Latest visible published schedule. Requires the shared schedule token. */
router.get("/schedule", requireScheduleAccess, async (req, res, next) => {
  try {
    const doc = await getPublicSchedule();
    res.set("Cache-Control", "no-store");
    res.json(doc);
  } catch (error) {
    next(error);
  }
});

export default router;
