import {
  PublishedScheduleError,
  listPublishedSchedules,
  getPublishedSchedule,
  createPublishedSchedule,
  upsertPublishedScheduleByDate,
  updatePublishedSchedule,
  deletePublishedSchedule,
} from "../services/publishedScheduleService.js";

function handleError(res, next, error) {
  if (error instanceof PublishedScheduleError) {
    return res.status(error.status).json({ message: error.message });
  }
  return next(error);
}

export async function list(req, res, next) {
  try {
    const items = await listPublishedSchedules(req.query);
    return res.json(items);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function getById(req, res, next) {
  try {
    const item = await getPublishedSchedule(req.params.id);
    return res.json(item);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function create(req, res, next) {
  try {
    const item = await createPublishedSchedule(req.body || {});
    return res.status(201).json(item);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function upsert(req, res, next) {
  try {
    const item = await upsertPublishedScheduleByDate(req.body || {});
    return res.json(item);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function update(req, res, next) {
  try {
    const item = await updatePublishedSchedule(req.params.id, req.body || {});
    return res.json(item);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function remove(req, res, next) {
  try {
    await deletePublishedSchedule(req.params.id);
    return res.status(204).send();
  } catch (error) {
    return handleError(res, next, error);
  }
}
