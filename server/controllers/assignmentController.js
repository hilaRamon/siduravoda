import {
  AssignmentError,
  listAssignments,
  getAssignment,
  createAssignment,
  bulkCreateAssignments,
  bulkUpdateAssignments,
  updateAssignment,
  deleteAssignment,
  cloneDayAssignments,
} from "../services/assignmentService.js";

function handleError(res, next, error) {
  if (error instanceof AssignmentError) {
    return res.status(error.status).json({ message: error.message });
  }
  return next(error);
}

export async function list(req, res, next) {
  try {
    const items = await listAssignments(req.query);
    return res.json(items);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function getById(req, res, next) {
  try {
    const item = await getAssignment(req.params.id);
    return res.json(item);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function create(req, res, next) {
  try {
    const item = await createAssignment(req.body || {});
    return res.status(201).json(item);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function bulkCreate(req, res, next) {
  try {
    const items = await bulkCreateAssignments(req.body || []);
    return res.status(201).json(items);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function bulkUpdate(req, res, next) {
  try {
    const items = await bulkUpdateAssignments(req.body || []);
    return res.json(items);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function update(req, res, next) {
  try {
    const item = await updateAssignment(req.params.id, req.body || {});
    return res.json(item);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function remove(req, res, next) {
  try {
    await deleteAssignment(req.params.id);
    return res.status(204).send();
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function cloneDay(req, res, next) {
  try {
    const result = await cloneDayAssignments(req.body || {});
    return res.json(result);
  } catch (error) {
    return handleError(res, next, error);
  }
}
