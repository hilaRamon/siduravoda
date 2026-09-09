import Assignment from "../models/Assignment.js";

function isIndexMissing(error) {
  return error?.code === 27 || error?.codeName === "IndexNotFound";
}

/**
 * Set work_number on legacy rows, drop accidental duplicates of the same
 * (date, student_id, work_number), then sync the unique index.
 */
export async function migrateAssignmentWorkNumber() {
  await Assignment.collection.updateMany(
    {
      $or: [{ work_number: { $exists: false } }, { work_number: null }],
    },
    { $set: { work_number: 1 } },
  );

  const groups = await Assignment.aggregate([
    { $sort: { updated_date: -1, created_date: -1 } },
    {
      $group: {
        _id: {
          date: "$date",
          student_id: "$student_id",
          work_number: "$work_number",
        },
        ids: { $push: "$_id" },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  const toDelete = [];
  for (const group of groups) {
    toDelete.push(...group.ids.slice(1));
  }
  if (toDelete.length > 0) {
    await Assignment.collection.deleteMany({ _id: { $in: toDelete } });
    console.log(
      `Removed ${toDelete.length} duplicate assignment(s) before unique work_number index.`,
    );
  }

  try {
    await Assignment.collection.dropIndex("date_1_student_id_1");
  } catch (error) {
    if (!isIndexMissing(error)) throw error;
  }

  await Assignment.syncIndexes();
}
