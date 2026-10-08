import {
  TimeReportError,
  approveTimeReportsForDate,
  bulkUpdateTimeReportStatus,
  createTimeReport,
  getTimeReport,
  listTimeReports,
  updateTimeReport,
} from "../services/timeReportService.js";

function handleError(res, next, error) {
  if (error instanceof TimeReportError) {
    return res.status(error.status).json({ message: error.message });
  }
  return next(error);
}

export async function list(req, res, next) {
  try {
    const items = await listTimeReports(req.query);
    return res.json(items);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function getById(req, res, next) {
  try {
    const item = await getTimeReport(req.params.id);
    return res.json(item);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function create(req, res, next) {
  try {
    const item = await createTimeReport(req.body || {});
    return res.status(201).json(item);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function update(req, res, next) {
  try {
    const item = await updateTimeReport(req.params.id, req.body || {});
    return res.json(item);
  } catch (error) {
    return handleError(res, next, error);
  }
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
