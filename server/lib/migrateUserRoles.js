import { getModel } from "../models/index.js";

const LEGACY_FLAGS = [
  "can_report_time",
  "can_view_time_reports",
  "can_manage_workplaces",
];

function deriveRole(doc) {
  if (doc.role === "admin") return "admin";
  if (doc.role === "reporter" || doc.role === "workplace_manager") {
    return doc.role;
  }
  // Legacy encoding: role=user + boolean flags
  if (doc.can_report_time === true) return "reporter";
  if (doc.can_manage_workplaces === true) return "workplace_manager";
  if (doc.role === "user") return "user";
  return "user";
}

function needsLegacyCleanup(doc) {
  return LEGACY_FLAGS.some((key) =>
    Object.prototype.hasOwnProperty.call(doc, key),
  );
}

/**
 * Normalize legacy User docs that still carry can_* flags.
 * Uses the raw Mongo collection so Mongoose strictQuery cannot
 * strip filters for paths removed from the User schema.
 */
export async function migrateLegacyUserRoles() {
  const User = getModel("User");
  const users = await User.collection.find({}).toArray();

  let updated = 0;
  for (const user of users) {
    const nextRole = deriveRole(user);
    const hasLegacy = needsLegacyCleanup(user);
    const roleChanged = user.role !== nextRole;

    if (!hasLegacy && !roleChanged) continue;

    const update = {};
    if (roleChanged || hasLegacy) {
      update.$set = { role: nextRole };
    }
    if (hasLegacy) {
      update.$unset = {
        can_report_time: "",
        can_view_time_reports: "",
        can_manage_workplaces: "",
      };
    }

    await User.collection.updateOne({ _id: user._id }, update);
    updated += 1;
    console.log(
      `  ${user.email || user._id}: role ${user.role} → ${nextRole}${hasLegacy ? " (unset can_*)" : ""}`,
    );
  }

  if (updated > 0) {
    console.log(`Migrated ${updated} legacy user role document(s).`);
  }
  return updated;
}
