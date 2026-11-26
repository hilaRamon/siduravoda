import * as transportationSummaryRepository from "../repositories/transportationSummaryRepository.js";
import * as vehicleRepository from "../repositories/vehicleRepository.js";
import * as workplaceLogisticsRepository from "../repositories/workplaceLogisticsRepository.js";
import {
  departureChangeAllowed,
  isSummaryRowVisible,
  isTransportationVehicle,
  planLogisticsInsert,
  planManualInsert,
} from "../lib/transportationSummary.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const VEHICLE_SLOTS = ["vehicle_id", "vehicle_id_2", "vehicle_id_3"];

const MESSAGES = {
  "not-transportation": "הרכב אינו מסומן כרכב הסעה",
  "departure-required": "יש לבחור שעת יציאה",
  "hour-taken": "לרכב זה כבר יש הסעה בשעה הזו",
  "not-found": "ההסעה לא נמצאה",
  "vehicle-not-found": "הרכב לא נמצא",
};

export class TransportationSummaryError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "TransportationSummaryError";
    this.status = status;
  }
}

function assertDate(date) {
  if (!date || !DATE_RE.test(date)) {
    throw new TransportationSummaryError("date must be YYYY-MM-DD");
  }
}

function assertTime(value) {
  if (!value || !TIME_RE.test(value)) {
    throw new TransportationSummaryError(MESSAGES["departure-required"]);
  }
}

function isDuplicateKey(error) {
  return error?.code === 11000;
}

function assignedVehicleIds(logisticsRows) {
  const ids = new Set();
  for (const row of logisticsRows) {
    for (const key of VEHICLE_SLOTS) {
      if (row[key]) ids.add(row[key]);
    }
  }
  return ids;
}

export async function listTransportationSummaries(query = {}) {
  if (!query.date) {
    return transportationSummaryRepository.find(
      {},
      { sort: { date: 1, departure_time: 1 }, limit: 20000 },
    );
  }
  assertDate(query.date);
  const [rows, logistics] = await Promise.all([
    transportationSummaryRepository.find(
      { date: query.date },
      { sort: { departure_time: 1 }, limit: 1000 },
    ),
    workplaceLogisticsRepository.find(
      { date: query.date },
      { sort: { created_date: -1 }, limit: 1000 },
    ),
  ]);
  const assigned = assignedVehicleIds(logistics);
  return rows
    .filter((row) =>
      isSummaryRowVisible({
        source: row.source,
        isTransportation: row.is_transportation,
        assigned: assigned.has(row.vehicle_id),
      }),
    )
    .sort((a, b) => {
      if (a.departure_time !== b.departure_time) {
        return a.departure_time.localeCompare(b.departure_time);
      }
      return (a.vehicle_name || "").localeCompare(b.vehicle_name || "", "he");
    });
}

export async function ensureLogisticsSummaries(logistics) {
  const result = { inserted: 0, skipped: 0 };
  if (!logistics?.date) return result;
  const vehicleIds = VEHICLE_SLOTS.map((key) => logistics[key]).filter(Boolean);
  if (vehicleIds.length === 0) return result;

  const vehicles = await vehicleRepository.find(
    { _id: { $in: vehicleIds } },
    { limit: 10 },
  );
  const vehicleById = Object.fromEntries(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const workplaceName = logistics.workplace?.name || "";

  for (const vehicleId of vehicleIds) {
    const vehicle = vehicleById[vehicleId];
    if (!isTransportationVehicle(vehicle)) {
      result.skipped += 1;
      continue;
    }
    const existingRows = await transportationSummaryRepository.find(
      { date: logistics.date, vehicle_id: vehicleId },
      { limit: 20 },
    );
    const plan = planLogisticsInsert({
      date: logistics.date,
      vehicleId,
      exitTime: logistics.exit_time,
      workplaceName,
      existingRows,
    });
    if (plan.action !== "insert") {
      result.skipped += 1;
      continue;
    }
    try {
      await transportationSummaryRepository.create(plan.values);
      result.inserted += 1;
    } catch (error) {
      if (isDuplicateKey(error)) {
        result.skipped += 1;
        continue;
      }
      throw error;
    }
  }
  return result;
}

export async function backfillTransportationSummaries() {
  const logisticsRows = await workplaceLogisticsRepository.find(
    {},
    { sort: { date: 1 }, limit: 100000 },
  );
  const totals = { logistics: logisticsRows.length, inserted: 0, skipped: 0 };
  for (const row of logisticsRows) {
    const result = await ensureLogisticsSummaries(row);
    totals.inserted += result.inserted;
    totals.skipped += result.skipped;
  }
  return totals;
}

export async function createManualTransportationSummary(body = {}) {
  assertDate(body.date);
  if (!body.vehicle_id) {
    throw new TransportationSummaryError(MESSAGES["vehicle-not-found"], 404);
  }
  assertTime(typeof body.departure_time === "string" ? body.departure_time.trim() : "");
  const returnTime =
    body.return_time === undefined ? undefined : String(body.return_time || "").trim();
  if (returnTime !== undefined) assertTime(returnTime);
  const vehicle = await vehicleRepository.findById(body.vehicle_id);
  if (!vehicle) {
    throw new TransportationSummaryError(MESSAGES["vehicle-not-found"], 404);
  }
  const existingRows = await transportationSummaryRepository.find(
    { date: body.date, vehicle_id: vehicle.id },
    { limit: 50 },
  );
  const plan = planManualInsert({
    date: body.date,
    vehicleId: vehicle.id,
    departureTime: body.departure_time,
    isTransportation: isTransportationVehicle(vehicle),
    existingRows,
    assembly: body.assembly,
    destination: body.destination,
    returnTime,
  });
  if (plan.action === "reject") {
    throw new TransportationSummaryError(MESSAGES[plan.reason] || plan.reason);
  }
  try {
    return await transportationSummaryRepository.create(plan.values);
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw new TransportationSummaryError(MESSAGES["hour-taken"]);
    }
    throw error;
  }
}

export async function updateTransportationSummary(id, body = {}) {
  const current = await transportationSummaryRepository.findById(id);
  if (!current) {
    throw new TransportationSummaryError(MESSAGES["not-found"], 404);
  }
  const vehicle = await vehicleRepository.findById(current.vehicle_id);
  if (!isTransportationVehicle(vehicle)) {
    throw new TransportationSummaryError(MESSAGES["not-transportation"]);
  }

  const patch = {};
  if (body.assembly !== undefined) {
    patch.assembly = body.assembly == null ? "" : String(body.assembly);
  }
  if (body.destination !== undefined) {
    patch.destination = body.destination == null ? "" : String(body.destination);
  }
  if (body.return_time !== undefined) {
    const returnTime = String(body.return_time || "").trim();
    assertTime(returnTime);
    patch.return_time = returnTime;
  }
  if (body.departure_time !== undefined) {
    const departureTime = String(body.departure_time || "").trim();
    assertTime(departureTime);
    const existingRows = await transportationSummaryRepository.find(
      { date: current.date, vehicle_id: current.vehicle_id },
      { limit: 50 },
    );
    if (
      !departureChangeAllowed(existingRows, {
        id: current.id,
        date: current.date,
        vehicleId: current.vehicle_id,
        departureTime,
      })
    ) {
      throw new TransportationSummaryError(MESSAGES["hour-taken"]);
    }
    patch.departure_time = departureTime;
  }

  if (Object.keys(patch).length === 0) return current;
  try {
    return await transportationSummaryRepository.updateById(id, patch);
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw new TransportationSummaryError(MESSAGES["hour-taken"]);
    }
    throw error;
  }
}
