import mongoose from "mongoose";
import { buildSort } from "../lib/query.js";
import * as farmRepository from "../repositories/farmRepository.js";
import * as workplaceRepository from "../repositories/workplaceRepository.js";

const OPTIONAL_STRINGS = ["contact_phone", "contact_person", "notes"];

export class WorkplaceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "WorkplaceError";
    this.status = status;
  }
}

function optionalString(value) {
  if (value === null || value === undefined) return value;
  return String(value).trim();
}

function normalizeInput(body = {}, { partial = false } = {}) {
  const data = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      throw new WorkplaceError("name is required");
    }
    data.name = name;
  } else if (!partial) {
    throw new WorkplaceError("name is required");
  }

  for (const key of OPTIONAL_STRINGS) {
    if (body[key] !== undefined) data[key] = optionalString(body[key]);
  }

  if (body.farm_id !== undefined) {
    const farmId = body.farm_id === null ? "" : String(body.farm_id).trim();
    data.farm_id = farmId;
  }

  return data;
}

function isObjectId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) return false;
  return String(new mongoose.Types.ObjectId(id)) === id;
}

async function assertFarmExists(farmId) {
  if (!farmId) return;
  if (!isObjectId(farmId)) {
    throw new WorkplaceError("farm_id does not match an existing farm");
  }
  const farm = await farmRepository.findById(farmId);
  if (!farm) {
    throw new WorkplaceError("farm_id does not match an existing farm");
  }
}

export async function listWorkplaces(query = {}) {
  const limitRaw = query.limit !== undefined ? Number(query.limit) : 1000;
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, 10000)
      : 1000;

  return workplaceRepository.find(
    {},
    {
      sort: buildSort(query.sort || "name"),
      limit,
    },
  );
}

export async function getWorkplace(id) {
  const doc = await workplaceRepository.findById(id);
  if (!doc) {
    throw new WorkplaceError("Workplace not found", 404);
  }
  return doc;
}

export async function createWorkplace(body) {
  const data = normalizeInput(body);
  await assertFarmExists(data.farm_id);
  return workplaceRepository.create(data);
}

export async function updateWorkplace(id, body) {
  const data = normalizeInput(body, { partial: true });
  if (data.farm_id !== undefined) {
    await assertFarmExists(data.farm_id);
  }
  const doc = await workplaceRepository.updateById(id, data);
  if (!doc) {
    throw new WorkplaceError("Workplace not found", 404);
  }
  return doc;
}

export async function deleteWorkplace(id) {
  const doc = await workplaceRepository.deleteById(id);
  if (!doc) {
    throw new WorkplaceError("Workplace not found", 404);
  }
  return doc;
}
