import WorkplaceLogistics from "../models/WorkplaceLogistics.js";
import "../models/Workplace.js";
import "../models/Student.js";
import "../models/Vehicle.js";

const POPULATE = [
  { path: "workplace_id", select: "name" },
  { path: "driver_student_id", select: "full_name" },
  { path: "vehicle_id", select: "name" },
  { path: "vehicle_id_2", select: "name" },
  { path: "vehicle_id_3", select: "name" },
];

function normalizeId(value) {
  if (value == null || value === "") return null;
  if (typeof value === "string") return value;
  if (value.id) return String(value.id);
  if (value._id) return String(value._id);
  return String(value);
}

function relationSnapshot(value, fields) {
  if (!value || typeof value !== "object") return null;
  const id = normalizeId(value);
  if (!id) return null;
  const source = typeof value.toJSON === "function" ? value.toJSON() : value;
  const snapshot = { id };
  for (const field of fields) {
    snapshot[field] = source[field] ?? "";
  }
  return snapshot;
}

function toJson(doc) {
  if (!doc) return null;
  const raw = typeof doc.toJSON === "function" ? doc.toJSON() : doc;
  return {
    id: raw.id || normalizeId(raw._id),
    date: raw.date,
    workplace_id: normalizeId(raw.workplace_id),
    driver_student_id: normalizeId(raw.driver_student_id),
    vehicle_id: normalizeId(raw.vehicle_id),
    vehicle_id_2: normalizeId(raw.vehicle_id_2),
    vehicle_id_3: normalizeId(raw.vehicle_id_3),
    exit_time: raw.exit_time ?? null,
    notes: raw.notes ?? "",
    is_piecework: Boolean(raw.is_piecework),
    units_name: raw.units_name ?? "",
    units: raw.units ?? null,
    reported_units: raw.reported_units ?? null,
    units_status: raw.units_status ?? null,
    rate: raw.rate ?? null,
    created_date: raw.created_date,
    updated_date: raw.updated_date,
    workplace: relationSnapshot(raw.workplace_id, ["name"]),
    driver: relationSnapshot(raw.driver_student_id, ["full_name"]),
    vehicle: relationSnapshot(raw.vehicle_id, ["name"]),
    vehicle_2: relationSnapshot(raw.vehicle_id_2, ["name"]),
    vehicle_3: relationSnapshot(raw.vehicle_id_3, ["name"]),
  };
}

function withPopulate(query) {
  return query.populate(POPULATE);
}

export async function create(data) {
  const doc = await WorkplaceLogistics.create(data);
  return findById(doc._id);
}

export async function findById(id) {
  const doc = await withPopulate(WorkplaceLogistics.findById(id)).exec();
  return toJson(doc);
}

export async function find(filter = {}, { sort = { created_date: -1 }, limit } = {}) {
  let query = withPopulate(WorkplaceLogistics.find(filter).sort(sort));
  if (limit) query = query.limit(limit);
  const docs = await query.exec();
  return docs.map(toJson);
}

export async function updateById(id, data) {
  await WorkplaceLogistics.findByIdAndUpdate(id, data, {
    runValidators: true,
  });
  return findById(id);
}

export async function deleteById(id) {
  const doc = await WorkplaceLogistics.findByIdAndDelete(id);
  return toJson(doc);
}
