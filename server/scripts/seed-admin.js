/**
 * Create or reset the admin user. Run: node server/scripts/seed-admin.js
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { getModel } from "../models/index.js";
import { hashPassword } from "../lib/password.js";
import { ROLES } from "../config/permissions.js";
import { ensurePermissionRulesSeeded } from "../services/permissionRuleService.js";

dotenv.config();

const email = (process.env.ADMIN_EMAIL || "admin@siduravoda.local").toLowerCase().trim();
const password = process.env.ADMIN_PASSWORD || "SidurAdmin2026!";
const fullName = process.env.ADMIN_NAME || "מנהל מערכת";

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("Missing MONGODB_URI in .env");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  await ensurePermissionRulesSeeded();
  const User = getModel("User");

  const password_hash = await hashPassword(password);
  const existing = await User.findOne({ email });

  if (existing) {
    existing.password_hash = password_hash;
    existing.full_name = fullName;
    existing.role = ROLES.ADMIN;
    existing.is_active = true;
    existing.set("can_report_time", undefined);
    existing.set("can_view_time_reports", undefined);
    existing.set("can_manage_workplaces", undefined);
    await existing.save();
    await User.updateOne(
      { _id: existing._id },
      {
        $unset: {
          can_report_time: "",
          can_view_time_reports: "",
          can_manage_workplaces: "",
        },
      },
    );
    console.log("Updated existing admin user.");
  } else {
    await User.create({
      email,
      password_hash,
      full_name: fullName,
      role: ROLES.ADMIN,
      is_active: true,
    });
    console.log("Created new admin user.");
  }

  console.log("\n--- Login credentials ---");
  console.log(`Email:    ${email}`);
  console.log(`Password: ${password}`);
  console.log("-------------------------\n");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
