import { buildSort } from "../lib/query.js";
import * as farmRepository from "../repositories/farmRepository.js";
import * as workplaceRepository from "../repositories/workplaceRepository.js";

const OPTIONAL_STRINGS = [
  "company_id",
  "address",
  "accounting_phone",
  "accounting_email",
];

export class FarmError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "FarmError";
    this.status = status;
  }
}

function optionalString(value) {
  if (value === null || value === undefined) return value;
  return String(value).trim();
}

function optionalBoolean(value) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return Boolean(value);
}

function normalizeInput(body = {}, { partial = false } = {}) {
  const data = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      throw new FarmError("name is required");
    }
    data.name = name;
  } else if (!partial) {
    throw new FarmError("name is required");
  }

  for (const key of OPTIONAL_STRINGS) {
    if (body[key] !== undefined) data[key] = optionalString(body[key]);
  }

  if (body.has_agreement !== undefined) {
    data.has_agreement = optionalBoolean(body.has_agreement);
  }

  return data;
}

export async function listFarms(query = {}) {
  const limitRaw = query.limit !== undefined ? Number(query.limit) : 1000;
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, 10000)
      : 1000;

  return farmRepository.find(
    {},
    {
      sort: buildSort(query.sort || "name"),
      limit,
    },
  );
}

export async function getFarm(id) {
  const doc = await farmRepository.findById(id);
  if (!doc) {
    throw new FarmError("Farm not found", 404);
  }
  return doc;
}

export async function createFarm(body) {
  const data = normalizeInput(body);
  return farmRepository.create(data);
}

export async function updateFarm(id, body) {
  const data = normalizeInput(body, { partial: true });
  const doc = await farmRepository.updateById(id, data);
  if (!doc) {
    throw new FarmError("Farm not found", 404);
  }
  return doc;
}

export async function deleteFarm(id) {
  const existing = await farmRepository.findById(id);
  if (!existing) {
    throw new FarmError("Farm not found", 404);
  }

  const workplaceCount = await workplaceRepository.countByFarmId(id);
  if (workplaceCount > 0) {
    throw new FarmError("Cannot delete a farm that still has workplaces", 400);
  }

  return farmRepository.deleteById(id);
}
