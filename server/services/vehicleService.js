import { buildSort } from "../lib/query.js";
import * as vehicleRepository from "../repositories/vehicleRepository.js";

const OPTIONAL_FIELDS = ["license_plate", "insurance", "notes"];

export class VehicleError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "VehicleError";
    this.status = status;
  }
}

function normalizeInput(body = {}, { partial = false } = {}) {
  const data = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      throw new VehicleError("name is required");
    }
    data.name = name;
  } else if (!partial) {
    throw new VehicleError("name is required");
  }

  for (const key of OPTIONAL_FIELDS) {
    if (body[key] !== undefined) data[key] = body[key];
  }

  return data;
}

export async function listVehicles(query = {}) {
  const limitRaw = query.limit !== undefined ? Number(query.limit) : 1000;
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, 10000)
      : 1000;

  return vehicleRepository.find(
    {},
    {
      sort: buildSort(query.sort || "name"),
      limit,
    },
  );
}

export async function getVehicle(id) {
  const doc = await vehicleRepository.findById(id);
  if (!doc) {
    throw new VehicleError("Vehicle not found", 404);
  }
  return doc;
}

export async function createVehicle(body) {
  const data = normalizeInput(body);
  return vehicleRepository.create(data);
}

export async function updateVehicle(id, body) {
  const data = normalizeInput(body, { partial: true });
  const doc = await vehicleRepository.updateById(id, data);
  if (!doc) {
    throw new VehicleError("Vehicle not found", 404);
  }
  return doc;
}

export async function deleteVehicle(id) {
  const doc = await vehicleRepository.deleteById(id);
  if (!doc) {
    throw new VehicleError("Vehicle not found", 404);
  }
  return doc;
}
