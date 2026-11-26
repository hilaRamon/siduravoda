import TransportationSummary from "../models/TransportationSummary.js";
import "../models/Vehicle.js";

const POPULATE = [{ path: "vehicle_id", select: "name is_transportation" }];

function normalizeId(value) {
  if (value == null || value === "") return null;
  if (typeof value === "string") return value;
  if (value.id) return String(value.id);
  if (value._id) return String(value._id);
  return String(value);
}

function toJson(doc) {
  if (!doc) return null;
  const raw = typeof doc.toJSON === "function" ? doc.toJSON() : doc;
  const vehicle = raw.vehicle_id;
  const vehicleObject = vehicle && typeof vehicle === "object" ? vehicle : null;
  return {
    id: raw.id || normalizeId(raw._id),
    date: raw.date,
    vehicle_id: normalizeId(raw.vehicle_id),
    vehicle_name: vehicleObject?.name || "",
    is_transportation: vehicleObject?.is_transportation === true,
    source: raw.source,
    assembly: raw.assembly ?? "טצ",
    destination: raw.destination ?? "",
    departure_time: raw.departure_time,
    return_time: raw.return_time ?? "12:00",
    created_date: raw.created_date,
    updated_date: raw.updated_date,
  };
}

function withPopulate(query) {
  return query.populate(POPULATE);
}

export async function create(data) {
  const doc = await TransportationSummary.create(data);
  return findById(doc._id);
}

export async function findById(id) {
  const doc = await withPopulate(TransportationSummary.findById(id)).exec();
  return toJson(doc);
}

export async function find(filter = {}, { sort = { departure_time: 1 }, limit } = {}) {
  let query = withPopulate(TransportationSummary.find(filter).sort(sort));
  if (limit) query = query.limit(limit);
  const docs = await query.exec();
  return docs.map(toJson);
}

export async function updateById(id, data) {
  await TransportationSummary.findByIdAndUpdate(id, data, {
    runValidators: true,
  });
  return findById(id);
}
