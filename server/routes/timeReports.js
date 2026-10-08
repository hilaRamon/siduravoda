import express from "express";
import {
  canApproveTimeReports,
  isAdmin,
  isRegularUser,
  isReporterOnly,
} from "../config/permissions.js";
import { attachUser, requireAuth } from "../middleware/auth.js";
import * as timeReportController from "../controllers/timeReportController.js";

const router = express.Router();

router.use(attachUser);
router.use(requireAuth);

function requireReportAccess(req, res, next) {
  if (isAdmin(req.user) || isRegularUser(req.user) || isReporterOnly(req.user)) {
    return next();
  }
  return res.status(403).json({ message: "Forbidden" });
}

function requireApproveAccess(req, res, next) {
  if (!canApproveTimeReports(req.user)) {
    return res.status(403).json({ message: "Time report approve access required" });
  }
  return next();
}

router.get("/", requireReportAccess, timeReportController.list);
router.post("/", requireReportAccess, timeReportController.create);
router.post("/bulk-status", requireApproveAccess, timeReportController.bulkStatus);
router.post("/approve-date", requireApproveAccess, timeReportController.approveDate);
router.get("/:id", requireReportAccess, timeReportController.getById);
router.patch("/:id", requireReportAccess, timeReportController.update);

export default router;
