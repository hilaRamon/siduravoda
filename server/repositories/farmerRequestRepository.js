import FarmerRequest from "../models/FarmerRequest.js";

function toJson(doc) {
  if (!doc) return null;
  return typeof doc.toJSON === "function" ? doc.toJSON() : doc;
}

export async function create(data) {
  const doc = await FarmerRequest.create(data);
  return toJson(doc);
}

export async function findById(id) {
  const doc = await FarmerRequest.findById(id);
  return toJson(doc);
}

export async function find(filter = {}, { sort = { date: -1 }, limit } = {}) {
  let query = FarmerRequest.find(filter).sort(sort);
  if (limit) query = query.limit(limit);
  const docs = await query.exec();
  return docs.map(toJson);
}

export async function deleteById(id) {
  const doc = await FarmerRequest.findByIdAndDelete(id);
  return toJson(doc);
}
