import express from "express";
import { canViewTimeReports } from "../config/permissions.js";
import { attachUser, requireAuth } from "../middleware/auth.js";
import * as reportController from "../controllers/reportController.js";

const router = express.Router();

router.use(attachUser);
router.use(requireAuth);

function requireReportAccess(req, res, next) {
  if (!canViewTimeReports(req.user)) {
    return res.status(403).json({ message: "Report access required" });
  }
  return next();
}

router.get(
  "/work-by-workplace",
  requireReportAccess,
  reportController.workByWorkplace,
);
router.get("/student-work", requireReportAccess, reportController.studentWork);
router.get("/arzenu", requireReportAccess, reportController.arzenu);

export default router;
