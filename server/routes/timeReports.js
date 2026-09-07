import express from "express";
import { canApproveTimeReports } from "../config/permissions.js";
import { attachUser, requireAuth } from "../middleware/auth.js";
import * as timeReportController from "../controllers/timeReportController.js";

const router = express.Router();

router.use(attachUser);
router.use(requireAuth);

function requireApproveAccess(req, res, next) {
  if (!canApproveTimeReports(req.user)) {
    return res.status(403).json({ message: "Time report approve access required" });
  }
  return next();
}

router.post("/bulk-status", requireApproveAccess, timeReportController.bulkStatus);
router.post("/approve-date", requireApproveAccess, timeReportController.approveDate);

export default router;
