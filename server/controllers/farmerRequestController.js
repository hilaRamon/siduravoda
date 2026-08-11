import {
  FarmerRequestError,
  listFarmerRequests,
  getFarmerRequest,
  createFarmerRequest,
  deleteFarmerRequest,
} from "../services/farmerRequestService.js";

function handleError(res, next, error) {
  if (error instanceof FarmerRequestError) {
    return res.status(error.status).json({ message: error.message });
  }
  return next(error);
}

export async function list(req, res, next) {
  try {
    const items = await listFarmerRequests(req.query);
    return res.json(items);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function getById(req, res, next) {
  try {
    const item = await getFarmerRequest(req.params.id);
    return res.json(item);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function create(req, res, next) {
  try {
    const item = await createFarmerRequest(req.body || {});
    return res.status(201).json(item);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function remove(req, res, next) {
  try {
    await deleteFarmerRequest(req.params.id);
    return res.status(204).send();
  } catch (error) {
    return handleError(res, next, error);
  }
}
