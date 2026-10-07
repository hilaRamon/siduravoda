import {
  getArzenuReport,
  getStudentWorkReport,
  getWorkByWorkplaceReport,
} from "../services/reportService.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseListParam(value) {
  if (!value || typeof value !== "string") return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readDateRange(query) {
  const { startDate, endDate } = query;
  if (!startDate || !endDate) {
    return { error: "startDate and endDate are required" };
  }
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    return { error: "Dates must be YYYY-MM-DD format" };
  }
  if (startDate > endDate) {
    return { error: "startDate must be before or equal to endDate" };
  }
  return { startDate, endDate };
}

export async function workByWorkplace(req, res, next) {
  try {
    const range = readDateRange(req.query);
    if (range.error) {
      return res.status(400).json({ message: range.error });
    }

    const groupBy = req.query.groupBy === "farm" ? "farm" : "workplace";
    const result = await getWorkByWorkplaceReport({
      startDate: range.startDate,
      endDate: range.endDate,
      workplaces: parseListParam(req.query.workplaces),
      farms: parseListParam(req.query.farms),
      groupBy,
    });

    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

export async function studentWork(req, res, next) {
  try {
    const range = readDateRange(req.query);
    if (range.error) {
      return res.status(400).json({ message: range.error });
    }

    const result = await getStudentWorkReport({
      startDate: range.startDate,
      endDate: range.endDate,
      students: parseListParam(req.query.students),
    });

    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

export async function arzenu(req, res, next) {
  try {
    const range = readDateRange(req.query);
    if (range.error) {
      return res.status(400).json({ message: range.error });
    }

    const result = await getArzenuReport({
      startDate: range.startDate,
      endDate: range.endDate,
    });

    return res.json(result);
  } catch (error) {
    return next(error);
  }
}
