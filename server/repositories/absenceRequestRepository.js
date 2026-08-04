import AbsenceRequest from "../models/AbsenceRequest.js";

function toJson(doc) {
  if (!doc) return null;
  return typeof doc.toJSON === "function" ? doc.toJSON() : doc;
}

export async function create(data) {
  const doc = await AbsenceRequest.create(data);
  return toJson(doc);
}

export async function findById(id) {
  const doc = await AbsenceRequest.findById(id);
  return toJson(doc);
}

export async function find(filter = {}, { sort = { created_date: -1 }, limit } = {}) {
  let query = AbsenceRequest.find(filter).sort(sort);
  if (limit) query = query.limit(limit);
  const docs = await query.exec();
  return docs.map(toJson);
}

export async function updateById(id, data) {
  const doc = await AbsenceRequest.findByIdAndUpdate(id, data, {
    returnDocument: "after",
    runValidators: true,
  });
  return toJson(doc);
}

export async function deleteById(id) {
  const doc = await AbsenceRequest.findByIdAndDelete(id);
  return toJson(doc);
}
