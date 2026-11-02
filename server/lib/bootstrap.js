import { getModel } from "../models/index.js";
import Farm from "../models/Farm.js";
import Workplace from "../models/Workplace.js";
import { hashPassword } from "./password.js";
import { ROLES } from "../config/permissions.js";
import { PNIMIYA_WORKPLACE_NAME } from "./cloneWorkplaceDecision.js";
import { ensurePermissionRulesSeeded } from "../services/permissionRuleService.js";

const NO_CHARGE_FARM_NAME = "ללא חיוב";

export async function ensurePnimiyaWorkplace() {
  const farm = await Farm.findOne({ name: NO_CHARGE_FARM_NAME });
  const farmId = farm?._id?.toString() || "";
  if (!farmId) {
    console.warn(
      `Farm "${NO_CHARGE_FARM_NAME}" was not found. "${PNIMIYA_WORKPLACE_NAME}" stays without a farm.`,
    );
  }

  const existing = await Workplace.findOne({ name: PNIMIYA_WORKPLACE_NAME });
  if (!existing) {
    await Workplace.create({
      name: PNIMIYA_WORKPLACE_NAME,
      ...(farmId ? { farm_id: farmId } : {}),
    });
    return;
  }
  if (farmId && existing.farm_id !== farmId) {
    existing.farm_id = farmId;
    await existing.save();
  }
}

export async function ensureAdminUser() {
  await ensurePermissionRulesSeeded();

  const User = getModel("User");
  const count = await User.countDocuments();
  if (count > 0) return;

  const email = process.env.ADMIN_EMAIL || "admin@example.com";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const fullName = process.env.ADMIN_NAME || "מנהל מערכת";

  await User.create({
    email: email.toLowerCase().trim(),
    password_hash: await hashPassword(password),
    full_name: fullName,
    role: ROLES.ADMIN,
    is_active: true,
  });

  console.log(`Created initial admin user: ${email}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.warn(
      "Using default password 'admin123'. Set ADMIN_PASSWORD in production.",
    );
  }
}
