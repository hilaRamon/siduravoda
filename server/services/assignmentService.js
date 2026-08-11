import { buildSort } from "../lib/query.js";
import * as assignmentRepository from "../repositories/assignmentRepository.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class AssignmentError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "AssignmentError";
    this.status = status;
  }
}

function assertDate(date) {
  if (!date || !DATE_RE.test(date)) {
    throw new AssignmentError("date must be YYYY-MM-DD");
  }
}

function normalizeAssignmentInput(body = {}, { partial = false } = {}) {
  const data = {};

  if (body.date !== undefined) {
    assertDate(body.date);
    data.date = body.date;
  } else if (!partial) {
    throw new AssignmentError("date is required");
  }

  if (body.student_id !== undefined) {
    if (!body.student_id && body.student_id !== "") {
      throw new AssignmentError("student_id is required");
    }
    data.student_id = String(body.student_id);
  } else if (!partial) {
    throw new AssignmentError("student_id is required");
  }

  if (body.workplace_id !== undefined) {
    data.workplace_id = String(body.workplace_id);
  } else if (!partial) {
    throw new AssignmentError("workplace_id is required");
  }

  for (const key of [
    "student_name",
    "workplace_name",
    "role",
    "notes",
  ]) {
    if (body[key] !== undefined) data[key] = body[key];
  }

  for (const key of ["rate", "hours", "bonus"]) {
    if (body[key] === undefined) continue;
    if (body[key] === null || body[key] === "") {
      data[key] = null;
      continue;
    }
    const num = Number(body[key]);
    if (!Number.isFinite(num)) {
      throw new AssignmentError(`${key} must be a number`);
    }
    data[key] = num;
  }

  return data;
}

export async function listAssignments(query = {}) {
  const filter = {};

  if (query.date) {
    assertDate(query.date);
    filter.date = query.date;
  } else if (query.startDate || query.endDate) {
    if (query.startDate) assertDate(query.startDate);
    if (query.endDate) assertDate(query.endDate);
    filter.date = {};
    if (query.startDate) filter.date.$gte = query.startDate;
    if (query.endDate) filter.date.$lte = query.endDate;
  }

  if (query.student_id) filter.student_id = query.student_id;
  if (query.workplace_id) filter.workplace_id = query.workplace_id;

  const limitRaw = query.limit !== undefined ? Number(query.limit) : 2000;
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, 10000)
      : 2000;

  return assignmentRepository.find(filter, {
    sort: buildSort(query.sort || "-created_date"),
    limit,
  });
}

export async function getAssignment(id) {
  const doc = await assignmentRepository.findById(id);
  if (!doc) {
    throw new AssignmentError("Assignment not found", 404);
  }
  return doc;
}

export async function createAssignment(body) {
  const data = normalizeAssignmentInput(body, { partial: false });
  return assignmentRepository.create(data);
}

export async function bulkCreateAssignments(items) {
  if (!Array.isArray(items)) {
    throw new AssignmentError("Request body must be an array");
  }
  const normalized = items.map((item) =>
    normalizeAssignmentInput(item, { partial: false }),
  );
  return assignmentRepository.bulkCreate(normalized);
}

export async function updateAssignment(id, body) {
  const data = normalizeAssignmentInput(body || {}, { partial: true });
  if (Object.keys(data).length === 0) {
    throw new AssignmentError("No fields to update");
  }
  const doc = await assignmentRepository.updateById(id, data);
  if (!doc) {
    throw new AssignmentError("Assignment not found", 404);
  }
  return doc;
}

export async function deleteAssignment(id) {
  const doc = await assignmentRepository.deleteById(id);
  if (!doc) {
    throw new AssignmentError("Assignment not found", 404);
  }
  return doc;
}
