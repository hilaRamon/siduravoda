import WorkplaceLogistics from "../models/WorkplaceLogistics.js";
import { pickCanonicalLogistics } from "./pieceworkLogistics.js";

function isIndexMissing(error) {
  return error?.code === 27 || error?.codeName === "IndexNotFound";
}

function fieldIfMissing(winner, loser, key) {
  if (winner[key] != null && winner[key] !== "") return winner[key];
  return loser[key];
}

function mergeDocs(winner, loser) {
  const isPiecework = Boolean(winner.is_piecework || loser.is_piecework);
  return {
    exit_time: fieldIfMissing(winner, loser, "exit_time"),
    notes: fieldIfMissing(winner, loser, "notes"),
    driver_student_id: fieldIfMissing(winner, loser, "driver_student_id"),
    vehicle_id: fieldIfMissing(winner, loser, "vehicle_id"),
    vehicle_id_2: fieldIfMissing(winner, loser, "vehicle_id_2"),
    vehicle_id_3: fieldIfMissing(winner, loser, "vehicle_id_3"),
    is_piecework: isPiecework,
    units_name: isPiecework
      ? fieldIfMissing(winner, loser, "units_name") || ""
      : "",
    units: isPiecework ? fieldIfMissing(winner, loser, "units") : null,
    reported_units: isPiecework
      ? fieldIfMissing(winner, loser, "reported_units")
      : null,
    units_status: isPiecework
      ? fieldIfMissing(winner, loser, "units_status")
      : null,
    rate: isPiecework ? fieldIfMissing(winner, loser, "rate") : null,
  };
}

/**
 * Keep one logistics row per date+workplace, then enforce a unique index.
 */
export async function migrateWorkplaceLogisticsUnique() {
  const coll = WorkplaceLogistics.collection;
  const groups = await coll
    .aggregate([
      {
        $group: {
          _id: { date: "$date", workplace_id: "$workplace_id" },
          docs: { $push: "$$ROOT" },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  const synced = [];
  for (const group of groups) {
    const winner = group.docs.reduce((best, doc) =>
      pickCanonicalLogistics(best, doc),
    );
    let merged = { ...winner };
    for (const loser of group.docs) {
      if (String(loser._id) === String(winner._id)) continue;
      merged = { ...merged, ...mergeDocs(merged, loser) };
    }
    await coll.updateOne(
      { _id: winner._id },
      {
        $set: {
          exit_time: merged.exit_time,
          notes: merged.notes,
          driver_student_id: merged.driver_student_id,
          vehicle_id: merged.vehicle_id,
          vehicle_id_2: merged.vehicle_id_2,
          vehicle_id_3: merged.vehicle_id_3,
          is_piecework: merged.is_piecework,
          units_name: merged.units_name,
          units: merged.units,
          reported_units: merged.reported_units,
          units_status: merged.units_status,
          rate: merged.rate,
        },
      },
    );
    const loserIds = group.docs
      .filter((doc) => String(doc._id) !== String(winner._id))
      .map((doc) => doc._id);
    await coll.deleteMany({ _id: { $in: loserIds } });
    synced.push({
      date: group._id.date,
      workplace_id: String(group._id.workplace_id),
    });
  }

  if (groups.length > 0) {
    console.log(
      `Merged ${groups.length} duplicate workplace logistics group(s).`,
    );
  }

  try {
    await coll.dropIndex("date_1_workplace_id_1");
  } catch (error) {
    if (!isIndexMissing(error)) throw error;
  }

  await WorkplaceLogistics.syncIndexes();

  if (synced.length === 0) return;
  const { syncAssignmentsPieceworkForWorkplace } = await import(
    "../services/assignmentService.js"
  );
  for (const row of synced) {
    await syncAssignmentsPieceworkForWorkplace(row.date, row.workplace_id);
  }
}
