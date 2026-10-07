import * as workplaceLogisticsRepository from "../repositories/workplaceLogisticsRepository.js";
import { syncAssignmentsPieceworkForWorkplace } from "./assignmentService.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_EXIT_TIME = "06:35";

const OPTIONAL_ID_FIELDS = [
  "driver_student_id",
  "vehicle_id",
  "vehicle_id_2",
  "vehicle_id_3",
];

const OPTIONAL_TEXT_FIELDS = ["exit_time", "notes"];

export class WorkplaceLogisticsError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "WorkplaceLogisticsError";
    this.status = status;
  }
}

function assertDate(date) {
  if (!date || !DATE_RE.test(date)) {
    throw new WorkplaceLogisticsError("date must be YYYY-MM-DD");
  }
}

function optionalId(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return String(value);
}

function optionalNumber(value, key) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new WorkplaceLogisticsError(`${key} must be a number`);
  }
  return num;
}

function parseBoolean(value) {
  if (value === undefined) return undefined;
  if (value === true || value === "true" || value === 1 || value === "1") {
    return true;
  }
  if (value === false || value === "false" || value === 0 || value === "0") {
    return false;
  }
  return Boolean(value);
}

function normalizeInput(body = {}, { partial = false } = {}) {
  const data = {};

  if (body.date !== undefined) {
    assertDate(body.date);
    data.date = body.date;
  } else if (!partial) {
    throw new WorkplaceLogisticsError("date is required");
  }

  if (body.workplace_id !== undefined) {
    if (!body.workplace_id) {
      throw new WorkplaceLogisticsError("workplace_id is required");
    }
    data.workplace_id = String(body.workplace_id);
  } else if (!partial) {
    throw new WorkplaceLogisticsError("workplace_id is required");
  }

  for (const key of OPTIONAL_ID_FIELDS) {
    const value = optionalId(body[key]);
    if (value !== undefined) data[key] = value;
  }

  for (const key of OPTIONAL_TEXT_FIELDS) {
    if (body[key] !== undefined) data[key] = body[key];
  }

  if (body.units_name !== undefined) {
    data.units_name = body.units_name == null ? "" : String(body.units_name);
  }

  const units = optionalNumber(body.units, "units");
  if (units !== undefined) data.units = units;

  const rate = optionalNumber(body.rate, "rate");
  if (rate !== undefined) data.rate = rate;

  const isPiecework = parseBoolean(body.is_piecework);
  if (isPiecework !== undefined) {
    data.is_piecework = isPiecework;
  } else if (!partial) {
    data.is_piecework = false;
  }

  if (data.is_piecework === false) {
    data.units_name = "";
    data.units = null;
    data.rate = null;
  }

  if (!partial && data.exit_time == null) {
    data.exit_time = DEFAULT_EXIT_TIME;
  }

  return data;
}

async function syncPieceworkAssignments(doc) {
  if (!doc?.date || !doc?.workplace_id) return;
  await syncAssignmentsPieceworkForWorkplace(doc.date, doc.workplace_id);
}

export async function listWorkplaceLogistics(query = {}) {
  if (query.date) {
    assertDate(query.date);
    return workplaceLogisticsRepository.find(
      { date: query.date },
      { sort: { created_date: -1 }, limit: 1000 },
    );
  }
  return workplaceLogisticsRepository.find(
    {},
    { sort: { date: 1, created_date: -1 }, limit: 10000 },
  );
}

export async function getWorkplaceLogistics(id) {
  const doc = await workplaceLogisticsRepository.findById(id);
  if (!doc) {
    throw new WorkplaceLogisticsError("Workplace logistics not found", 404);
  }
  return doc;
}

function mergeCreateIntoExisting(existing, incoming) {
  const isPiecework = Boolean(incoming.is_piecework || existing.is_piecework);
  const merged = { ...incoming, is_piecework: isPiecework };
  if (isPiecework) {
    merged.units_name = incoming.units_name || existing.units_name || "";
    merged.units = incoming.units ?? existing.units ?? null;
    merged.rate = incoming.rate ?? existing.rate ?? null;
  }
  if (!incoming.exit_time && existing.exit_time) {
    merged.exit_time = existing.exit_time;
  }
  for (const key of [
    "driver_student_id",
    "vehicle_id",
    "vehicle_id_2",
    "vehicle_id_3",
    "notes",
  ]) {
    if ((merged[key] == null || merged[key] === "") && existing[key]) {
      merged[key] = existing[key];
    }
  }
  return merged;
}

export async function createWorkplaceLogistics(body) {
  const data = normalizeInput(body);
  const existingRows = await workplaceLogisticsRepository.find(
    { date: data.date, workplace_id: data.workplace_id },
    { sort: { is_piecework: -1, updated_date: -1 }, limit: 1 },
  );
  const existing = existingRows[0];
  if (existing) {
    const doc = await workplaceLogisticsRepository.updateById(
      existing.id,
      mergeCreateIntoExisting(existing, data),
    );
    await syncPieceworkAssignments(doc);
    return doc;
  }
  const doc = await workplaceLogisticsRepository.create(data);
  await syncPieceworkAssignments(doc);
  return doc;
}

export async function updateWorkplaceLogistics(id, body) {
  const data = normalizeInput(body, { partial: true });
  const doc = await workplaceLogisticsRepository.updateById(id, data);
  if (!doc) {
    throw new WorkplaceLogisticsError("Workplace logistics not found", 404);
  }
  await syncPieceworkAssignments(doc);
  return doc;
}

export async function deleteWorkplaceLogistics(id) {
  const doc = await workplaceLogisticsRepository.deleteById(id);
  if (!doc) {
    throw new WorkplaceLogisticsError("Workplace logistics not found", 404);
  }
  return doc;
}
