import express from "express";
import { attachUser, requireAdmin } from "../middleware/auth.js";
import { runWeeklyBackup, sendVerificationBackup } from "../services/backupService.js";

const router = express.Router();

function isCronAuthorized(req) {
  const secret = process.env.BACKUP_CRON_SECRET;
  if (!secret) return false;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7) === secret;
  }

  return false;
}

router.post("/run", attachUser, async (req, res, next) => {
  try {
    const cronOk = isCronAuthorized(req);
    const adminOk = req.user?.role === "admin";

    if (!cronOk && !adminOk) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const result = await runWeeklyBackup();
    const status = result.ok ? 200 : 400;
    return res.status(status).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/verify", attachUser, requireAdmin, async (req, res, next) => {
  try {
    const emails = Array.isArray(req.body.emails) ? req.body.emails : [];
    const result = await sendVerificationBackup(emails);
    return res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
