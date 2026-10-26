import {
  FarmError,
  listFarms,
  getFarm,
  createFarm,
  updateFarm,
  deleteFarm,
} from "../services/farmService.js";

function handleError(res, next, error) {
  if (error instanceof FarmError) {
    return res.status(error.status).json({ message: error.message });
  }
  return next(error);
}

export async function list(req, res, next) {
  try {
    const items = await listFarms(req.query);
    return res.json(items);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function getById(req, res, next) {
  try {
    const item = await getFarm(req.params.id);
    return res.json(item);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function create(req, res, next) {
  try {
    const item = await createFarm(req.body || {});
    return res.status(201).json(item);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function update(req, res, next) {
  try {
    const item = await updateFarm(req.params.id, req.body || {});
    return res.json(item);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function remove(req, res, next) {
  try {
    await deleteFarm(req.params.id);
    return res.status(204).send();
  } catch (error) {
    return handleError(res, next, error);
  }
}
