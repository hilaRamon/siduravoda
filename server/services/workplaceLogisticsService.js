import * as workplaceLogisticsRepository from "../repositories/workplaceLogisticsRepository.js";

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

  if (!partial && data.exit_time == null) {
    data.exit_time = DEFAULT_EXIT_TIME;
  }

  return data;
}

export async function listWorkplaceLogistics(query = {}) {
  assertDate(query.date);
  return workplaceLogisticsRepository.find(
    { date: query.date },
    { sort: { created_date: -1 }, limit: 1000 },
  );
}

export async function getWorkplaceLogistics(id) {
  const doc = await workplaceLogisticsRepository.findById(id);
  if (!doc) {
    throw new WorkplaceLogisticsError("Workplace logistics not found", 404);
  }
  return doc;
}

export async function createWorkplaceLogistics(body) {
  const data = normalizeInput(body);
  return workplaceLogisticsRepository.create(data);
}

export async function updateWorkplaceLogistics(id, body) {
  const data = normalizeInput(body, { partial: true });
  const doc = await workplaceLogisticsRepository.updateById(id, data);
  if (!doc) {
    throw new WorkplaceLogisticsError("Workplace logistics not found", 404);
  }
  return doc;
}

export async function deleteWorkplaceLogistics(id) {
  const doc = await workplaceLogisticsRepository.deleteById(id);
  if (!doc) {
    throw new WorkplaceLogisticsError("Workplace logistics not found", 404);
  }
  return doc;
}
