import { buildSort } from "../lib/query.js";
import * as studentRepository from "../repositories/studentRepository.js";

const FREE_DAYS = new Set(["א", "ב", "ג", "ד", "ה"]);
const DISTANCES = new Set([
  "קרוב",
  "רחוק",
  "אאא- לפני שיבוץ",
  "תתת - לא עובד",
]);

export class StudentError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "StudentError";
    this.status = status;
  }
}

function trimString(value) {
  if (value == null) return "";
  return String(value).trim();
}

function normalizeStudentInput(body = {}, { partial = false } = {}) {
  const data = {};

  if (body.full_name !== undefined) {
    const name = trimString(body.full_name);
    if (!name) {
      throw new StudentError("full_name is required");
    }
    data.full_name = name;
  } else if (!partial) {
    throw new StudentError("full_name is required");
  }

  if (body.phone !== undefined) {
    data.phone = trimString(body.phone);
  }

  if (body.cohort !== undefined) {
    data.cohort = trimString(body.cohort);
  }

  if (body.free_day !== undefined) {
    if (body.free_day == null || body.free_day === "") {
      data.free_day = null;
    } else {
      const days = Array.isArray(body.free_day)
        ? body.free_day
        : [body.free_day];
      for (const day of days) {
        if (!FREE_DAYS.has(day)) {
          throw new StudentError(`Invalid free_day: ${day}`);
        }
      }
      data.free_day = days.length > 0 ? days : null;
    }
  }

  if (body.distance_status !== undefined) {
    if (body.distance_status == null || body.distance_status === "") {
      data.distance_status = null;
    } else if (!DISTANCES.has(body.distance_status)) {
      throw new StudentError("Invalid distance_status");
    } else {
      data.distance_status = body.distance_status;
    }
  }

  if (body.is_active !== undefined) {
    data.is_active = Boolean(body.is_active);
  } else if (!partial) {
    data.is_active = true;
  }

  if (body.forbidden_workplaces !== undefined) {
    if (!Array.isArray(body.forbidden_workplaces)) {
      throw new StudentError("forbidden_workplaces must be an array");
    }
    data.forbidden_workplaces = body.forbidden_workplaces.map(String);
  }

  if (body.notes !== undefined) {
    data.notes = body.notes == null ? "" : String(body.notes);
  }

  return data;
}

export async function listStudents(query = {}) {
  const limitRaw = query.limit !== undefined ? Number(query.limit) : 2000;
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, 10000)
      : 2000;

  return studentRepository.find(
    {},
    {
      sort: buildSort(query.sort || "-created_date"),
      limit,
    },
  );
}

export async function getStudent(id) {
  const doc = await studentRepository.findById(id);
  if (!doc) {
    throw new StudentError("Student not found", 404);
  }
  return doc;
}

export async function createStudent(body) {
  const data = normalizeStudentInput(body, { partial: false });
  return studentRepository.create(data);
}

export async function bulkCreateStudents(items) {
  if (!Array.isArray(items)) {
    throw new StudentError("Request body must be an array");
  }
  const normalized = items.map((item) =>
    normalizeStudentInput(item, { partial: false }),
  );
  return studentRepository.bulkCreate(normalized);
}

export async function updateStudent(id, body) {
  const data = normalizeStudentInput(body || {}, { partial: true });
  if (Object.keys(data).length === 0) {
    throw new StudentError("No fields to update");
  }
  const doc = await studentRepository.updateById(id, data);
  if (!doc) {
    throw new StudentError("Student not found", 404);
  }
  return doc;
}

export async function deleteStudent(id) {
  const doc = await studentRepository.deleteById(id);
  if (!doc) {
    throw new StudentError("Student not found", 404);
  }
  return doc;
}

export async function renameCohort({ from, to } = {}) {
  const fromName = trimString(from);
  const toName = trimString(to);
  if (!fromName) {
    throw new StudentError("from is required");
  }
  if (!toName) {
    throw new StudentError("to is required");
  }
  if (fromName === toName) {
    throw new StudentError("from and to must be different");
  }

  const updated = await studentRepository.updateManyCohort(fromName, toName);
  return { updated };
}
