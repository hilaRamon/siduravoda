/**
 * Migrate legacy User documents:
 * - Derive role from role + can_* flags
 * - Unset legacy permission booleans (now on PermissionRule)
 *
 * Run: node server/scripts/migrate-user-roles.js
 * (Also runs automatically on server start.)
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { ensurePermissionRulesSeeded } from "../services/permissionRuleService.js";
import { migrateLegacyUserRoles } from "../lib/migrateUserRoles.js";

dotenv.config();

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("Missing MONGODB_URI in .env");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  await ensurePermissionRulesSeeded();
  const updated = await migrateLegacyUserRoles();
  console.log(`\nDone. Updated ${updated} user(s).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
