import { getModel } from "../models/index.js";

function studentModel() {
  return getModel("Student");
}

function toJson(doc) {
  if (!doc) return null;
  return typeof doc.toJSON === "function" ? doc.toJSON() : doc;
}

export async function create(data) {
  const doc = await studentModel().create(data);
  return toJson(doc);
}

export async function bulkCreate(items) {
  if (!items?.length) return [];
  const docs = await studentModel().insertMany(items, { ordered: false });
  return docs.map(toJson);
}

export async function findById(id) {
  const doc = await studentModel().findById(id);
  return toJson(doc);
}

export async function find(
  filter = {},
  { sort = { created_date: -1 }, limit } = {},
) {
  let query = studentModel().find(filter).sort(sort);
  if (limit) query = query.limit(limit);
  const docs = await query.exec();
  return docs.map(toJson);
}

export async function updateById(id, data) {
  const doc = await studentModel().findByIdAndUpdate(id, data, {
    returnDocument: "after",
    runValidators: true,
  });
  return toJson(doc);
}

export async function deleteById(id) {
  const doc = await studentModel().findByIdAndDelete(id);
  return toJson(doc);
}

export async function updateManyCohort(from, to) {
  const result = await studentModel().updateMany(
    { cohort: from },
    { $set: { cohort: to, updated_date: new Date() } },
  );
  return result.modifiedCount;
}
