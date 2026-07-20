import { getModel } from "../models/index.js";
import { hashPassword } from "./password.js";
import { ROLES } from "../config/permissions.js";

export async function ensureAdminUser() {
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
    can_report_time: false,
    can_view_time_reports: true,
    can_manage_workplaces: false,
    is_active: true,
  });

  console.log(`Created initial admin user: ${email}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.warn(
      "Using default password 'admin123'. Set ADMIN_PASSWORD in production.",
    );
  }
}
