import mongoose from "mongoose";
import { baseSchemaOptions } from "./schemaOptions.js";

export const PERMISSION_ROLES = [
  "admin",
  "user",
  "workplace_manager",
  "reporter",
];

export const MANAGE_USERS_LEVELS = ["none", "limited", "all"];

const permissionRuleSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: PERMISSION_ROLES,
      required: true,
      unique: true,
    },
    label_he: { type: String, required: true, trim: true },
    can_access_main_app: { type: Boolean, default: false },
    can_manage_workplaces: { type: Boolean, default: false },
    can_report_time: { type: Boolean, default: false },
    can_view_time_reports: { type: Boolean, default: false },
    can_approve_time_reports: { type: Boolean, default: false },
    can_access_admin_tools: { type: Boolean, default: false },
    can_manage_users: {
      type: String,
      enum: MANAGE_USERS_LEVELS,
      default: "none",
    },
  },
  baseSchemaOptions,
);

const PermissionRule =
  mongoose.models.PermissionRule ||
  mongoose.model("PermissionRule", permissionRuleSchema);

export default PermissionRule;
