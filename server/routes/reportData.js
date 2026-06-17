import express from "express";
import { canViewTimeReports } from "../config/permissions.js";
import { attachUser, requireAuth } from "../middleware/auth.js";
import { getArzenuReport } from "../services/arzenuReportService.js";
import { getWorkByWorkplaceReport } from "../services/workByWorkplaceReportService.js";
import { getStudentWorkReport } from "../services/studentWorkReportService.js";

const router = express.Router();

router.use(attachUser);
router.use(requireAuth);

function requireReportAccess(req, res, next) {
  if (!canViewTimeReports(req.user)) {
    return res.status(403).json({ message: "Report access required" });
  }
  return next();
}

function parseListParam(value) {
  if (!value || typeof value !== "string") return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

router.get("/work-by-workplace", requireReportAccess, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ message: "startDate and endDate are required" });
    }
    if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
      return res
        .status(400)
        .json({ message: "Dates must be YYYY-MM-DD format" });
    }
    if (startDate > endDate) {
      return res
        .status(400)
        .json({ message: "startDate must be before or equal to endDate" });
    }

    const groupBy =
      req.query.groupBy === "farm" ? "farm" : "workplace";

    const result = await getWorkByWorkplaceReport({
      startDate,
      endDate,
      workplaces: parseListParam(req.query.workplaces),
      farms: parseListParam(req.query.farms),
      groupBy,
    });

    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.get("/student-work", requireReportAccess, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ message: "startDate and endDate are required" });
    }
    if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
      return res
        .status(400)
        .json({ message: "Dates must be YYYY-MM-DD format" });
    }
    if (startDate > endDate) {
      return res
        .status(400)
        .json({ message: "startDate must be before or equal to endDate" });
    }

    const result = await getStudentWorkReport({
      startDate,
      endDate,
      students: parseListParam(req.query.students),
    });

    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.get("/arzenu", requireReportAccess, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ message: "startDate and endDate are required" });
    }
    if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
      return res
        .status(400)
        .json({ message: "Dates must be YYYY-MM-DD format" });
    }
    if (startDate > endDate) {
      return res
        .status(400)
        .json({ message: "startDate must be before or equal to endDate" });
    }

    const result = await getArzenuReport({ startDate, endDate });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

export default router;
