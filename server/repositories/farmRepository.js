import Farm from "../models/Farm.js";

function toJson(doc) {
  if (!doc) return null;
  return typeof doc.toJSON === "function" ? doc.toJSON() : doc;
}

export async function create(data) {
  const doc = await Farm.create(data);
  return toJson(doc);
}

export async function findById(id) {
  const doc = await Farm.findById(id);
  return toJson(doc);
}

export async function find(filter = {}, { sort = { name: 1 }, limit } = {}) {
  let query = Farm.find(filter).sort(sort);
  if (limit) query = query.limit(limit);
  const docs = await query.exec();
  return docs.map(toJson);
}

export async function updateById(id, data) {
  const doc = await Farm.findByIdAndUpdate(id, data, {
    returnDocument: "after",
    runValidators: true,
  });
  return toJson(doc);
}

export async function deleteById(id) {
  const doc = await Farm.findByIdAndDelete(id);
  return toJson(doc);
}
