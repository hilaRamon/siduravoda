import {
  TransportationSummaryError,
  listTransportationSummaries,
  createManualTransportationSummary,
  updateTransportationSummary,
} from "../services/transportationSummaryService.js";

function handleError(res, next, error) {
  if (error instanceof TransportationSummaryError) {
    return res.status(error.status).json({ message: error.message });
  }
  return next(error);
}

export async function list(req, res, next) {
  try {
    const items = await listTransportationSummaries(req.query);
    return res.json(items);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function create(req, res, next) {
  try {
    const item = await createManualTransportationSummary(req.body || {});
    return res.status(201).json(item);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function update(req, res, next) {
  try {
    const item = await updateTransportationSummary(req.params.id, req.body || {});
    return res.json(item);
  } catch (error) {
    return handleError(res, next, error);
  }
}
