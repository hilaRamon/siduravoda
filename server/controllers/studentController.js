import {
  StudentError,
  listStudents,
  getStudent,
  createStudent,
  bulkCreateStudents,
  updateStudent,
  deleteStudent,
  renameCohort,
} from "../services/studentService.js";

function handleError(res, next, error) {
  if (error instanceof StudentError) {
    return res.status(error.status).json({ message: error.message });
  }
  return next(error);
}

export async function list(req, res, next) {
  try {
    const items = await listStudents(req.query);
    return res.json(items);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function getById(req, res, next) {
  try {
    const item = await getStudent(req.params.id);
    return res.json(item);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function create(req, res, next) {
  try {
    const item = await createStudent(req.body || {});
    return res.status(201).json(item);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function bulkCreate(req, res, next) {
  try {
    const items = await bulkCreateStudents(req.body || []);
    return res.status(201).json(items);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function update(req, res, next) {
  try {
    const item = await updateStudent(req.params.id, req.body || {});
    return res.json(item);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function remove(req, res, next) {
  try {
    await deleteStudent(req.params.id);
    return res.status(204).send();
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function renameCohortHandler(req, res, next) {
  try {
    const result = await renameCohort(req.body || {});
    return res.json(result);
  } catch (error) {
    return handleError(res, next, error);
  }
}
