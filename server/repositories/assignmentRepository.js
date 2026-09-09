import Assignment from "../models/Assignment.js";

function toJson(doc) {
  if (!doc) return null;
  return typeof doc.toJSON === "function" ? doc.toJSON() : doc;
}

export async function create(data) {
  const doc = await Assignment.create(data);
  return toJson(doc);
}

export async function bulkCreate(items) {
  if (!items?.length) return [];
  const docs = await Assignment.insertMany(items, { ordered: false });
  return docs.map(toJson);
}

export async function findById(id) {
  const doc = await Assignment.findById(id);
  return toJson(doc);
}

export async function find(filter = {}, { sort = { created_date: -1 }, limit } = {}) {
  let query = Assignment.find(filter).sort(sort);
  if (limit) query = query.limit(limit);
  const docs = await query.exec();
  return docs.map(toJson);
}

export async function updateById(id, data) {
  const doc = await Assignment.findByIdAndUpdate(id, data, {
    returnDocument: "after",
    runValidators: true,
  });
  return toJson(doc);
}

export async function bulkUpdate(items) {
  if (!items?.length) return [];

  const ids = items.map((item) => item.id);
  const existing = await Assignment.find({ _id: { $in: ids } }).exec();
  const foundIds = new Set(existing.map((doc) => doc._id.toString()));
  const missing = ids.filter((id) => !foundIds.has(String(id)));
  if (missing.length > 0) {
    return { missing };
  }

  await Assignment.bulkWrite(
    items.map(({ id, data }) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: data },
      },
    })),
    { ordered: true, timestamps: true },
  );

  const docs = await Assignment.find({ _id: { $in: ids } }).exec();
  const byId = Object.fromEntries(
    docs.map((doc) => [doc._id.toString(), toJson(doc)]),
  );
  return ids.map((id) => byId[String(id)]);
}

export async function deleteById(id) {
  const doc = await Assignment.findByIdAndDelete(id);
  return toJson(doc);
}

export async function deleteMany(filter) {
  return Assignment.deleteMany(filter);
}
