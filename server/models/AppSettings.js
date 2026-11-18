import mongoose from "mongoose";
import { baseSchemaOptions } from "./schemaOptions.js";

const appSettingsSchema = new mongoose.Schema(
  {
    pricing_method: {
      type: String,
      enum: ["hourly", "daily"],
      default: "hourly",
    },
    default_rate: { type: Number },
    default_hours: { type: Number },
    default_daily_rate: { type: Number },
    hours_per_daily_unit: { type: Number },
    default_start_time: { type: String },
    default_end_time: { type: String },
    attendance_did_not_leave: { type: [String] },
    attendance_did_not_work: { type: [String] },
    attendance_studies: { type: [String] },
  },
  baseSchemaOptions,
);

const AppSettings =
  mongoose.models.AppSettings ||
  mongoose.model("AppSettings", appSettingsSchema);

export default AppSettings;
