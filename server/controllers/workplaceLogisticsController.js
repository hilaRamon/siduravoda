import {
  WorkplaceLogisticsError,
  listWorkplaceLogistics,
  getWorkplaceLogistics,
  createWorkplaceLogistics,
  updateWorkplaceLogistics,
  deleteWorkplaceLogistics,
} from "../services/workplaceLogisticsService.js";

function handleError(res, next, error) {
  if (error instanceof WorkplaceLogisticsError) {
    return res.status(error.status).json({ message: error.message });
  }
  return next(error);
}

export async function list(req, res, next) {
  try {
    const items = await listWorkplaceLogistics(req.query);
    return res.json(items);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function getById(req, res, next) {
  try {
    const item = await getWorkplaceLogistics(req.params.id);
    return res.json(item);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function create(req, res, next) {
  try {
    const item = await createWorkplaceLogistics(req.body || {});
    return res.status(201).json(item);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function update(req, res, next) {
  try {
    const item = await updateWorkplaceLogistics(req.params.id, req.body || {});
    return res.json(item);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function remove(req, res, next) {
  try {
    await deleteWorkplaceLogistics(req.params.id);
    return res.status(204).send();
  } catch (error) {
    return handleError(res, next, error);
  }
}
