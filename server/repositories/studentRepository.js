import Student from "../models/Student.js";

function toJson(doc) {
  if (!doc) return null;
  return typeof doc.toJSON === "function" ? doc.toJSON() : doc;
}

export async function create(data) {
  const doc = await Student.create(data);
  return toJson(doc);
}

export async function bulkCreate(items) {
  if (!items?.length) return [];
  const docs = await Student.insertMany(items, { ordered: false });
  return docs.map(toJson);
}

export async function findById(id) {
  const doc = await Student.findById(id);
  return toJson(doc);
}

export async function find(
  filter = {},
  { sort = { created_date: -1 }, limit } = {},
) {
  let query = Student.find(filter).sort(sort);
  if (limit) query = query.limit(limit);
  const docs = await query.exec();
  return docs.map(toJson);
}

export async function updateById(id, data) {
  const doc = await Student.findByIdAndUpdate(id, data, {
    returnDocument: "after",
    runValidators: true,
  });
  return toJson(doc);
}

export async function deleteById(id) {
  const doc = await Student.findByIdAndDelete(id);
  return toJson(doc);
}

export async function updateManyCohort(from, to) {
  const result = await Student.updateMany(
    { cohort: from },
    { $set: { cohort: to, updated_date: new Date() } },
  );
  return result.modifiedCount;
}
