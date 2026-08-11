import PermissionRule from "../models/PermissionRule.js";

function toJson(doc) {
  if (!doc) return null;
  return typeof doc.toJSON === "function" ? doc.toJSON() : doc;
}

export async function findAll() {
  const docs = await PermissionRule.find().sort({ role: 1 }).exec();
  return docs.map(toJson);
}

export async function findById(id) {
  const doc = await PermissionRule.findById(id);
  return toJson(doc);
}

export async function findByRole(role) {
  const doc = await PermissionRule.findOne({ role });
  return toJson(doc);
}

export async function updateById(id, data) {
  const doc = await PermissionRule.findByIdAndUpdate(id, data, {
    returnDocument: "after",
    runValidators: true,
  });
  return toJson(doc);
}

export async function upsertByRole(role, data) {
  const doc = await PermissionRule.findOneAndUpdate(
    { role },
    { $set: { ...data, role } },
    {
      upsert: true,
      returnDocument: "after",
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );
  return toJson(doc);
}
