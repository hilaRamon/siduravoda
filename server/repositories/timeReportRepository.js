import TimeReport from "../models/TimeReport.js";

function toJson(doc) {
  if (!doc) return null;
  return typeof doc.toJSON === "function" ? doc.toJSON() : doc;
}

export async function create(data) {
  const doc = await TimeReport.create(data);
  return toJson(doc);
}

export async function findById(id) {
  const doc = await TimeReport.findById(id);
  return toJson(doc);
}

export async function find(filter = {}, { sort = { created_date: -1 }, limit } = {}) {
  let query = TimeReport.find(filter).sort(sort);
  if (limit) query = query.limit(limit);
  const docs = await query.exec();
  return docs.map(toJson);
}

export async function updateById(id, data) {
  const doc = await TimeReport.findByIdAndUpdate(id, data, {
    returnDocument: "after",
    runValidators: true,
  });
  return toJson(doc);
}

export async function updateMany(filter, data) {
  return TimeReport.updateMany(filter, { $set: data });
}
