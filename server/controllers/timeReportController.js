import {
  TimeReportError,
  approveTimeReportsForDate,
  bulkUpdateTimeReportStatus,
} from "../services/timeReportService.js";

function handleError(res, next, error) {
  if (error instanceof TimeReportError) {
    return res.status(error.status).json({ message: error.message });
  }
  return next(error);
}

export async function bulkStatus(req, res, next) {
  try {
    const result = await bulkUpdateTimeReportStatus(req.body || {});
    return res.json(result);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function approveDate(req, res, next) {
  try {
    const result = await approveTimeReportsForDate(req.body?.date);
    return res.json(result);
  } catch (error) {
    return handleError(res, next, error);
  }
}
